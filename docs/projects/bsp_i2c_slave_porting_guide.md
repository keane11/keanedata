---
title: BSP I2C Slave 移植手册
date: 2026-05-13
order: 3
---

# GPIO 模拟 I2C 从机驱动移植手册

> 版本：v1.3 | 新增：标准寄存器从设备协议 / repeated START 读支持 / 默认寄存器表示例

## 目录

1. [背景与适用场景](#1-背景与适用场景)
2. [设计原理](#2-设计原理)
3. [文件说明](#3-文件说明)
4. [移植到新芯片](#4-移植到新芯片)
5. [AB896X 接入步骤](#5-ab896x-接入步骤)
6. [使用说明](#6-使用说明)
7. [状态机详解](#7-状态机详解)
8. [局限性与注意事项](#8-局限性与注意事项)
9. [I2C_SW_SLAVE_EN 移植可行性评估](#9-i2c_sw_slave_en-移植可行性评估)

---

## 1. 背景与适用场景

### 问题

部分芯片（如中科蓝汛 AB896X）的硬件 I2C 控制器仅支持**主机（Master）**模式，无硬件 I2C
从机（Slave）外设。当外部 SoC/MCU 需要通过 I2C 总线向该芯片写入控制命令或读取状态时，
必须用软件模拟 I2C 从机行为。

### 方案定位

- 支持速率：**100kHz 标准模式**（Standard Mode）
- 地址格式：**7-bit** 从机地址
- 依赖硬件：任意两根可配置中断的 GPIO
- 数据接口：**中断写环形缓冲区 + 主任务轮询读取**
- 协议形态：**标准寄存器从设备**，支持 `WRITE reg` 后 `RESTART + READ data`

### 适用范围

只要目标芯片满足以下条件，本方案均可移植：

| 条件 | 说明 |
|------|------|
| GPIO 可配置为输入/开漏输出 | SDA 需开漏 |
| GPIO 支持边沿中断 | SCL 和 SDA 各需一路 |
| 中断延迟 < 2 µs | 100kHz 下半周期为 5 µs，留有足够余量 |
| 有系统定时或延迟 API | 可选，用于超时保护 |

---

## 2. 设计原理

### 2.1 I2C 总线基础

```
空闲状态：SCL = H，SDA = H（外部上拉电阻维持）

START 条件：SCL = H 时，SDA 下降沿
 ____       ____
     |     |
SCL  |_____|    （SCL 在 START 后开始产生时钟）

 ____
     |___________
SDA        ↑
           START

STOP 条件：SCL = H 时，SDA 上升沿

数据传输：每个 SCL 高电平期间采样 SDA（MSB first）
第 9 个时钟为 ACK bit：从机拉低 SDA = ACK；释放 = NACK
```

### 2.2 双边沿检测技术

标准 GPIO 中断通常只支持单一边沿触发（上升或下降）。本方案通过在 ISR 中
**翻转边沿方向寄存器**实现双边沿检测：

```
初始化：配置为下降沿中断
          ↓
ISR 触发（GPIO 从 H 变 L）
  → 读 GPIO 电平 = L（确认是下降沿）
  → 处理下降沿事件
  → 将中断方向改为上升沿
          ↓
ISR 触发（GPIO 从 L 变 H）
  → 读 GPIO 电平 = H（确认是上升沿）
  → 处理上升沿事件
  → 将中断方向改为下降沿
          ↓
循环...
```

**关键优势**：ISR 内直接读 GPIO 寄存器判断方向，与边沿寄存器含义（0=下降/0=上升）无关，
无需关心具体芯片的寄存器极性定义。

### 2.3 SDA 开漏驱动

I2C 总线为开漏（Open-Drain）结构，总线上有外部上拉电阻（通常 4.7kΩ）：

```
VCC
 │
 ├─ 4.7kΩ ─→ SCL
 │
 └─ 4.7kΩ ─→ SDA
                │
               [Slave GPIO]
```

从机 SDA 操作规则：

| 操作 | GPIO 状态 | 说明 |
|------|-----------|------|
| 释放（输出 1）| DIR = 输入（高阻） | 由外部上拉拉高，禁止主动驱动高 |
| 拉低（输出 0）| DIR = 输出 + 输出值 = 0 | 拉低总线 |

**禁止**将 SDA 主动驱动为高电平（DIR=输出，输出值=1），否则当主机同时拉低时会短路。

### 2.4 中断状态机架构

```
ISR 入口
  │
  ├─ 读 SCL、SDA 当前电平
  │
  ├─ SDA 是否变化？
  │     ├─ SCL=H + SDA↓ → on_start()
  │     ├─ SCL=H + SDA↑ → on_stop()
  │     └─ SCL=L 时变化 → 忽略（主机建立数据 bit）
  │   翻转 SDA 中断边沿方向
  │
  └─ SCL 是否变化？
        ├─ SCL↑ → on_scl_rise(sda)  [采样数据]
        └─ SCL↓ → on_scl_fall()     [驱动 SDA]
      翻转 SCL 中断边沿方向
```

---

## 3. 文件说明

```
app/bsp/
├── bsp_i2c_slave.h     驱动头文件：宏配置说明、公共 API 声明
└── bsp_i2c_slave.c     驱动实现：状态机、ISR、环形缓冲区
```

### bsp_i2c_slave.h 提供的 API

```c
/* 初始化：配置 GPIO、使能中断、注册 ISR */
void    bsp_i2c_slave_init(void);

/* 主循环周期调用（5~10ms）：总线超时检测 */
void    bsp_i2c_slave_poll(void);

/* 查询帧元数据队列是否非空（有完整帧待读取） */
bool    bsp_i2c_slave_rx_available(void);

/* 读取最早一帧数据，返回实际字节数 */
uint8_t bsp_i2c_slave_rx_read(uint8_t *buf, uint8_t max_len);

/* 预填充发送缓冲区；若正在 Clock Stretch，调用后立即释放 SCL */
void    bsp_i2c_slave_tx_set(const uint8_t *buf, uint8_t len);

/* ISR 入口（内部使用；链式调度时可从外部调用） */
void    bsp_i2c_slave_isr(void);
```

---

## 4. 移植到新芯片

移植工作集中在三个部分：**GPIO 操作宏**、**中断注册**、**ISR 内存放置**。
不需要修改 `bsp_i2c_slave.c` 中的任何状态机逻辑。

### 4.1 配置项位置说明

所有引脚和功能宏集中在 **`bsp_i2c_slave_cfg.h`**，
修改后只需重编译 `bsp_i2c_slave.c`，不触发全量编译。

模块默认启用，`config.h` **无需**添加任何宏即可工作。
若需关闭本模块，在 `config.h` 中提前覆盖：

```c
// config.h
#define BSP_I2C_SLAVE_EN   0
```

### 4.2 用户配置模板（bsp_i2c_slave_cfg.h）

```c
/* =========================================================
 *  用户配置区 —— 仅修改此区域
 * ========================================================= */

/* --- 从机地址（7-bit）---
 * 若主机文档用 8-bit 惯例（如 0xA0/0xA1），填写时右移 1 位：(0xA0 >> 1) */
#define I2C_SLAVE_ADDR              0x48

/* --- 功能开关 --- */
#define I2C_SLAVE_CLOCK_STRETCH_EN  0      /* 1=使能 Clock Stretch */
#define I2C_SLAVE_TIMEOUT_MS        20     /* 总线超时阈值(ms)，0=禁用 */

/* --- SCL 引脚 --- */
#define I2C_SLAVE_SCL_IN_REG        GPIOx
#define I2C_SLAVE_SCL_DIR_REG       GPIOxDIR
#define I2C_SLAVE_SCL_DE_REG        GPIOxDE
#define I2C_SLAVE_SCL_PU_REG        GPIOxPU
#define I2C_SLAVE_SCL_PIN           BIT(n)
/* 仅 CLOCK_STRETCH_EN=1 时需要取消注释：*/
// #define I2C_SLAVE_SCL_CLR_REG    GPIOxCLR

/* --- SDA 引脚（开漏双向）--- */
#define I2C_SLAVE_SDA_IN_REG        GPIOx
#define I2C_SLAVE_SDA_DIR_REG       GPIOxDIR
#define I2C_SLAVE_SDA_DE_REG        GPIOxDE
#define I2C_SLAVE_SDA_PU_REG        GPIOxPU
#define I2C_SLAVE_SDA_SET_REG       GPIOxSET
#define I2C_SLAVE_SDA_CLR_REG       GPIOxCLR
#define I2C_SLAVE_SDA_PIN           BIT(m)

/* --- PORT 中断寄存器 ---
 * AB896X：PA/PB → PORTINTEN/PORTINTEDG（PA=bit0-15，PB=bit16-31）
 *          PE   → PORTINTEN1/PORTINTEDG1（PE=bit0-13）            */
#define I2C_SLAVE_PORTINTEN         INTENx
#define I2C_SLAVE_PORTINTEDG        INTEDGx
#define I2C_SLAVE_SCL_INT_BIT       BIT(p)
#define I2C_SLAVE_SDA_INT_BIT       BIT(q)
```

> **PORTINTEDG 极性无需确认**：ISR 内通过读 GPIO 电平判断边沿方向，
> `^=` 翻转保证始终检测反向边沿，与寄存器的 0/1 含义无关。
>
> **超时依赖**：`TIMEOUT_MS > 0` 时引用 `tmr5ms_cnt`（AB896X 每 5ms 加 1）。
> 移植到其他芯片时替换为等效 tick 计数器，并修改 `poll()` 中的换算系数。

### 4.2 中断注册适配

在 `bsp_i2c_slave.c` 的 `bsp_i2c_slave_init()` 末尾，有如下注册语句：

```c
sys_irq_init(IRQ_PORT_VECTOR, 3, bsp_i2c_slave_isr);
```

**移植时按照目标芯片的中断注册方式替换此行**，例如：

```c
// ARM Cortex-M（CMSIS）示例
NVIC_SetPriority(EXTIn_IRQn, 3);
NVIC_EnableIRQ(EXTIn_IRQn);
// 在中断向量表中将 EXTIn_Handler 指向 bsp_i2c_slave_isr

// 或者在中断处理函数中手动调用
void EXTIn_Handler(void) {
    bsp_i2c_slave_isr();
    EXTI->PR = EXTI_PR_PIF5;  // 清除 pending（芯片相关）
}
```

### 4.3 ISR 内存放置属性

`bsp_i2c_slave.c` 中 ISR 使用了 `AT(.com_text.i2c_slave)` 将其放入特定代码段，
这是 AB896X SDK 的链接器属性。移植时按目标芯片的规范替换或删除：

```c
// AB896X（当前）
AT(.com_text.i2c_slave)
void bsp_i2c_slave_isr(void) { ... }

// ARM Cortex-M（ITCM 放置示例）
__attribute__((section(".ITCM")))
void bsp_i2c_slave_isr(void) { ... }

// 无特殊要求时直接删除 AT(...) 即可
void bsp_i2c_slave_isr(void) { ... }
```

### 4.4 数据类型适配

`bsp_i2c_slave.c` 使用 `uint8_t`、`uint16_t`、`bool`，均为标准 C99 类型。
若目标平台使用自定义类型（如 `u8`、`u16`），在文件顶部添加 typedef 或修改类型名称即可。

---

## 5. AB896X 接入步骤

### 5.1 确认引脚并填写配置

**第一步**：模块默认启用，`config.h` **无需**改动。
（仅当需要关闭时才添加 `#define BSP_I2C_SLAVE_EN 0`）

**第二步**：打开 `app/bsp/bsp_i2c_slave_cfg.h`，修改用户配置区（以 PB1/PB2 为例）：

```c
#define I2C_SLAVE_ADDR              0x48        // 替换为实际 7-bit 地址

#define I2C_SLAVE_CLOCK_STRETCH_EN  0
#define I2C_SLAVE_TIMEOUT_MS        20

/* SCL → PB1 */
#define I2C_SLAVE_SCL_IN_REG        GPIOB
#define I2C_SLAVE_SCL_DIR_REG       GPIOBDIR
#define I2C_SLAVE_SCL_DE_REG        GPIOBDE
#define I2C_SLAVE_SCL_FEN_REG       GPIOBFEN
#define I2C_SLAVE_SCL_PU_REG        GPIOBPU
#define I2C_SLAVE_SCL_PIN           BIT(1)
#define I2C_SLAVE_SCL_WKUP_SRC_BIT  BIT(1)      // PB1 = WAKEUP SOURCE 1；非专用唤醒脚填 0

/* SDA → PB2 */
#define I2C_SLAVE_SDA_IN_REG        GPIOB
#define I2C_SLAVE_SDA_DIR_REG       GPIOBDIR
#define I2C_SLAVE_SDA_DE_REG        GPIOBDE
#define I2C_SLAVE_SDA_FEN_REG       GPIOBFEN
#define I2C_SLAVE_SDA_PU_REG        GPIOBPU
#define I2C_SLAVE_SDA_SET_REG       GPIOBSET
#define I2C_SLAVE_SDA_CLR_REG       GPIOBCLR
#define I2C_SLAVE_SDA_PIN           BIT(2)
#define I2C_SLAVE_SDA_WKUP_SRC_BIT  BIT(2)      // PB2 = WAKEUP SOURCE 2；非专用唤醒脚填 0

/* PB1 → bit17，PB2 → bit18 */
#define I2C_SLAVE_PORTINTEN         PORTINTEN
#define I2C_SLAVE_PORTINTEDG        PORTINTEDG
#define I2C_SLAVE_SCL_INT_BIT       BIT(16 + 1)
#define I2C_SLAVE_SDA_INT_BIT       BIT(16 + 2)
```

**AB896X PORTINTEN bit 映射速查表：**

| 引脚 | PORTINTEN bit | 寄存器 |
|------|--------------|--------|
| PA0-PA15 | bit0-bit15 | `PORTINTEN` / `PORTINTEDG` |
| PB0-PB15 | bit16-bit31 | `PORTINTEN` / `PORTINTEDG` |
| PE0-PE13 | bit0-bit13 | `PORTINTEN1` / `PORTINTEDG1` |

### 5.2 将头文件加入 bsp.h

打开 `app/include/bsp.h`，加入：

```c
#include "bsp_i2c_slave.h"
```

### 5.3 在系统初始化中调用 init

在系统初始化流程中（一般在 `app_main()` 或 `bsp_init()` 内）加入：

```c
#if BSP_I2C_SLAVE_EN
    bsp_i2c_slave_init();
#endif
```

### 5.4 PORT 中断冲突检查

检查项目中是否已有其他模块使用 `IRQ_PORT_VECTOR`（GPIO 中断向量 26）：

```bash
grep -r "IRQ_PORT_VECTOR" app/
grep -r "port_isr\|port_int" app/
```

- **无其他用户**（`bsp_port_int.c` 中代码在 `#if 0` 内）：直接使用，无需修改。
- **有其他用户**：参见 [5.5 链式中断调度](#55-链式中断调度)。

### 5.5 链式中断调度（有冲突时）

在 `bsp_port_int.c` 中添加调度逻辑：

```c
/* 在 bsp_port_int.c 顶部添加 */
#include "bsp_i2c_slave.h"

/* 统一 PORT 中断入口 */
AT(.com_text.port)
static void port_isr_dispatch(void)
{
    /* 各模块检查自己的引脚并处理 */
#if BSP_I2C_SLAVE_EN
    bsp_i2c_slave_isr();
#endif
    /* 在此添加其他 PORT 中断处理 */
    // other_module_isr();
}

void port_int_init(void)
{
    sys_irq_init(IRQ_PORT_VECTOR, 3, port_isr_dispatch);
    /* 各模块分别配置自己的 PORTINTEN/PORTINTEDG，此处不统一配置 */
}
```

同时，将 `bsp_i2c_slave_init()` 中的 `sys_irq_init(...)` 调用删除，
改为只配置 PORTINTEN/PORTINTEDG，由 `port_int_init()` 统一注册 ISR。

### 5.6 将新文件加入编译系统

检查项目的 Makefile 或构建脚本，确保 `bsp_i2c_slave.c` 被编译：

```makefile
# 在 bsp 相关的源文件列表中添加
BSP_SRC += app/bsp/bsp_i2c_slave.c
```

---

## 6. 使用说明

### 6.1 主机 WRITE（设置寄存器指针 / 可选写数据）

主机向从机发送数据的典型流程：

```
主机：START + 从机地址(W) + ACK
主机：寄存器地址字节      + ACK    ← 第 1 字节视为 reg 指针
主机：数据字节 1          + ACK    ← 可选
主机：数据字节 2          + ACK    ← 可选
主机：STOP
```

当前实现约定：

- WRITE 帧的**第 1 个字节**作为寄存器地址 `reg`
- 若本帧只有 1 个字节，则表示“仅更新寄存器指针”
- 若本帧带后续 `data...`，这些字节仍会进入 `rx queue`，供应用层按需处理

从机侧（主任务轮询，可选做日志或扩展写命令处理）：

```c
/* 在主任务循环或定时回调中执行 */
if (bsp_i2c_slave_rx_available()) {
    uint8_t buf[32];
    uint8_t len = bsp_i2c_slave_rx_read(buf, sizeof(buf));

    if (len >= 2) {
        uint8_t reg_addr = buf[0];   // 第 1 字节通常是寄存器地址
        uint8_t data     = buf[1];   // 第 2 字节起是数据
        handle_write(reg_addr, &buf[1], len - 1);
    }
}
```

### 6.2 主机 READ（从机发送数据）

标准寄存器读取流程如下：

```
主机：START + 从机地址(W) + ACK
主机：寄存器地址字节      + ACK
主机：RESTART（重复 START）
主机：START + 从机地址(R) + ACK
从机：数据字节 1          + ACK（主机发 ACK 表示继续）
从机：数据字节 2          + NACK（主机发 NACK 表示读完）
主机：STOP
```

注意：

- 这里的 `reg`、`data`、`len` 是**主机侧 API 参数/协议约定**，不是要求从机在线路上额外返回 `[reg][len][data]`
- 当前实现在线路上返回的是**纯 data 字节流**
- `len` 由主机按寄存器协议预先知道，主机读多少字节，从机就按当前寄存器内容返回多少字节

当前工程默认寄存器表示例（在 `bsp_i2c_slave.c` 的 `reg_build_payload()` 中实现）：

| reg | 含义 | 返回字节数 | 数据来源 |
|-----|------|-----------|----------|
| `0x01` | 电量 | `1` | `bsp_get_bat_level()` |
| `0x02` | 充电状态 | `1` | `sys_cb.charge_sta` |

主机侧读取示例（当前工程自测 helper）：

```c
uint8_t bat;
uint8_t chg;

i2cReadRegBytes(0xA0, 0x01, &bat, 1);   // 读取电量
i2cReadRegBytes(0xA0, 0x02, &chg, 1);   // 读取充电状态
```

驱动实现要点：

- 当主机在 WRITE `reg` 后发出 `RESTART`，从机会在新的 `START` 到来时先结算前一段 WRITE 帧
- `reg` 指针会在 ISR 内立即生效，不依赖主循环先跑到 `bsp_i2c_slave_rx_read()`
- 因此支持标准的“`WRITE reg` 后紧接 `READ data`”时序

### 6.3 环形缓冲区说明

```
s_rx_buf[I2C_SLAVE_RX_BUF_SIZE]   (默认 64 字节，必须为 2 的幂)
s_pkt_queue[I2C_SLAVE_PKT_QUEUE_SIZE] (默认 16 项，必须为 2 的幂)
```

- ISR 在每收到一字节后写入 `s_rx_buf[s_rx_w]` 并移动 `s_rx_w`
- STOP 条件触发后，ISR 将 `{start, len}` 推入 `s_pkt_queue`
- 若主机使用 `WRITE reg + RESTART + READ`，驱动会在 `START` 到来时先结算上一段 WRITE 帧，使寄存器指针及时生效
- 主任务调用 `bsp_i2c_slave_rx_read()` 时，按最早一帧的 `start/len` 复制数据，并推进 `s_rx_r`

当前默认容量：

- `I2C_SLAVE_RX_BUF_SIZE = 64`，环形缓冲采用“留一格判满”，实际最多缓存 `63` 字节
- `I2C_SLAVE_PKT_QUEUE_SIZE = 16`，帧队列同样“留一格判满”，实际最多缓存 `15` 帧

溢出行为：

- `rx_buf` 满时，新的数据字节会被丢弃，并在 `poll()` 中打印 `rx_buf overflow`
- `pkt_queue` 满时，新的完整帧会被丢弃，并在 `poll()` 中打印 `pkt_queue overflow`

对于单次突发写入，必须同时满足：

- `单次突发总字节数 <= I2C_SLAVE_RX_BUF_SIZE - 1`
- `单次突发帧数 <= I2C_SLAVE_PKT_QUEUE_SIZE - 1`

### 6.4 缓冲区大小调整

在 `bsp_i2c_slave.h` 中修改：

```c
#define I2C_SLAVE_RX_BUF_SIZE   128   /* 改为 128（必须是 2 的幂：32/64/128/256）*/
#define I2C_SLAVE_TX_BUF_SIZE   64    /* 主机 READ 的最大返回字节数 */
#define I2C_SLAVE_PKT_QUEUE_SIZE 32   /* 实际可缓存 31 帧 */
```

建议：

- 若主机一次会连续发送 `N` 帧，则 `I2C_SLAVE_PKT_QUEUE_SIZE` 至少设为 `N + 1`
- 若每帧长度为 `L`、一次连续发送 `N` 帧，则 `I2C_SLAVE_RX_BUF_SIZE` 至少设为 `N * L + 1`
- 仅增大 `rx_buf` 不能解决“多帧积压”问题；帧队列和字节缓冲都要一起评估

---

## 7. 状态机详解

### 7.1 状态转移图

```
                      START
         ┌────────────────────────────────┐
         ↓                                │（任意状态）
      ┌──────┐    SDA↓/SCL=H           ┌──────┐
      │ IDLE │ ─────────────────────→  │RECV  │
      └──────┘                         │ADDR  │
         ↑                             └──────┘
         │ SDA↑/SCL=H (STOP)              │
         │                           8bit 收完
         │                                ↓
         │                    ┌──── addr 匹配? ────┐
         │                    │ 是                 │ 否
         │                    ↓                    ↓
         │              ACK（SDA拉低）         NACK/IDLE
         │                    │
         │           R/W bit = ?
         │         ┌──────────┴──────────┐
         │         │ 0（主机写）          │ 1（主机读）
         │         ↓                     ↓
         │    ┌─────────┐          ┌──────────┐
         │    │  RECV   │          │  SEND    │
         │    │  DATA   │          │  DATA    │
         │    └─────────┘          └──────────┘
         │    每字节后 ACK          每字节后等 ACK
         │         │                     │
         └─────────┴─────────────────────┘
                  STOP
```

### 7.2 bit_cnt 含义对照表

| 状态 | bit_cnt 值 | 含义 | 下一动作 |
|------|-----------|------|---------|
| RECV_ADDR / RECV_DATA | 0-7 | 已采样的 bit 数 | SCL↑ 继续移位 |
| RECV_ADDR / RECV_DATA | 8 | 字节接收完毕 | SCL↓ 驱动 ACK（SDA拉低） |
| RECV_ADDR / RECV_DATA | 9 | ACK 时钟完成 | SCL↓ 释放 SDA，转下一字节 |
| SEND_DATA | 0 | 当前字节已装载，等待下一个 SCL↓ 驱动 MSB | SCL↓ 驱动 bit7 |
| SEND_DATA | 1-7 | 已驱动前 bit_cnt 个数据位 | SCL↓ 驱动 bit(7-bit_cnt) |
| SEND_DATA | 8 | bit0 已驱动，等待当前 SCL↑ 完成最后一个数据位采样 | SCL↑ 置 bit_cnt=9 |
| SEND_DATA | 9 | 8 个数据位已发送完 | SCL↓ 释放 SDA |
| SEND_DATA | 10 | SDA 已释放 | SCL↑ 采样主机 ACK/NACK |

### 7.3 SEND_DATA 首 bit 驱动时序

进入 SEND_DATA 状态发生在地址 ACK 时钟的下降沿，此下降沿同时也是第一个数据 bit 的
建立时间窗口，驱动逻辑如下：

```c
/* on_scl_fall()，RECV_ADDR，bit_cnt == 9 分支 */
SDA_RELEASE();                              // 先释放 ACK
s_state     = SLAVE_SEND_DATA;
s_tx_idx    = 0;
s_shift_reg = s_tx_buf[0];
drive_sda_bit((s_shift_reg >> 7) & 1);     // 立即驱动 MSB（bit7）
s_bit_cnt   = 1;                           // 标记 bit7 已驱动
/* 下次 SCL 上升沿：主机采样 bit7 */
/* 下次 SCL 下降沿：on_scl_fall 驱动 bit6，bit_cnt=2 */
/* bit0 被主机采样后，先在下一次 SCL↓ 释放 SDA，再在第 9 个 SCL↑ 采 ACK/NACK */
```

---

## 8. 局限性与注意事项

### 8.1 不支持的 I2C 特性

| 特性 | v1.0 | v1.1 | 说明 |
|------|------|------|------|
| 7-bit 地址 | ✅ | ✅ | |
| 10-bit 地址 | ❌ | ❌ | 需扩展状态机，增加 ADDR2 接收状态 |
| 时钟延展（Clock Stretch）| ❌ | ✅ | 已实现，仅作用于主机 READ + tx 未就绪场景 |
| 多帧积压不丢帧长 | ❌ | ✅ | 帧元数据队列，最多追踪 PKT_QUEUE_SIZE 帧 |
| 总线超时自动复位 | ❌ | ✅ | 依赖 tmr5ms_cnt，需主循环调用 poll() |
| 多主机仲裁 | ❌ | ❌ | 只处理单主机场景 |
| 400kHz 快速模式 | ⚠️ | ⚠️ | 需评估 ISR 延迟，通常不保证 |
| SMBus / PMBus | ⚠️ | ⚠️ | 协议层兼容，时序需验证 |
| 广播地址（0x00）| ❌ | ❌ | 可在地址匹配处额外判断实现 |

### 8.2 中断延迟要求

100kHz 下，SCL 半周期为 5 µs。从 SCL 下降沿到从机驱动 SDA 完成（ACK 建立），
整个 ISR 执行时间需满足：

```
t_ISR < t_SCL/2 - t_hold_min
      < 5 µs - 0 µs
      = 5 µs
```

若系统中有其他高优先级中断频繁抢占，可能导致 ACK 驱动超时。
建议将 ISR 优先级设置为较高级别（低于音频等核心中断）。

### 8.3 主任务轮询频率建议

以默认 64 字节缓冲区、典型帧长 8 字节为例，在 100kHz I2C 下传输 8 字节约需 0.8 ms。
建议主任务每 5-10 ms 轮询一次，在帧间隔充裕的场景下不会丢帧。

### 8.4 多帧连续写入的限制

当前实现已支持多帧元数据队列，但能力仍受**有限缓存**约束：

- 默认 `I2C_SLAVE_PKT_QUEUE_SIZE = 16`，实际最多缓存 `15` 帧
- 默认 `I2C_SLAVE_RX_BUF_SIZE = 64`，实际最多缓存 `63` 字节
- 主机在主任务轮询间隔内连续发送多帧时，只要超过以上任一容量，后续数据或整帧就会被丢弃

当前版本不会再静默丢包；若发生积压超限，会在 `bsp_i2c_slave_poll()` 中打印：

```text
[I2CS] WARN rx_buf overflow +X total=Y
[I2CS] WARN pkt_queue overflow +X total=Y
```

若业务需要保证突发数据全部保留，做法只有三类：

1. 增大 `I2C_SLAVE_RX_BUF_SIZE` 和 `I2C_SLAVE_PKT_QUEUE_SIZE`
2. 让主机分批发送，给主任务留出出队时间
3. 在更高层协议上增加重试或流控

### 8.5 SCL 引脚无需开漏

本方案中 SCL 为**纯输入**，从机不驱动 SCL（不支持 Clock Stretch），
因此 SCL 引脚只需配置输入模式 + 上拉即可，无需开漏配置。

### 8.6 外部上拉电阻

- 推荐值：100kHz 时使用 **4.7kΩ**
- 线长 < 30cm 的板间通信可用 10kΩ
- 内部上拉（一般 >10kΩ）可作为补充，但不建议替代外部电阻

### 8.7 当前实现限制汇总

- 仅支持单一 **7-bit** 从机地址，地址在编译期宏 `I2C_SLAVE_ADDR` 中固定
- 主要按 **100kHz 标准模式**验证，`400kHz` 不保证稳定
- `Clock Stretch` 默认关闭；即使打开，也只覆盖“主机 READ 且 tx 尚未准备好”的场景
- 依赖主循环周期调用 `bsp_i2c_slave_poll()` 处理超时恢复、假中断恢复和 overflow 日志
- 默认超时阈值为 `20ms`，主机若在一帧中途长时间停钟，半帧会被丢弃
- 有限缓存无法无条件保证“全收完”，必须按最坏突发帧数和总字节数配置 buffer
- 当前默认协议只把 WRITE 帧的第 1 个字节作为 `reg` 指针；后续 write payload 是否生效由应用层自行扩展
- 当前默认寄存器表仅实现 `0x01=电量`、`0x02=充电状态`，其他寄存器默认返回 `0x00`
- 当前 READ 返回的是纯 `data` 字节，不自动附带 `reg/len` 头；主机必须按协议预知长度

---

## 9. I2C_SW_SLAVE_EN 移植可行性评估

`I2C_SW_SLAVE_EN` 是从另一颗芯片移植过来的 GPIO 模拟 I2C 从机实现，
以下从"能否直接用于 AB896X"和"能否移植到其他芯片"两个维度进行评估。

### 9.1 硬件机制依赖分析

| 机制 | `I2C_SW_SLAVE_EN` 的做法 | 可移植性 |
|------|--------------------------|---------|
| SCL 中断 | **WAKEUP 专用引脚机制**（`WKUPEDG/WKUPCPND/WKUPCON`） | ❌ 完全 AB896X 专用 |
| SDA 中断 | PORT 中断 + WAKEUP 路由（`BIT(22)/BIT(23)`）| ❌ AB896X WAKEUP 架构专用 |
| SCL 引脚 | 只能用 PB1/PB2/PE0/PE7/PA15/PB5 六根 WAKEUP 引脚 | ❌ 引脚固定 |
| 边沿翻转 | `WKUPEDG ^= BIT(1)` | ❌ AB896X 寄存器专用 |

即便在 AB896X 上，SCL 也只能用 6 根固定引脚之一，灵活性远低于我们的方案。
移植到其他芯片需要全部重写中断配置部分，工作量等同于重新实现。

### 9.2 已知 Bug 汇总

以下问题会导致功能异常或硬件损坏，移植前**必须修复**：

| 序号 | 严重程度 | 问题描述 | 影响 |
|------|---------|---------|------|
| 1 | 🔴 Critical | `I2C_SDA_H_S()` 主动驱动 SDA 高电平（违反开漏规则）| 总线争用，可能损坏 GPIO |
| 2 | 🔴 Critical | STOP 时不释放 SDA，不通知应用层 | 主机 READ 后总线无法恢复 |
| 3 | 🟠 High | `I2C_STA_STOP` 状态永远不会被设置（dead code）| STOP 处理逻辑名存实亡 |
| 4 | 🟠 High | `RxIdx` 无越界检查 | 超过 32 字节即栈/堆溢出 |
| 5 | 🟡 Medium | 无应用层帧完成通知机制 | 上层需轮询 + 自行判断完整性 |
| 6 | 🟡 Medium | 从机地址用 8-bit 惯例（`0xa0`）而非 7-bit 标准 | 与主机驱动库参数不兼容 |
| 7 | 🟢 Low | 调试用字符串常量残留在 `.com_text` 段 | 浪费 SRAM，无法通过宏关闭 |

### 9.3 结论

```
移植到 AB896X 其他项目：需修复 Bug 1-5，且 SCL 引脚受限于 WAKEUP 专用脚
移植到其他芯片：       需修复全部 Bug + 重写中断初始化，工作量等同重写
直接在生产代码使用：    不建议（Bug 1 有硬件损坏风险）
```

**推荐做法**：使用本手册的 `BSP_I2C_SLAVE_EN` 方案，移植到新芯片只需更新
`bsp_i2c_slave_cfg.h` 中的 GPIO/中断寄存器宏，无需修改状态机逻辑。

---

---

## 10. 完整源码参考

### bsp_i2c_slave.h

```c
#ifndef _BSP_I2C_SLAVE_H
#define _BSP_I2C_SLAVE_H

#include "bsp_i2c_slave_cfg.h"

/*
 * GPIO 模拟 I2C 从机驱动  v1.2
 * ---------------------------------------------------------------
 * 特性：
 *   1. Clock Stretch  — 主机 READ 时 tx 未就绪可拉低 SCL 等待
 *   2. 多帧元数据队列 — 连续收帧不再丢 pkt_len
 *   3. 总线超时复位   — SCL 停止抖动超过阈值自动回 IDLE
 *
 * 模块结构
 * ---------------------------------------------------------------
 *   bsp_i2c_slave_cfg.h   所有用户配置（引脚、地址、功能开关、调试开关）
 *   bsp_i2c_slave.h       对外 API 声明
 *   bsp_i2c_slave.c       驱动实现
 *
 * 总开关 BSP_I2C_SLAVE_EN 默认启用；项目若需关闭，在 config.h 中
 *   #define BSP_I2C_SLAVE_EN 0
 * 提前覆盖即可。其余配置（引脚、地址、功能）直接改 bsp_i2c_slave_cfg.h。
 *
 * 使用方法
 * ---------------------------------------------------------------
 * 1. 初始化：
 *      bsp_i2c_slave_init();
 *
 * 2. 主循环中周期调用（建议 5~10ms）：
 *      bsp_i2c_slave_poll();          // 总线超时检测
 *
 * 3. 接收数据（主机 WRITE）：
 *      while (bsp_i2c_slave_rx_available()) {
 *          uint8_t buf[32];
 *          uint8_t len = bsp_i2c_slave_rx_read(buf, sizeof(buf));
 *          handle(buf, len);
 *      }
 *
 * 4. 预备发送数据（主机 READ，在主机发起 READ 前调用）：
 *      bsp_i2c_slave_tx_set(data, len);
 *      // 若使能 Clock Stretch，也可在收到读地址后的主循环中填充
 *
 * 注意
 * ---------------------------------------------------------------
 * - I2C_SLAVE_RX_BUF_SIZE / I2C_SLAVE_PKT_QUEUE_SIZE 必须为 2 的幂
 * - 超时检测依赖 tmr5ms_cnt（api_sys.h），确保定时器已启用
 * - Clock Stretch 仅作用于"主机 READ 但 tx 未准备好"的场景
 * - 若项目已有其他 PORT 中断用户，需改为链式调度（见移植手册）
 */

#if BSP_I2C_SLAVE_EN

/* 初始化 */
void    bsp_i2c_slave_init(void);

/* 主循环周期调用：总线超时检测（建议 5~10ms 间隔） */
void    bsp_i2c_slave_poll(void);

/* 查询是否有完整帧可读（队列非空即有） */
bool    bsp_i2c_slave_rx_available(void);

/* 读取最早一帧数据到 buf，返回实际字节数 */
uint8_t bsp_i2c_slave_rx_read(uint8_t *buf, uint8_t max_len);

/* 更新标准寄存器从设备的某个寄存器缓存值（支持多字节） */
void    bsp_i2c_slave_reg_set(uint8_t reg, const uint8_t *buf, uint8_t len);

/* 查询是否有寄存器刷新请求待主循环处理 */
bool    bsp_i2c_slave_refresh_pending(void);

/* 获取当前待刷新的寄存器号 */
uint8_t bsp_i2c_slave_get_pending_reg(void);

/* 查询当前是否启用 Clock Stretch 模式 */
bool    bsp_i2c_slave_clock_stretch_enabled(void);

/* 预填充发送缓冲区；若正在 Clock Stretch 等待，调用后立即释放 SCL */
void    bsp_i2c_slave_tx_set(const uint8_t *buf, uint8_t len);

/* ISR 入口（内部使用；链式调度时可从外部直接调用） */
void    bsp_i2c_slave_isr(void);

#endif /* BSP_I2C_SLAVE_EN */

#endif /* _BSP_I2C_SLAVE_H */
```

### bsp_i2c_slave_cfg.h（AB896X PB1/PB2 实际配置）

```c
#ifndef _BSP_I2C_SLAVE_CFG_H
#define _BSP_I2C_SLAVE_CFG_H

/* =========================================================
 *  bsp_i2c_slave 用户配置
 *  ---------------------------------------------------------
 *  本模块所有可调参数集中在此文件。
 *
 *  模块总开关 BSP_I2C_SLAVE_EN 默认启用，
 *  若项目需要关闭，可在 config.h 中提前 #define 为 0。
 *
 *  移植到新项目时，只需拷贝：
 *      bsp_i2c_slave.c
 *      bsp_i2c_slave.h
 *      bsp_i2c_slave_cfg.h
 *  无需修改 config.h（除非要关闭模块）。
 * ========================================================= */

/* --- 模块总开关（项目可在 config.h 中覆盖为 0 关闭） --- */
#ifndef BSP_I2C_SLAVE_EN
#define BSP_I2C_SLAVE_EN           1
#endif

#if BSP_I2C_SLAVE_EN

/* --- 从机地址（7-bit）---
 * 若主机文档用 8-bit 惯例（如 0xA0/0xA1），填写时右移 1 位：(0xA0 >> 1) */
#define I2C_SLAVE_ADDR              (0xA0 >> 1)

/* --- 功能开关 --- */
#define I2C_SLAVE_CLOCK_STRETCH_EN  1      /* 1=使能 Clock Stretch；需同步配置 SCL_CLR_REG */
#define I2C_SLAVE_STRETCH_TIMEOUT_MS 10    /* Clock Stretch 最长保持时间(ms)，超时后回退到缓存值 */
#define I2C_SLAVE_TIMEOUT_MS        20     /* 总线超时阈值(ms)，0=禁用 */

/* --- 寄存器映射（标准从设备协议：WRITE reg，随后 READ data） --- */
#define I2C_SLAVE_REG_BAT_LEVEL     0x01u
#define I2C_SLAVE_REG_CHARGE_STATUS 0x02u
#define I2C_SLAVE_REG_CACHE_COUNT   8u

/* --- 缓冲区尺寸（必须为 2 的幂） --- */
#define I2C_SLAVE_RX_BUF_SIZE       64     /* 接收环形缓冲区大小 */
#define I2C_SLAVE_TX_BUF_SIZE       32     /* 单个寄存器的最大返回字节数 */
#define I2C_SLAVE_PKT_QUEUE_SIZE    16     /* 帧元数据队列深度（实际可缓存 15 帧） */

/* --- 调试开关 ---
 * 1 = 使能事件日志（START/STOP/ADDR/DATA），在 bsp_i2c_slave_poll() 中打印
 * 0 = 关闭，零开销
 * 调试完成后改为 0 即可，无需删代码                                       */
#define I2C_SLAVE_DEBUG             1
#define I2C_SLAVE_DEBUG_WKUP        0      /* 1=逐边沿打印 GPIO 电平；日志很多，仅定位底层时打开 */

/* --- SCL 引脚 --- */
#define I2C_SLAVE_SCL_IN_REG        GPIOB
#define I2C_SLAVE_SCL_DIR_REG       GPIOBDIR
#define I2C_SLAVE_SCL_DE_REG        GPIOBDE
#define I2C_SLAVE_SCL_FEN_REG       GPIOBFEN
#define I2C_SLAVE_SCL_PU_REG        GPIOBPU
#define I2C_SLAVE_SCL_PIN           BIT(1)
#define I2C_SLAVE_SCL_WKUP_SRC_BIT  BIT(1)          /* PB1 = WAKEUP SOURCE 1；非专用唤醒脚时填 0 */
#define I2C_SLAVE_SCL_NAME          "PB1"
#define I2C_SLAVE_SCL_INT_NAME      "bit17"
/* Clock Stretch 时拉低 SCL 用（仅 I2C_SLAVE_CLOCK_STRETCH_EN=1 时必须） */
#define I2C_SLAVE_SCL_CLR_REG       GPIOBCLR

/* --- SDA 引脚（开漏双向）--- */
#define I2C_SLAVE_SDA_IN_REG        GPIOB
#define I2C_SLAVE_SDA_DIR_REG       GPIOBDIR
#define I2C_SLAVE_SDA_DE_REG        GPIOBDE
#define I2C_SLAVE_SDA_FEN_REG       GPIOBFEN
#define I2C_SLAVE_SDA_PU_REG        GPIOBPU
#define I2C_SLAVE_SDA_SET_REG       GPIOBSET
#define I2C_SLAVE_SDA_CLR_REG       GPIOBCLR
#define I2C_SLAVE_SDA_PIN           BIT(2)
#define I2C_SLAVE_SDA_WKUP_SRC_BIT  BIT(2)          /* PB2 = WAKEUP SOURCE 2；非专用唤醒脚时填 0 */
#define I2C_SLAVE_SDA_NAME          "PB2"
#define I2C_SLAVE_SDA_INT_NAME      "bit18"

/* --- PORT 中断寄存器 ---
 * PA/PB 引脚用 PORTINTEN/PORTINTEDG，bit 映射：PA0-15 → bit0-15，PB0-15 → bit16-31
 * PE    引脚用 PORTINTEN1/PORTINTEDG1，bit 映射：PE0-13 → bit0-13              */
#define I2C_SLAVE_PORTINTEN         PORTINTEN
#define I2C_SLAVE_PORTINTEDG        PORTINTEDG
#define I2C_SLAVE_SCL_INT_BIT       BIT(16 + 1)    /* PB1  → bit17 */
#define I2C_SLAVE_SDA_INT_BIT       BIT(16 + 2)    /* PB2  → bit18 */

#endif /* BSP_I2C_SLAVE_EN */

#endif /* _BSP_I2C_SLAVE_CFG_H */
```

### bsp_i2c_slave.c

<details>
<summary>展开查看完整实现源码</summary>

```c
#include "include.h"
#include "bsp_i2c_slave.h"

#if BSP_I2C_SLAVE_EN

/* =========================================================
 *  所有可调参数集中在 bsp_i2c_slave_cfg.h
 *  本文件为驱动实现，通常无需修改
 * ========================================================= */

/* --- 引脚电平读取 --- */
#define SCL_IS_H()      (I2C_SLAVE_SCL_IN_REG & I2C_SLAVE_SCL_PIN)
#define SDA_IS_H()      (I2C_SLAVE_SDA_IN_REG & I2C_SLAVE_SDA_PIN)

/*
 * SDA 开漏驱动规则（严格遵守 I2C 规范）：
 *   拉低 = DIR 设输出 + CLR       → 从机主动拉低总线
 *   释放 = DIR 设输入（高阻）      → 外部上拉电阻维持高电平
 *   禁止主动输出高电平（会与主机争用总线）
 */
#define SDA_PULL_LOW()  do {                                    \
    I2C_SLAVE_SDA_DIR_REG &= ~I2C_SLAVE_SDA_PIN;              \
    I2C_SLAVE_SDA_DE_REG  |=  I2C_SLAVE_SDA_PIN;              \
    I2C_SLAVE_SDA_CLR_REG  =  I2C_SLAVE_SDA_PIN;              \
} while (0)

#define SDA_RELEASE()   do {                                    \
    I2C_SLAVE_SDA_DIR_REG |= I2C_SLAVE_SDA_PIN;               \
} while (0)

/* =========================================================
 *  SCL Clock Stretch 操作宏
 *  SCL 同样为开漏：拉低 = 强制主机等待；释放 = 主机继续发时钟
 * ========================================================= */
#if I2C_SLAVE_CLOCK_STRETCH_EN
#define SCL_STRETCH()   do {                                    \
    I2C_SLAVE_SCL_DIR_REG &= ~I2C_SLAVE_SCL_PIN;              \
    I2C_SLAVE_SCL_DE_REG  |=  I2C_SLAVE_SCL_PIN;              \
    I2C_SLAVE_SCL_CLR_REG  =  I2C_SLAVE_SCL_PIN;              \
} while (0)
#define SCL_RELEASE()   do {                                    \
    I2C_SLAVE_SCL_DIR_REG |= I2C_SLAVE_SCL_PIN;               \
} while (0)
#else
#define SCL_STRETCH()   /* clock stretch disabled */
#define SCL_RELEASE()   /* clock stretch disabled */
#endif

/* =========================================================
 *  状态机定义
 * ========================================================= */
typedef enum {
    SLAVE_IDLE      = 0,
    SLAVE_RECV_ADDR,    /* 接收地址字节（7-bit addr + R/W） */
    SLAVE_RECV_DATA,    /* 接收数据字节 */
    SLAVE_SEND_DATA,    /* 发送数据字节（主机 READ 操作） */
} i2c_slave_state_t;

/* =========================================================
 *  内部状态变量
 * ========================================================= */
static volatile i2c_slave_state_t s_state;

/*
 * bit_cnt 语义：
 *   接收模式（RECV_ADDR / RECV_DATA）：
 *     0-7 → 已采样 bit 数（SCL 上升沿递增）
 *     8   → 字节完整，等 SCL 下降沿发 ACK
 *     9   → ACK 时钟完成，等 SCL 下降沿进入下一字节
 *   发送模式（SEND_DATA）：
 *     0   → 当前字节已装载，等下一个 SCL 下降沿驱动 MSB；
 *           Clock Stretch 等待 tx 数据时也复用此值
 *     1-7 → 已驱动前 bit_cnt 个数据位，等下一个 SCL 下降沿驱动 bit(7-bit_cnt)
 *     8   → bit0 已驱动，等当前 SCL 上升沿完成最后一个数据位采样
 *     9   → 8 个数据位已发送完，等下一个 SCL 下降沿释放 SDA 给主机 ACK/NACK
 *     10  → SDA 已释放，等第 9 个 SCL 上升沿采样主机 ACK/NACK
 */
static volatile uint8_t  s_bit_cnt;
static volatile uint8_t  s_shift_reg;
static volatile uint8_t  s_rw;          /* 0=主机写, 1=主机读 */
static volatile uint8_t  s_last_scl;
static volatile uint8_t  s_last_sda;
static volatile uint8_t  s_stretch_active; /* 1=正在 Clock Stretch 等待 tx 数据 */
static volatile uint8_t  s_int_disabled;   /* 1=ISR 因假触发已关闭 PORTINTEN，等 poll 重开 */
static volatile uint8_t  s_restart_arm;    /* 1=字节边界已看到 SDA 在 SCL=LOW 回高，可接受 repeated START */

/* =========================================================
 *  接收环形缓冲区（单生产者 ISR / 单消费者主任务，无锁）
 * ========================================================= */
AT(.slave_i2c.pkt_queue)
static volatile uint8_t  s_rx_buf[I2C_SLAVE_RX_BUF_SIZE];
static volatile uint16_t s_rx_w;        /* ISR 写指针 */
static volatile uint16_t s_rx_r;        /* 主任务读指针 */

/* =========================================================
 *  帧元数据队列
 *  每收到一帧（STOP 触发）将帧的起始位置和长度入队。
 *  队列允许同时追踪 I2C_SLAVE_PKT_QUEUE_SIZE 个待读帧，
 *  避免主任务轮询不及时时丢失早到帧的帧长信息。
 * ========================================================= */
typedef struct {
    uint16_t start;   /* 帧首字节在 s_rx_buf 中的位置 */
    uint16_t len;     /* 帧字节数 */
} i2c_pkt_info_t;

AT(.slave_i2c.pkt_queue)
static volatile i2c_pkt_info_t s_pkt_queue[I2C_SLAVE_PKT_QUEUE_SIZE];
static volatile uint8_t  s_pkt_w;       /* ISR 写队列指针 */
static volatile uint8_t  s_pkt_r;       /* 主任务读队列指针 */
static volatile uint16_t s_pkt_start;   /* 当前帧在 rx_buf 中的起始位置（帧期间暂存） */
static volatile uint32_t s_rx_ovf_cnt;  /* rx_buf 满导致的数据字节丢弃次数 */
static volatile uint32_t s_pkt_ovf_cnt; /* pkt_queue 满导致的整帧丢弃次数 */
static volatile uint8_t  s_reg_sel;     /* 当前寄存器指针（主机 WRITE 的第 1 字节） */
static volatile uint8_t  s_pending_reg; /* 当前 READ 请求等待刷新的寄存器号 */
static volatile uint8_t  s_need_refresh;/* 1=主循环需要为 pending_reg 现算并回填数据 */

typedef struct {
    uint8_t valid;
    uint8_t reg;
    uint8_t len;
    uint8_t buf[I2C_SLAVE_TX_BUF_SIZE];
} i2c_reg_cache_t;
AT(.slave_i2c.pkt_queue)
static i2c_reg_cache_t   s_reg_cache[I2C_SLAVE_REG_CACHE_COUNT];

/* =========================================================
 *  超时检测（依赖 api_sys.h 中的 tmr5ms_cnt）
 * ========================================================= */
#if I2C_SLAVE_TIMEOUT_MS > 0
static volatile uint16_t s_last_scl_tick; /* 最近一次 SCL 边沿时的 tmr5ms_cnt */
#endif
#if I2C_SLAVE_CLOCK_STRETCH_EN && (I2C_SLAVE_STRETCH_TIMEOUT_MS > 0)
static volatile uint16_t s_stretch_start_tick; /* 最近一次进入 Clock Stretch 的时刻 */
#endif

/* tmr5ms_cnt 每 5ms +1，模减回绕安全 */
static inline uint16_t tmr5ms_elapsed_ms(uint16_t start_tick)
{
    return (uint16_t)((uint16_t)(tmr5ms_cnt - start_tick) * 5u);
}

/* =========================================================
 *  发送缓冲区（主任务填充，ISR 读取）
 * ========================================================= */
AT(.slave_i2c.pkt_queue)
static uint8_t           s_tx_buf[I2C_SLAVE_TX_BUF_SIZE];
static uint8_t           s_tx_len;
static volatile uint8_t  s_tx_idx;

/* =========================================================
 *  Debug 事件日志（I2C_SLAVE_DEBUG=1 时启用）
 *  ISR 中只写环形缓冲区（无 printf 也无 flash 访问），
 *  所有打印都发生在 bsp_i2c_slave_init / bsp_i2c_slave_poll 的主任务上下文，
 *  XIP 可用，因此格式串放普通 flash rodata 即可，无需进 com_rodata。
 * ========================================================= */
#if I2C_SLAVE_DEBUG

#define DBG_LOG_SIZE    128u    /* 必须为 2 的幂；留够空间避免边沿日志冲掉关键事件 */

/* 事件类型（ASCII 字符，打印直观） */
#define DBG_START       'S'    /* START 条件 */
#define DBG_STOP        'T'    /* STOP 条件，val=帧字节数 */
#define DBG_ADDR_OK     'A'    /* 地址匹配，val=原始地址字节，val2=R/W */
#define DBG_ADDR_NACK   'N'    /* 地址不匹配，val=收到的原始字节 */
#define DBG_DATA        'D'    /* 收到数据字节，val=字节值 */
#define DBG_WKUP        'W'    /* ISR 入口 GPIO 电平快照，val 保留，val2=SCL<<4|SDA */
#define DBG_FALSE       'F'    /* 假触发保护命中，val=(scl<<4|sda)，val2=state */
#define DBG_PEND        'P'    /* ISR 在 READ 路径写 s_pending_reg，val=reg，val2=state */
#define DBG_TX_PREP     'X'    /* reg_prepare_tx 完成，val=reg，val2=(tx_buf[0]) */
#define DBG_REG_SET     'R'    /* reg_set 入口，val=reg 请求，val2=s_pending_reg */
#define DBG_LOST        'L'    /* 字节中间疑似丢边沿，拒绝伪 START/STOP，val=bit_cnt，val2=state */

typedef struct {
    uint8_t type;
    uint8_t val;
    uint8_t val2;
} i2c_dbg_evt_t;

AT(.slave_i2c.logbuf)
static volatile i2c_dbg_evt_t s_dbg_buf[DBG_LOG_SIZE];
static volatile uint8_t  s_dbg_w;
static volatile uint8_t  s_dbg_r;
static volatile uint32_t s_dbg_isr_cnt;  /* ISR 总调用次数 */

/* ---------- 所有格式串放在 com_text，避免 XIP 访问死机 ---------- */
static const char s_str_init[]    = "[I2CS] init ADDR=0x%02X(7b)/0x%02X(W)/0x%02X(R)\n";
static const char s_str_regs[]    = "[I2CS] PORTINTEN=0x%08X PORTINTEDG=0x%08X\n";
static const char s_str_pins[]    =
    "[I2CS] SCL=" I2C_SLAVE_SCL_NAME "(" I2C_SLAVE_SCL_INT_NAME ") SDA="
    I2C_SLAVE_SDA_NAME "(" I2C_SLAVE_SDA_INT_NAME ")\n";
static const char s_str_gpio_a[]  = "[I2CS] GPIOA FEN=0x%08X DIR=0x%08X DE=0x%08X PU=0x%08X\n";
static const char s_str_gpio_b[]  = "[I2CS] GPIOB FEN=0x%08X DIR=0x%08X DE=0x%08X PU=0x%08X\n";
static const char s_str_wkup_reg[]= "[I2CS] WKUPCON=0x%08X WKUPEDG=0x%08X\n";
static const char s_str_timeout[] = "[I2CS] BUS TIMEOUT, state reset\n";
static const char s_str_heart[]   = "[I2CS] ISR total=%u PORTINTEDG=0x%X SCL=%d SDA=%d st=%d\n";
#if I2C_SLAVE_DEBUG_WKUP
static const char s_str_wkup[]    = "[I2CS] ISR wkup=0x%02X SCL=%d SDA=%d\n";
#endif
static const char s_str_start[]   = "[I2CS] >>> START\n";
static const char s_str_stop[]    = "[I2CS] <<< STOP (%d bytes)\n";
static const char s_str_addr_ok[] = "[I2CS] ADDR 0x%02X 7b=0x%02X %s [ACK]\n";
static const char s_str_rw_r[]    = "READ";
static const char s_str_rw_w[]    = "WRITE";
static const char s_str_nack[]    = "[I2CS] ADDR 0x%02X 7b=0x%02X [NACK want 0x%02X/8b=0x%02X]\n";
static const char s_str_data[]    = "[I2CS] DATA 0x%02X\n";
static const char s_str_rx_ovf[]  = "[I2CS] WARN rx_buf overflow +%u total=%u\n";
static const char s_str_pkt_ovf[] = "[I2CS] WARN pkt_queue overflow +%u total=%u\n";
static const char s_str_stretch_timeout[] =
    "[I2CS] WARN stretch timeout reg=0x%02X, use cached data\n";
static const char s_str_false[]   = "[I2CS] FALSE trig scl=%d sda=%d st=%d\n";
static const char s_str_pend[]    = "[I2CS] PEND set reg=0x%02X st=%d\n";
static const char s_str_tx_prep[] = "[I2CS] TX  prep reg=0x%02X buf0=0x%02X\n";
static const char s_str_reg_set[] = "[I2CS] REG set reg=0x%02X pend=0x%02X\n";
static const char s_str_lost[]    = "[I2CS] LOST edges rejected bit=%d st=%d\n";

/* 6 个 DBG_LOG 站点共用一份函数体，去掉 inline 关键字避免在 ISR 中被重复展开 */
AT(.com_text.i2c_slave)
static void dbg_push(uint8_t type, uint8_t val, uint8_t val2)
{
    uint8_t nw = (s_dbg_w + 1u) & (DBG_LOG_SIZE - 1u);
    if (nw != s_dbg_r) {
        s_dbg_buf[s_dbg_w].type = type;
        s_dbg_buf[s_dbg_w].val  = val;
        s_dbg_buf[s_dbg_w].val2 = val2;
        s_dbg_w = nw;
    }
}

#define DBG_LOG(t, v, v2)   dbg_push((t), (v), (v2))
#define DBG_ISR_INC()       (s_dbg_isr_cnt++)

#else  /* I2C_SLAVE_DEBUG == 0 */

#define DBG_LOG(t, v, v2)   /* nothing */
#define DBG_ISR_INC()       /* nothing */

#endif /* I2C_SLAVE_DEBUG */

/* =========================================================
 *  内联辅助函数
 * ========================================================= */
#if I2C_SLAVE_CLOCK_STRETCH_EN
#define AT_I2C_SLAVE_COM_IF_NO_STRETCH   /* 主任务专用，放普通 flash */
#else
#define AT_I2C_SLAVE_COM_IF_NO_STRETCH   AT(.com_text.i2c_slave)
#endif

AT(.com_text.i2c_slave)
static inline void drive_sda_bit(uint8_t bit)
{
    if (bit) {
        SDA_RELEASE();
    } else {
        SDA_PULL_LOW();
    }
}

AT(.com_text.i2c_slave)
static inline void tx_load_byte(uint8_t idx)
{
    s_shift_reg = (idx < s_tx_len) ? s_tx_buf[idx] : 0xFFu;
}

static inline void tx_copy_buf(const uint8_t *buf, uint8_t len)
{
    uint8_t copy_len = (len < I2C_SLAVE_TX_BUF_SIZE) ? len : I2C_SLAVE_TX_BUF_SIZE;
    for (uint8_t i = 0u; i < copy_len; i++) {
        s_tx_buf[i] = buf[i];
    }
    s_tx_len = copy_len;
}

AT_I2C_SLAVE_COM_IF_NO_STRETCH
static uint8_t reg_build_payload_cached(uint8_t reg, uint8_t *buf, uint8_t max_len)
{
    if (buf == NULL || max_len == 0u) {
        return 0u;
    }
    for (uint8_t idx = 0u; idx < I2C_SLAVE_REG_CACHE_COUNT; idx++) {
        if (s_reg_cache[idx].valid && s_reg_cache[idx].reg == reg) {
            uint8_t copy_len = s_reg_cache[idx].len;
            if (copy_len > max_len) {
                copy_len = max_len;
            }
            for (uint8_t i = 0u; i < copy_len; i++) {
                buf[i] = s_reg_cache[idx].buf[i];
            }
            return copy_len;
        }
    }
    buf[0] = 0x00u;
    return 1u;
}

AT_I2C_SLAVE_COM_IF_NO_STRETCH
static void reg_prepare_tx(uint8_t reg)
{
    s_reg_sel = reg;
    s_tx_len  = reg_build_payload_cached(reg, s_tx_buf, I2C_SLAVE_TX_BUF_SIZE);
    DBG_LOG(DBG_TX_PREP, reg, s_tx_buf[0]);
}

AT_I2C_SLAVE_COM_IF_NO_STRETCH
static void start_tx_first_byte(void)
{
    s_tx_idx = 0u;
    tx_load_byte(0u);
    drive_sda_bit((s_shift_reg >> 7u) & 1u);
    s_bit_cnt = 1u;
}

#if I2C_SLAVE_CLOCK_STRETCH_EN
static inline void stretch_send_ready(void)
{
    start_tx_first_byte();
    s_need_refresh   = 0u;
    s_stretch_active = 0u;
    SCL_RELEASE();
}
#endif

/* 向接收缓冲区写一字节（缓冲区满时计数并丢弃） */
AT(.com_text.i2c_slave)
static inline void rx_push(uint8_t byte)
{
    uint16_t next_w = (s_rx_w + 1u) & (I2C_SLAVE_RX_BUF_SIZE - 1u);
    if (next_w != s_rx_r) {
        s_rx_buf[s_rx_w] = byte;
        s_rx_w = next_w;
    } else {
        s_rx_ovf_cnt++;
    }
}

AT(.com_text.i2c_slave)
static uint16_t finalize_rx_frame(uint8_t push_pkt)
{
    uint16_t w = s_rx_w;
    uint16_t len = 0u;
    if (w != s_pkt_start) {
        len = (w - s_pkt_start) & (I2C_SLAVE_RX_BUF_SIZE - 1u);
        if (push_pkt) {
            uint8_t next_w = (s_pkt_w + 1u) & (I2C_SLAVE_PKT_QUEUE_SIZE - 1u);
            if (next_w != s_pkt_r) {
                s_pkt_queue[s_pkt_w].start = s_pkt_start;
                s_pkt_queue[s_pkt_w].len   = len;
                s_pkt_w = next_w;
            } else {
                s_pkt_ovf_cnt++;
            }
        }
        s_reg_sel = s_rx_buf[s_pkt_start & (I2C_SLAVE_RX_BUF_SIZE - 1u)];
        s_pkt_start = w;
    }
    return len;
}

static inline void sync_portint_edge_to_level(void)
{
    if (SCL_IS_H()) {
        I2C_SLAVE_PORTINTEDG |=  I2C_SLAVE_SCL_INT_BIT;
    } else {
        I2C_SLAVE_PORTINTEDG &= ~I2C_SLAVE_SCL_INT_BIT;
    }
    if (SDA_IS_H()) {
        I2C_SLAVE_PORTINTEDG |=  I2C_SLAVE_SDA_INT_BIT;
    } else {
        I2C_SLAVE_PORTINTEDG &= ~I2C_SLAVE_SDA_INT_BIT;
    }
}

static inline void recover_bus_to_idle(void)
{
    SDA_RELEASE();
    SCL_RELEASE();
    s_stretch_active = 0u;
    s_need_refresh   = 0u;
    s_restart_arm    = 0u;
    s_int_disabled   = 0u;
    s_state          = SLAVE_IDLE;
    s_bit_cnt        = 0u;
    s_shift_reg      = 0u;
    s_rw             = 0u;
    s_tx_idx         = 0u;
    s_rx_w      = s_pkt_start;
    s_pkt_start = s_rx_w;
    s_last_scl = SCL_IS_H() ? 1u : 0u;
    s_last_sda = SDA_IS_H() ? 1u : 0u;
    sync_portint_edge_to_level();
    WKUPCPND = BIT(22) | BIT(23);
    I2C_SLAVE_PORTINTEN |= (I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);
#if I2C_SLAVE_TIMEOUT_MS > 0
    s_last_scl_tick = tmr5ms_cnt;
#endif
}

/* =========================================================
 *  START / STOP 处理
 * ========================================================= */
AT(.com_text.i2c_slave)
static inline void on_start(void)
{
    if (s_state == SLAVE_RECV_DATA) {
        finalize_rx_frame(1u);
    }
    if (s_state == SLAVE_SEND_DATA) {
        s_need_refresh = 0u;
    }
    s_restart_arm = 0u;
    DBG_LOG(DBG_START, 0u, 0u);
    SDA_RELEASE();
    SCL_RELEASE();
    s_stretch_active = 0u;
    s_state     = SLAVE_RECV_ADDR;
    s_bit_cnt   = 0;
    s_shift_reg = 0;
}

AT(.com_text.i2c_slave)
static inline void isr_drop_to_idle(void)
{
    SDA_RELEASE();
    SCL_RELEASE();
    s_stretch_active = 0u;
    s_restart_arm    = 0u;
    s_need_refresh   = 0u;
    s_rx_w           = s_pkt_start;
    s_bit_cnt        = 0u;
    s_shift_reg      = 0u;
    s_state          = SLAVE_IDLE;
}

AT(.com_text.i2c_slave)
static inline void on_stop(void)
{
    SDA_RELEASE();
    SCL_RELEASE();
    s_stretch_active = 0u;
    s_restart_arm = 0u;
    if (s_state == SLAVE_SEND_DATA) {
        s_need_refresh = 0u;
    }
    uint16_t len = 0u;
    if (s_state == SLAVE_RECV_DATA) {
        len = finalize_rx_frame(1u);
    }
    DBG_LOG(DBG_STOP, (uint8_t)len, 0u);
    s_state = SLAVE_IDLE;
}

/* =========================================================
 *  SCL 上升沿处理（采样 SDA 数据）
 * ========================================================= */
AT(.com_text.i2c_slave)
static inline void on_scl_rise(uint8_t sda)
{
    switch (s_state) {
    case SLAVE_RECV_ADDR:
    case SLAVE_RECV_DATA:
        if (s_bit_cnt < 8u) {
            if (s_state == SLAVE_RECV_DATA && s_bit_cnt == 0u && !s_restart_arm) {
                s_restart_arm = 0u;
            }
            s_shift_reg = (s_shift_reg << 1u) | (sda ? 1u : 0u);
            s_bit_cnt++;
        }
        break;
    case SLAVE_SEND_DATA:
        if (s_bit_cnt == 8u) {
            s_bit_cnt = 9u;
        } else if (s_bit_cnt == 10u) {
            if (sda) {
                SDA_RELEASE();
                s_state = SLAVE_IDLE;
                s_bit_cnt = 0u;
            } else {
                s_tx_idx++;
                tx_load_byte(s_tx_idx);
                s_bit_cnt = 0u;
            }
        }
        break;
    default:
        break;
    }
}

/* =========================================================
 *  SCL 下降沿处理（驱动 SDA：ACK 或数据 bit）
 * ========================================================= */
AT(.com_text.i2c_slave)
static inline void on_scl_fall(void)
{
    switch (s_state) {
    case SLAVE_RECV_ADDR:
        if (s_bit_cnt == 8u) {
            uint8_t addr = s_shift_reg >> 1u;
            s_rw = s_shift_reg & 0x01u;
            if (addr == I2C_SLAVE_ADDR) {
                DBG_LOG(DBG_ADDR_OK, s_shift_reg, s_rw);
                SDA_PULL_LOW();
                s_bit_cnt = 9u;
            } else {
                DBG_LOG(DBG_ADDR_NACK, s_shift_reg, (uint8_t)(I2C_SLAVE_ADDR << 1u));
                SDA_RELEASE();
                s_state = SLAVE_IDLE;
            }
        } else if (s_bit_cnt == 9u) {
            if (s_rw == 0u) {
                SDA_RELEASE();
                s_pkt_start = s_rx_w;
                s_state     = SLAVE_RECV_DATA;
                s_bit_cnt   = 0u;
                s_shift_reg = 0u;
                s_restart_arm = 0u;
            } else {
                s_state  = SLAVE_SEND_DATA;
                s_tx_idx = 0u;
#if I2C_SLAVE_CLOCK_STRETCH_EN
                s_pending_reg  = s_reg_sel;
                s_need_refresh = 1u;
                DBG_LOG(DBG_PEND, s_reg_sel, (uint8_t)s_state);
#if I2C_SLAVE_STRETCH_TIMEOUT_MS > 0
                s_stretch_start_tick = tmr5ms_cnt;
#endif
                SCL_STRETCH();
                s_stretch_active = 1u;
                s_bit_cnt = 0u;
#else
                reg_prepare_tx(s_reg_sel);
                start_tx_first_byte();
#endif
            }
        }
        break;
    case SLAVE_RECV_DATA:
        if (s_bit_cnt > 0u && s_bit_cnt < 8u && s_restart_arm) {
            s_restart_arm = 0u;
        }
        if (s_bit_cnt == 8u) {
            DBG_LOG(DBG_DATA, s_shift_reg, 0u);
            rx_push(s_shift_reg);
            SDA_PULL_LOW();
            s_bit_cnt = 9u;
        } else if (s_bit_cnt == 9u) {
            SDA_RELEASE();
            s_bit_cnt   = 0u;
            s_shift_reg = 0u;
            s_restart_arm = 0u;
        }
        break;
    case SLAVE_SEND_DATA:
        if (s_bit_cnt == 0u) {
            drive_sda_bit((s_shift_reg >> 7u) & 1u);
            s_bit_cnt = 1u;
        } else if (s_bit_cnt < 8u) {
            drive_sda_bit((s_shift_reg >> (7u - s_bit_cnt)) & 1u);
            s_bit_cnt++;
        } else if (s_bit_cnt == 9u) {
            SDA_RELEASE();
            s_bit_cnt = 10u;
        }
        break;
    default:
        break;
    }
}

/* =========================================================
 *  PORT 中断 ISR
 * ========================================================= */
AT(.com_text.i2c_slave)
void bsp_i2c_slave_isr(void)
{
    WKUPCPND = BIT(22) | BIT(23);
    uint8_t scl = SCL_IS_H() ? 1u : 0u;
    uint8_t sda = SDA_IS_H() ? 1u : 0u;

    if (sda == s_last_sda && scl == s_last_scl) {
        DBG_LOG(DBG_FALSE, (uint8_t)((scl << 4u) | sda), (uint8_t)s_state);
        I2C_SLAVE_PORTINTEN &= ~(I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);
        s_int_disabled = 1u;
        return;
    }

    DBG_ISR_INC();

#if I2C_SLAVE_DEBUG && I2C_SLAVE_DEBUG_WKUP
    {
        uint32_t wkup_snap = WKUPEDG;
        DBG_LOG(DBG_WKUP, (uint8_t)(wkup_snap >> 16), (uint8_t)((scl << 4u) | sda));
    }
#endif

    if (sda != s_last_sda) {
        if (!sda && !scl && s_state == SLAVE_RECV_DATA && s_bit_cnt == 0u) {
            s_restart_arm = 0u;
        } else if (sda && !scl && s_state == SLAVE_RECV_DATA && s_bit_cnt == 0u) {
            s_restart_arm = 1u;
        }
        if (scl && (s_last_scl || ((!sda) && s_restart_arm))) {
            uint8_t mid_byte = ((s_state == SLAVE_RECV_ADDR)
                             || (s_state == SLAVE_RECV_DATA && !s_restart_arm))
                             && s_bit_cnt >= 1u && s_bit_cnt <= 8u;
            if (mid_byte) {
                DBG_LOG(DBG_LOST, s_bit_cnt, (uint8_t)s_state);
                isr_drop_to_idle();
            } else if (!sda) {
                on_start();
            } else {
                on_stop();
            }
        }
        s_last_sda = sda;
        I2C_SLAVE_PORTINTEDG ^= I2C_SLAVE_SDA_INT_BIT;
    }

    if (scl != s_last_scl) {
        if (scl) {
            on_scl_rise(sda);
        } else {
            on_scl_fall();
        }
        s_last_scl = scl;
        I2C_SLAVE_PORTINTEDG ^= I2C_SLAVE_SCL_INT_BIT;
#if I2C_SLAVE_TIMEOUT_MS > 0
        s_last_scl_tick = tmr5ms_cnt;
#endif
    }
}

/* =========================================================
 *  公共 API
 * ========================================================= */

void bsp_i2c_slave_init(void)
{
    I2C_SLAVE_SCL_FEN_REG &= ~I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SDA_FEN_REG &= ~I2C_SLAVE_SDA_PIN;

    I2C_SLAVE_SCL_DE_REG  |= I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SCL_DIR_REG |= I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SCL_PU_REG  |= I2C_SLAVE_SCL_PIN;

    I2C_SLAVE_SDA_DE_REG  |= I2C_SLAVE_SDA_PIN;
    I2C_SLAVE_SDA_DIR_REG |= I2C_SLAVE_SDA_PIN;
    I2C_SLAVE_SDA_PU_REG  |= I2C_SLAVE_SDA_PIN;

    s_state          = SLAVE_IDLE;
    s_bit_cnt        = 0u;
    s_shift_reg      = 0u;
    s_last_scl       = SCL_IS_H() ? 1u : 0u;
    s_last_sda       = SDA_IS_H() ? 1u : 0u;
    s_stretch_active = 0u;
    s_int_disabled   = 0u;
    s_restart_arm    = 0u;
    s_rx_w           = 0u;
    s_rx_r           = 0u;
    s_pkt_start      = 0u;
    s_pkt_w          = 0u;
    s_pkt_r          = 0u;
    s_rx_ovf_cnt     = 0u;
    s_pkt_ovf_cnt    = 0u;
    s_reg_sel        = I2C_SLAVE_REG_BAT_LEVEL;
    s_pending_reg    = I2C_SLAVE_REG_BAT_LEVEL;
    s_need_refresh   = 0u;
    s_tx_len         = 0u;
    s_tx_idx         = 0u;
#if I2C_SLAVE_TIMEOUT_MS > 0
    s_last_scl_tick  = 0u;
#endif
#if I2C_SLAVE_CLOCK_STRETCH_EN && (I2C_SLAVE_STRETCH_TIMEOUT_MS > 0)
    s_stretch_start_tick = 0u;
#endif
    for (uint8_t idx = 0u; idx < I2C_SLAVE_REG_CACHE_COUNT; idx++) {
        s_reg_cache[idx].valid = 0u;
        s_reg_cache[idx].reg   = 0u;
        s_reg_cache[idx].len   = 0u;
    }

    reg_prepare_tx(s_reg_sel);
    sync_portint_edge_to_level();
    WKUPCPND = (0xffu << 16);
    I2C_SLAVE_PORTINTEN  |=  (I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);
    sys_irq_init(IRQ_PORT_VECTOR, 0, bsp_i2c_slave_isr);

    WKUPCON &= ~(I2C_SLAVE_SCL_WKUP_SRC_BIT | I2C_SLAVE_SDA_WKUP_SRC_BIT);
    WKUPEDG &= ~(I2C_SLAVE_SCL_WKUP_SRC_BIT | I2C_SLAVE_SDA_WKUP_SRC_BIT);
    WKUPEDG |=  BIT(6);
    WKUPCON |=  BIT(6);
    WKUPEDG &= ~BIT(7);
    WKUPCON |=  BIT(7);
    WKUPCON |=  BIT(16);

#if I2C_SLAVE_DEBUG
    s_dbg_w = 0u;
    s_dbg_r = 0u;
    s_dbg_isr_cnt = 0u;
    printf(s_str_init,
           (unsigned)I2C_SLAVE_ADDR,
           (unsigned)(I2C_SLAVE_ADDR << 1u),
           (unsigned)((I2C_SLAVE_ADDR << 1u) | 1u));
    printf(s_str_regs,
           (unsigned)I2C_SLAVE_PORTINTEN, (unsigned)I2C_SLAVE_PORTINTEDG);
    printf(s_str_pins);
    printf(s_str_gpio_a,
           (unsigned)GPIOAFEN, (unsigned)GPIOADIR,
           (unsigned)GPIOADE,  (unsigned)GPIOAPU);
    printf(s_str_gpio_b,
           (unsigned)GPIOBFEN, (unsigned)GPIOBDIR,
           (unsigned)GPIOBDE,  (unsigned)GPIOBPU);
    printf(s_str_wkup_reg, (unsigned)WKUPCON, (unsigned)WKUPEDG);
#endif
}

void bsp_i2c_slave_poll(void)
{
    if (s_int_disabled) {
        s_int_disabled = 0u;
        sync_portint_edge_to_level();
        WKUPCPND = BIT(22) | BIT(23);
        I2C_SLAVE_PORTINTEN |= (I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);
    }

#if I2C_SLAVE_CLOCK_STRETCH_EN && (I2C_SLAVE_STRETCH_TIMEOUT_MS > 0)
    if (s_stretch_active && tmr5ms_elapsed_ms(s_stretch_start_tick) >= I2C_SLAVE_STRETCH_TIMEOUT_MS) {
        reg_prepare_tx(s_pending_reg);
        stretch_send_ready();
#if I2C_SLAVE_DEBUG
        printf(s_str_stretch_timeout, (unsigned)s_pending_reg);
#endif
    }
#endif

#if I2C_SLAVE_TIMEOUT_MS > 0
    if (s_state != SLAVE_IDLE && tmr5ms_elapsed_ms(s_last_scl_tick) >= I2C_SLAVE_TIMEOUT_MS) {
        recover_bus_to_idle();
#if I2C_SLAVE_DEBUG
        printf(s_str_timeout);
#endif
    }
#endif

#if I2C_SLAVE_DEBUG
    static uint32_t s_dbg_last_cnt = 0u;
    static uint32_t s_dbg_last_rx_ovf = 0u;
    static uint32_t s_dbg_last_pkt_ovf = 0u;
    uint32_t cur_cnt = s_dbg_isr_cnt;
    uint32_t cur_rx_ovf = s_rx_ovf_cnt;
    uint32_t cur_pkt_ovf = s_pkt_ovf_cnt;
    if (cur_cnt - s_dbg_last_cnt >= 50u) {
        printf(s_str_heart,
               (unsigned)cur_cnt,
               (unsigned)I2C_SLAVE_PORTINTEDG,
               SCL_IS_H() ? 1 : 0,
               SDA_IS_H() ? 1 : 0,
               (int)s_state);
        s_dbg_last_cnt = cur_cnt;
    }
    if (cur_rx_ovf != s_dbg_last_rx_ovf) {
        printf(s_str_rx_ovf,
               (unsigned)(cur_rx_ovf - s_dbg_last_rx_ovf),
               (unsigned)cur_rx_ovf);
        s_dbg_last_rx_ovf = cur_rx_ovf;
    }
    if (cur_pkt_ovf != s_dbg_last_pkt_ovf) {
        printf(s_str_pkt_ovf,
               (unsigned)(cur_pkt_ovf - s_dbg_last_pkt_ovf),
               (unsigned)cur_pkt_ovf);
        s_dbg_last_pkt_ovf = cur_pkt_ovf;
    }

    while (s_dbg_r != s_dbg_w) {
        i2c_dbg_evt_t e;
        e.type = s_dbg_buf[s_dbg_r].type;
        e.val  = s_dbg_buf[s_dbg_r].val;
        e.val2 = s_dbg_buf[s_dbg_r].val2;
        s_dbg_r = (s_dbg_r + 1u) & (DBG_LOG_SIZE - 1u);
        switch (e.type) {
#if I2C_SLAVE_DEBUG_WKUP
        case DBG_WKUP:
            printf(s_str_wkup, e.val, (e.val2 >> 4) & 1, e.val2 & 1);
            break;
#endif
        case DBG_START:  printf(s_str_start); break;
        case DBG_STOP:   printf(s_str_stop, e.val); break;
        case DBG_ADDR_OK:
            printf(s_str_addr_ok, e.val, e.val >> 1u, e.val2 ? s_str_rw_r : s_str_rw_w);
            break;
        case DBG_ADDR_NACK:
            printf(s_str_nack, e.val, e.val >> 1u, (unsigned)I2C_SLAVE_ADDR, e.val2);
            break;
        case DBG_DATA:    printf(s_str_data, e.val); break;
        case DBG_FALSE:   printf(s_str_false, (e.val >> 4) & 1, e.val & 1, (int)e.val2); break;
        case DBG_PEND:    printf(s_str_pend, e.val, (int)e.val2); break;
        case DBG_TX_PREP: printf(s_str_tx_prep, e.val, e.val2); break;
        case DBG_REG_SET: printf(s_str_reg_set, e.val, e.val2); break;
        case DBG_LOST:    printf(s_str_lost, (int)e.val, (int)e.val2); break;
        default: break;
        }
    }
#endif /* I2C_SLAVE_DEBUG */
}

bool bsp_i2c_slave_rx_available(void)
{
    return (s_pkt_w != s_pkt_r);
}

uint8_t bsp_i2c_slave_rx_read(uint8_t *buf, uint8_t max_len)
{
    if (s_pkt_w == s_pkt_r || buf == NULL || max_len == 0u) {
        return 0u;
    }
    uint16_t start = s_pkt_queue[s_pkt_r].start;
    uint16_t len   = s_pkt_queue[s_pkt_r].len;
    uint8_t  copy  = (uint8_t)((len < max_len) ? len : max_len);
    for (uint8_t i = 0u; i < copy; i++) {
        buf[i] = s_rx_buf[(start + i) & (I2C_SLAVE_RX_BUF_SIZE - 1u)];
    }
    s_rx_r = (start + len) & (I2C_SLAVE_RX_BUF_SIZE - 1u);
    s_pkt_r = (s_pkt_r + 1u) & (I2C_SLAVE_PKT_QUEUE_SIZE - 1u);
    return copy;
}

void bsp_i2c_slave_tx_set(const uint8_t *buf, uint8_t len)
{
    if (buf == NULL || len == 0u) {
        return;
    }
    tx_copy_buf(buf, len);
#if I2C_SLAVE_CLOCK_STRETCH_EN
    if (s_stretch_active && s_state == SLAVE_SEND_DATA) {
        stretch_send_ready();
    }
#endif
}

void bsp_i2c_slave_reg_set(uint8_t reg, const uint8_t *buf, uint8_t len)
{
    if (buf == NULL || len == 0u) {
        return;
    }
    DBG_LOG(DBG_REG_SET, reg, s_pending_reg);
    uint8_t slot = I2C_SLAVE_REG_CACHE_COUNT;
    uint8_t copy_len = len;
    if (copy_len > I2C_SLAVE_TX_BUF_SIZE) {
        copy_len = I2C_SLAVE_TX_BUF_SIZE;
    }
    for (uint8_t idx = 0u; idx < I2C_SLAVE_REG_CACHE_COUNT; idx++) {
        if (s_reg_cache[idx].valid && s_reg_cache[idx].reg == reg) {
            slot = idx; break;
        }
        if ((slot == I2C_SLAVE_REG_CACHE_COUNT) && !s_reg_cache[idx].valid) {
            slot = idx;
        }
    }
    if (slot == I2C_SLAVE_REG_CACHE_COUNT) {
        slot = 0u;
    }
    s_reg_cache[slot].valid = 1u;
    s_reg_cache[slot].reg   = reg;
    s_reg_cache[slot].len   = copy_len;
    for (uint8_t i = 0u; i < copy_len; i++) {
        s_reg_cache[slot].buf[i] = buf[i];
    }
    if (reg == s_pending_reg) {
        reg_prepare_tx(reg);
        s_need_refresh = 0u;
#if I2C_SLAVE_CLOCK_STRETCH_EN
        if (s_stretch_active && s_state == SLAVE_SEND_DATA) {
            stretch_send_ready();
        }
#endif
    }
}

bool bsp_i2c_slave_refresh_pending(void)
{
    return s_need_refresh ? true : false;
}

uint8_t bsp_i2c_slave_get_pending_reg(void)
{
    return s_pending_reg;
}

bool bsp_i2c_slave_clock_stretch_enabled(void)
{
#if I2C_SLAVE_CLOCK_STRETCH_EN
    return true;
#else
    return false;
#endif
}

#endif /* BSP_I2C_SLAVE_EN */
```

</details>

---

*文档版本：v1.3 | 适用 SDK：SDK_BT895X_TPV_LEA_STANDARD_SOUNDBAR_S20482_20260330*

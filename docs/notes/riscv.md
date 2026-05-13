---
title: RISC-V 嵌入式开发笔记
description: RISC-V 架构速查：ISA 扩展、ABI 寄存器、CSR 操作、Trap 处理、常用 MCU 对比与工具链配置
date: 2026-05-13
tags: [嵌入式, RISC-V]
order: 7
---

# RISC-V 嵌入式开发笔记

> RISC-V 是开源指令集架构（ISA），正在嵌入式领域快速普及。常见芯片：GD32VF103、CH32V003/V307、ESP32-C3/C6、WCH 系列。

## 架构概览

### 基础指令集

| ISA | 位宽 | 整数指令集 | 说明 |
|-----|------|-----------|------|
| RV32I | 32 位 | 47 条基础整数指令 | 最精简，低端 MCU |
| RV32IM | 32 位 | + 乘除法（M 扩展） | 大多数 MCU 选用 |
| RV32IMC | 32 位 | + 压缩指令（C 扩展） | 节省 Flash，主流方案 |
| RV32IMAC | 32 位 | + 原子操作（A 扩展） | FreeRTOS SMP 需要 |
| RV64GC | 64 位 | 通用扩展包 | Linux 应用处理器 |

### 寄存器

RISC-V 有 32 个通用整数寄存器，ABI 名称（调用约定）：

| 寄存器 | ABI 名 | 用途 | 调用者保存 |
|--------|--------|------|-----------|
| x0 | zero | 硬连线 0，写入丢弃 | — |
| x1 | ra | 返回地址 | 是 |
| x2 | sp | 栈指针 | 否（被调用者） |
| x3 | gp | 全局指针 | — |
| x4 | tp | 线程指针 | — |
| x5-x7 | t0-t2 | 临时寄存器 | 是 |
| x8 | s0/fp | 帧指针 / 保存寄存器 | 否 |
| x9 | s1 | 保存寄存器 | 否 |
| x10-x11 | a0-a1 | 函数参数 / 返回值 | 是 |
| x12-x17 | a2-a7 | 函数参数 | 是 |
| x18-x27 | s2-s11 | 保存寄存器 | 否 |
| x28-x31 | t3-t6 | 临时寄存器 | 是 |

> "调用者保存"：调用函数前由调用者自行保存；"被调用者保存"：函数内部使用时必须先保存并在返回前恢复。

### CSR（控制和状态寄存器）

```asm
# 读 CSR
csrr  t0, mstatus      # 读 mstatus → t0
csrr  t0, mcause       # 读异常原因
csrr  t0, mepc         # 读异常返回地址

# 写 CSR
csrw  mstatus, t0      # t0 → mstatus

# 置位（不影响其他位）
csrs  mstatus, t0      # mstatus |= t0

# 清位
csrc  mstatus, t0      # mstatus &= ~t0

# 原子读改写
csrrw  t1, mstatus, t0  # t1 = mstatus; mstatus = t0
csrrsi t0, mstatus, 8   # 读 mstatus 并置位 bit3（MIE，全局中断使能）
csrrci t0, mstatus, 8   # 读 mstatus 并清位 bit3（禁用全局中断）
```

常用 CSR：

| CSR | 说明 |
|-----|------|
| `mstatus` | 机器模式状态寄存器，bit3(MIE) = 全局中断使能 |
| `mie` | 中断使能，分别控制外部/定时器/软件中断 |
| `mip` | 中断挂起状态（只读） |
| `mcause` | 异常/中断原因（bit31=1 为中断） |
| `mepc` | 异常返回地址 |
| `mtval` | 异常附加信息（如出错地址） |
| `mtvec` | 中断向量表基址 |
| `cycle` | 周期计数器（64 位） |
| `time` | 实时时间（64 位） |
| `instret` | 退休指令计数（性能分析） |

## 工具链

### 安装（Ubuntu / WSL）

```bash
# 方式一：发行版包管理器（版本可能较旧）
sudo apt install gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf

# 方式二：xPack 预编译工具链（推荐，版本新）
# 前往 https://github.com/xpack-dev-tools/riscv-none-elf-gcc-xpack/releases
# 下载对应平台压缩包，解压后加入 PATH

# 方式三：SiFive 工具链（RV32/64 均支持）
# https://www.sifive.com/software

# 验证
riscv64-unknown-elf-gcc --version
riscv-none-elf-gcc --version
```

### 常用编译选项

```makefile
# RV32IMC（Cortex-M 类似规模的 MCU）
CC     = riscv-none-elf-gcc
CFLAGS = -march=rv32imac_zicsr -mabi=ilp32 -O2 \
         -ffunction-sections -fdata-sections -Wall

# RV64GC（高性能，如 JH7110）
CFLAGS = -march=rv64gc -mabi=lp64d -O2

# 链接
LDFLAGS = -T link.ld -Wl,--gc-sections -nostartfiles

# 生成反汇编（调试必备）
riscv-none-elf-objdump -d firmware.elf > firmware.S

# 查看段大小
riscv-none-elf-size firmware.elf
```

### 反汇编对照

```bash
# 反汇编 ELF（带源码行号）
riscv-none-elf-objdump -dS firmware.elf | less

# 反汇编原始 bin（无符号信息时）
riscv-none-elf-objdump -D -b binary -m riscv:rv32 firmware.bin

# 查看所有段
riscv-none-elf-readelf -S firmware.elf
```

## 汇编基础

```asm
# 加载立即数
li   t0, 0x12345678    # 伪指令，编译器拆成 lui + addi

# 内存访问
lw   t0, 0(a0)         # 从 a0 地址加载 32 位
lh   t0, 2(a0)         # 加载 16 位（符号扩展）
lhu  t0, 2(a0)         # 加载 16 位（零扩展）
lb   t0, 1(a0)         # 加载 8 位
sw   t1, 0(a0)         # 存储 32 位
sh   t1, 2(a0)         # 存储 16 位
sb   t1, 1(a0)         # 存储 8 位

# 算术
add  t0, t1, t2        # t0 = t1 + t2
addi t0, t1, -4        # t0 = t1 - 4
sub  t0, t1, t2
mul  t0, t1, t2        # 需要 M 扩展
div  t0, t1, t2
rem  t0, t1, t2

# 位操作
and  t0, t1, t2
or   t0, t1, t2
xor  t0, t1, t2
sll  t0, t1, t2        # 逻辑左移
srl  t0, t1, t2        # 逻辑右移（零填充）
sra  t0, t1, t2        # 算术右移（符号扩展）

# 分支
beq  t0, t1, label     # 相等跳转
bne  t0, t1, label
blt  t0, t1, label     # 有符号小于
bltu t0, t1, label     # 无符号小于
bge  t0, t1, label
bgeu t0, t1, label

# 跳转
jal  ra, func          # 调用函数，ra = 返回地址
jalr zero, ra, 0       # 函数返回（ret 的展开）
j    label             # 无条件跳转（伪指令）

# 原子操作（A 扩展）
lr.w  t0, (a0)         # 加载保留（Load-Reserved）
sc.w  t1, t2, (a0)     # 条件存储（Store-Conditional），t1=0 成功
amoswap.w t0, t1, (a0) # 原子交换
amoadd.w  t0, t1, (a0) # 原子加
```

C 内联汇编访问 CSR：

```c
// 关全局中断，返回旧 mstatus
static inline uint32_t arch_irq_disable(void) {
    uint32_t mstatus;
    __asm volatile ("csrrci %0, mstatus, 8" : "=r"(mstatus) :: "memory");
    return mstatus;
}

// 恢复中断
static inline void arch_irq_restore(uint32_t mstatus) {
    __asm volatile ("csrw mstatus, %0" :: "r"(mstatus) : "memory");
}

// 读取 cycle 计数器（性能测量）
static inline uint64_t arch_get_cycle(void) {
    uint32_t lo, hi, hi2;
    do {
        __asm volatile ("csrr %0, cycleh" : "=r"(hi));
        __asm volatile ("csrr %0, cycle"  : "=r"(lo));
        __asm volatile ("csrr %0, cycleh" : "=r"(hi2));
    } while (hi != hi2);  // 防止高低位读取间进位
    return ((uint64_t)hi << 32) | lo;
}
```

## 中断与异常处理

### 中断向量表

```c
// 直接模式（mtvec.MODE = 0）：所有中断到同一入口
// 向量模式（mtvec.MODE = 1）：每个中断有独立入口（4 字节对齐）

// 设置中断向量（C 语言）
extern void trap_entry(void);
__asm volatile ("csrw mtvec, %0" :: "r"((uint32_t)trap_entry & ~3));

// 向量模式
__asm volatile ("csrw mtvec, %0" :: "r"(((uint32_t)trap_entry & ~3) | 1));
```

### Trap 入口（汇编）

```asm
.section .text.trap
.global trap_entry
.align 2
trap_entry:
    # 保存上下文（保存调用者寄存器）
    addi sp, sp, -64
    sw   ra,  0(sp)
    sw   t0,  4(sp)
    sw   t1,  8(sp)
    sw   t2, 12(sp)
    sw   a0, 16(sp)
    sw   a1, 20(sp)
    sw   a2, 24(sp)
    sw   a3, 28(sp)
    sw   a4, 32(sp)
    sw   a5, 36(sp)
    sw   a6, 40(sp)
    sw   a7, 44(sp)
    sw   t3, 48(sp)
    sw   t4, 52(sp)
    sw   t5, 56(sp)
    sw   t6, 60(sp)

    call trap_handler        # 调用 C 处理函数

    # 恢复上下文
    lw   ra,  0(sp)
    lw   t0,  4(sp)
    # ... 恢复所有寄存器
    addi sp, sp, 64
    mret                     # 从 mepc 返回，恢复 mstatus.MIE
```

### C 处理函数

```c
void trap_handler(void) {
    uint32_t mcause, mepc;
    __asm volatile ("csrr %0, mcause" : "=r"(mcause));
    __asm volatile ("csrr %0, mepc"   : "=r"(mepc));

    if (mcause & 0x80000000U) {
        // 中断（Interrupt）
        uint32_t irq_id = mcause & 0x7FFFFFFF;
        switch (irq_id) {
            case 7:  handle_timer_irq();    break;  // Machine Timer
            case 11: handle_external_irq(); break;  // Machine External
        }
    } else {
        // 异常（Exception）
        switch (mcause) {
            case 0:  /* Instruction address misaligned */ break;
            case 2:  /* Illegal instruction */           break;
            case 5:  /* Load access fault */             break;
            case 7:  /* Store access fault */            break;
            case 11: /* Environment call (ecall) */      break;
        }
        // 异常通常跳过出错指令继续（或重置）
        __asm volatile ("csrw mepc, %0" :: "r"(mepc + 4));
    }
}
```

## 常见 RISC-V MCU

| 芯片 | 架构 | 主频 | Flash/RAM | 特点 |
|------|------|------|-----------|------|
| **GD32VF103** | RV32IMAC | 108 MHz | 128KB/32KB | STM32F103 替代，GD 出品 |
| **CH32V003** | RV32EC | 48 MHz | 16KB/2KB | 超低成本（¥0.5），WCH 出品 |
| **CH32V307** | RV32IMAFC | 144 MHz | 256KB/64KB | USB OTG，以太网，WCH 出品 |
| **ESP32-C3** | RV32IMC | 160 MHz | 4MB/400KB | Wi-Fi + BLE，乐鑫出品 |
| **ESP32-C6** | RV32IMAC | 160 MHz | 8MB/512KB | Wi-Fi 6 + BLE 5 + Zigbee |
| **BL616** | RV32IMAFCP | 320 MHz | 4MB/480KB | Wi-Fi 6 + BLE，博流出品 |

## OpenOCD 调试

```bash
# GD32VF103（JTAG via DAPLink / J-Link）
openocd -f interface/jlink.cfg \
        -c "transport select jtag" \
        -f target/gd32vf103.cfg

# CH32V003（WCH-LinkE，单线调试接口 SDI）
openocd -f interface/wch-linke.cfg \
        -f target/ch32v003.cfg

# ESP32-C3（USB JTAG 内置）
openocd -f board/esp32c3-builtin.cfg

# GDB 连接
riscv-none-elf-gdb firmware.elf
(gdb) target remote :3333
(gdb) monitor reset halt
(gdb) load                    # 烧录
(gdb) break main
(gdb) continue
```

## FreeRTOS 移植要点（RISC-V）

FreeRTOS 官方提供 RISC-V 端口（`portable/GCC/RISC-V/`）：

```c
// portmacro.h 关键配置
#define portSTACK_GROWTH      (-1)           // 栈向低地址增长
#define portBYTE_ALIGNMENT    16             // 16 字节对齐（RISC-V ABI 要求）

// 上下文切换通过 ecall 触发（软件中断）
// mtvec 必须指向 FreeRTOS 提供的 freertos_risc_v_trap_handler

// FreeRTOSConfig.h 必须定义
#define configMTIME_BASE_ADDRESS    0x200BFF8UL   // CLINT MTIME 地址
#define configMTIMECMP_BASE_ADDRESS 0x2004000UL   // CLINT MTIMECMP 地址
```

Tick 定时器（使用 CLINT Machine Timer）：

```c
void vPortSetupTimerInterrupt(void) {
    // 设置下一次 tick 时间
    uint64_t next = *(volatile uint64_t *)configMTIME_BASE_ADDRESS
                    + (configCPU_CLOCK_HZ / configTICK_RATE_HZ);
    *(volatile uint64_t *)configMTIMECMP_BASE_ADDRESS = next;

    // 使能 Machine Timer 中断
    __asm volatile ("csrs mie, %0" :: "r"(1 << 7));
    // 使能全局中断
    __asm volatile ("csrs mstatus, %0" :: "r"(1 << 3));
}
```

## 与 ARM Cortex-M 对比

| 特性 | Cortex-M | RISC-V |
|------|----------|--------|
| 指令集 | 闭源（ARM 授权） | 开源 |
| 压缩指令 | Thumb-2（16/32 混合） | C 扩展（16 位） |
| 中断控制器 | NVIC（硬件向量表） | PLIC（软件管理） |
| 上下文切换 | PendSV 中断 | ecall / 软件中断 |
| 调试接口 | SWD / JTAG | JTAG / CJTAG / WCH SDI |
| FPU | 可选（FPv4-SP） | F/D/Q 扩展 |
| 生态成熟度 | 非常成熟 | 快速发展中 |

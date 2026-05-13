---
title: C 语言嵌入式开发笔记
description: 嵌入式 C 开发速查：位操作宏、volatile 用法、内存映射寄存器、环形缓冲区、状态机与 RISC-V/Cortex-M 临界区
date: 2026-05-13
tags: [嵌入式, C语言]
order: 5
---

# C 语言嵌入式开发笔记

> 面向裸机 / RTOS 开发的 C 语言要点，聚焦与桌面开发差异最大的部分。

## 数据类型与宽度

桌面端 `int` 宽度取决于平台，嵌入式必须使用 `<stdint.h>` 的定宽类型：

```c
#include <stdint.h>
#include <stdbool.h>

uint8_t  byte_val  = 0xFF;       // 8 位无符号
uint16_t word_val  = 0xBEEF;     // 16 位无符号
uint32_t dword_val = 0xDEADBEEF; // 32 位无符号
int32_t  signed32  = -1000;

bool flag = true;                // 来自 stdbool.h
```

常用大小（Cortex-M / RISC-V 32 位）：

| 类型 | 字节 | 位 |
|------|------|----|
| `uint8_t` | 1 | 8 |
| `uint16_t` | 2 | 16 |
| `uint32_t` | 4 | 32 |
| `uint64_t` | 8 | 64 |
| `float` | 4 | 32 |

## 位操作

嵌入式最常见的操作，用于控制寄存器每个 bit：

```c
uint32_t reg = 0;

// 置位（set bit n）
reg |= (1U << n);

// 清位（clear bit n）
reg &= ~(1U << n);

// 翻转（toggle bit n）
reg ^= (1U << n);

// 读取（test bit n）
bool is_set = (reg >> n) & 1U;

// 多 bit 字段：读取 bit[5:3]
#define FIELD_SHIFT  3
#define FIELD_MASK   (0x7U << FIELD_SHIFT)   // 3 bit 宽

uint32_t val = (reg & FIELD_MASK) >> FIELD_SHIFT;   // 读
reg = (reg & ~FIELD_MASK) | ((new_val << FIELD_SHIFT) & FIELD_MASK); // 写
```

宏封装（BSP 常见写法）：

```c
#define BIT(n)              (1U << (n))
#define SET_BIT(reg, bit)   ((reg) |=  (bit))
#define CLR_BIT(reg, bit)   ((reg) &= ~(bit))
#define TOG_BIT(reg, bit)   ((reg) ^=  (bit))
#define GET_BIT(reg, bit)   (((reg) & (bit)) != 0U)
```

## volatile 关键字

告诉编译器：不要对这个变量做优化，每次都老老实实从内存读写。

必须用 `volatile` 的场景：

```c
// 1. 内存映射寄存器
#define GPIOA_IDR  (*(volatile uint32_t *)0x40010808U)

// 2. 中断服务程序（ISR）和主循环共享的变量
volatile bool data_ready = false;

void ISR_UART_RX(void) {
    data_ready = true;   // ISR 写
}

void main_loop(void) {
    while (!data_ready) {}  // 主循环读，必须每次都读内存
    process();
}

// 3. DMA 操作的缓冲区
volatile uint8_t dma_buf[128];
```

**注意**：`volatile` 不保证原子性，多字节变量在中断中访问仍需关中断保护。

## 内存映射寄存器访问

MCU 外设寄存器本质是特定物理地址的内存，标准写法：

```c
// 直接地址（不推荐，易出错）
*(volatile uint32_t *)0x40010800 |= (1 << 4);

// 结构体映射（推荐，可读性强）
typedef struct {
    volatile uint32_t CRL;   // 0x00
    volatile uint32_t CRH;   // 0x04
    volatile uint32_t IDR;   // 0x08
    volatile uint32_t ODR;   // 0x0C
    volatile uint32_t BSRR;  // 0x10
    volatile uint32_t BRR;   // 0x14
    volatile uint32_t LCKR;  // 0x18
} GPIO_TypeDef;

#define GPIOA  ((GPIO_TypeDef *)0x40010800U)

// 使用
GPIOA->ODR |=  BIT(5);   // PA5 高
GPIOA->ODR &= ~BIT(5);   // PA5 低
GPIOA->BSRR = BIT(5);    // PA5 高（原子操作，不需关中断）
GPIOA->BSRR = BIT(5+16); // PA5 低（原子清位）
```

## 结构体与内存对齐

```c
// 编译器可能在字段间插入 padding 以对齐
typedef struct {
    uint8_t  a;   // 偏移 0
    // 3 字节 padding（32 位 MCU 默认 4 字节对齐）
    uint32_t b;   // 偏移 4
    uint16_t c;   // 偏移 8
    // 2 字节 padding
} MyStruct;       // sizeof = 12

// 紧凑布局（通信协议帧、Flash 存储）
typedef struct __attribute__((packed)) {
    uint8_t  a;   // 偏移 0
    uint32_t b;   // 偏移 1（非对齐！某些平台访问会 fault）
    uint16_t c;   // 偏移 5
} PackedStruct;   // sizeof = 7
```

> `packed` 结构体适合描述协议帧格式，但不要在内部逻辑中直接用非对齐的 `uint32_t` 字段做运算。

## 位域（Bitfield）

直接用结构体描述寄存器位字段：

```c
typedef union {
    struct {
        uint32_t MODE0 : 2;  // bit[1:0]
        uint32_t CNF0  : 2;  // bit[3:2]
        uint32_t MODE1 : 2;  // bit[5:4]
        uint32_t CNF1  : 2;  // bit[7:6]
        uint32_t       : 24; // 保留
    };
    uint32_t word;           // 整体访问
} GPIO_CRL_t;

GPIO_CRL_t crl;
crl.word   = GPIOA->CRL;
crl.MODE0  = 0b11;          // 设置字段
GPIOA->CRL = crl.word;
```

> 位域的字段顺序（MSB first 还是 LSB first）由编译器决定，跨平台时需验证。

## 大小端（Endianness）

```c
#include <stdint.h>

// 判断当前平台大小端
static inline bool is_little_endian(void) {
    uint16_t x = 0x0001;
    return *(uint8_t *)&x == 0x01;
}

// 手动字节交换（不依赖内建函数时）
static inline uint16_t swap16(uint16_t x) {
    return (x << 8) | (x >> 8);
}

static inline uint32_t swap32(uint32_t x) {
    return ((x & 0xFF000000) >> 24) |
           ((x & 0x00FF0000) >>  8) |
           ((x & 0x0000FF00) <<  8) |
           ((x & 0x000000FF) << 24);
}

// GCC 内建（Cortex-M / RISC-V 工具链支持）
uint32_t be = __builtin_bswap32(le_val);
```

Cortex-M 可用 `REV` 指令（GCC 会自动优化），RISC-V 无专用指令但编译器同样会优化。

## 关键字 const

```c
// 1. 常量数据（存 Flash）
const uint8_t lut[256] = { ... };

// 2. 函数参数不修改指向的数据
void send(const uint8_t *buf, uint16_t len);

// 3. 指向常量的常量指针（只读寄存器）
const volatile uint32_t * const RO_REG = (volatile uint32_t *)0x40000000;
// *RO_REG  — 只读
// RO_REG   — 指针本身不可修改

// 4. 指针本身不可变，但数据可变
uint8_t buf[64];
uint8_t * const p = buf;  // p 不能重新指向，但 *p 可写
```

## 实用模式

### 环形缓冲区（Ring Buffer）

```c
#define BUF_SIZE 64   // 必须是 2 的幂

typedef struct {
    uint8_t  data[BUF_SIZE];
    volatile uint16_t head;
    volatile uint16_t tail;
} RingBuf;

static inline bool rb_push(RingBuf *rb, uint8_t byte) {
    uint16_t next = (rb->head + 1) & (BUF_SIZE - 1);
    if (next == rb->tail) return false;  // full
    rb->data[rb->head] = byte;
    rb->head = next;
    return true;
}

static inline bool rb_pop(RingBuf *rb, uint8_t *out) {
    if (rb->head == rb->tail) return false;  // empty
    *out = rb->data[rb->tail];
    rb->tail = (rb->tail + 1) & (BUF_SIZE - 1);
    return true;
}
```

### 状态机

```c
typedef enum { ST_IDLE, ST_RECV, ST_PROC, ST_SEND } State;

static State state = ST_IDLE;

void fsm_tick(void) {
    switch (state) {
        case ST_IDLE:
            if (data_ready) state = ST_RECV;
            break;
        case ST_RECV:
            recv_data();
            state = ST_PROC;
            break;
        case ST_PROC:
            process();
            state = ST_SEND;
            break;
        case ST_SEND:
            send_response();
            state = ST_IDLE;
            break;
    }
}
```

### 软件防抖

```c
#define DEBOUNCE_MS 20

typedef struct {
    bool     last;
    bool     stable;
    uint32_t timestamp;
} Button;

void btn_update(Button *btn, bool raw, uint32_t now_ms) {
    if (raw != btn->last) {
        btn->last      = raw;
        btn->timestamp = now_ms;
    }
    if ((now_ms - btn->timestamp) >= DEBOUNCE_MS) {
        btn->stable = raw;
    }
}
```

## 中断保护临界区

```c
// Cortex-M
static inline uint32_t enter_critical(void) {
    uint32_t primask;
    __asm volatile ("MRS %0, primask" : "=r"(primask));
    __asm volatile ("CPSID i");
    return primask;
}

static inline void exit_critical(uint32_t primask) {
    __asm volatile ("MSR primask, %0" :: "r"(primask));
}

// 用法
uint32_t mask = enter_critical();
shared_var++;           // 临界区
exit_critical(mask);
```

RISC-V（标准做法）：

```c
static inline uint32_t enter_critical(void) {
    uint32_t mstatus;
    __asm volatile ("csrrci %0, mstatus, 8" : "=r"(mstatus));
    return mstatus;
}

static inline void exit_critical(uint32_t mstatus) {
    __asm volatile ("csrw mstatus, %0" :: "r"(mstatus));
}
```

## 编译器属性（GCC）

```c
// 强制内联（热路径）
__attribute__((always_inline)) static inline void fast_func(void) { ... }

// 禁止内联（节省 Flash）
__attribute__((noinline)) void big_func(void) { ... }

// 放置到特定 section（通常由链接脚本配合）
__attribute__((section(".ramfunc"))) void isr_handler(void) { ... }

// 弱符号（允许用户重写默认实现）
__attribute__((weak)) void HardFault_Handler(void) { for(;;) {} }

// 函数不返回（优化跳转）
__attribute__((noreturn)) void system_reset(void) { ... }

// 对齐
__attribute__((aligned(4))) uint8_t dma_buf[128];
```

## Makefile 基础（裸机项目）

```makefile
CC      = arm-none-eabi-gcc
CFLAGS  = -mcpu=cortex-m3 -mthumb -O2 -Wall -Wextra \
           -ffunction-sections -fdata-sections
LDFLAGS = -T link.ld -Wl,--gc-sections -nostartfiles

SRC     = main.c gpio.c uart.c
OBJ     = $(SRC:.c=.o)

all: firmware.elf firmware.bin

firmware.elf: $(OBJ)
	$(CC) $(LDFLAGS) -o $@ $^

firmware.bin: firmware.elf
	arm-none-eabi-objcopy -O binary $< $@

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

flash: firmware.bin
	openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
	  -c "program firmware.bin 0x08000000 verify reset exit"

clean:
	rm -f $(OBJ) firmware.elf firmware.bin
```

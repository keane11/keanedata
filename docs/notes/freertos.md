---
title: FreeRTOS 开发笔记
description: FreeRTOS 完整指南：任务、队列、信号量、事件组、任务通知、软件定时器与堆内存配置
date: 2026-05-13
tags: [嵌入式, FreeRTOS, RTOS]
order: 6
---

# FreeRTOS 开发笔记

> FreeRTOS 是嵌入式领域最广泛使用的实时操作系统，支持 Cortex-M、RISC-V、ESP32 等数十种架构。

## 核心概念

| 概念 | 说明 |
|------|------|
| **任务（Task）** | 独立的执行单元，类似线程，有独立栈空间 |
| **调度器（Scheduler）** | 决定哪个任务运行，基于优先级抢占 |
| **Tick** | 系统心跳，由 SysTick / 定时器产生，默认 1000 Hz |
| **优先级** | 数值越大优先级越高（与 Linux 相反） |
| **TCB** | 任务控制块，内核管理每个任务的状态 |

任务状态转换：

```
创建 → 就绪（Ready）→ 运行（Running）
                ↑            ↓
           等待事件  ← 阻塞（Blocked）
                         ↓
                     挂起（Suspended）
```

## 任务创建与管理

```c
#include "FreeRTOS.h"
#include "task.h"

// 任务函数原型（永不返回）
void vMyTask(void *pvParameters) {
    (void)pvParameters;  // 消除未使用警告
    for (;;) {
        // 任务主体
        vTaskDelay(pdMS_TO_TICKS(100));  // 延时 100ms（释放 CPU）
    }
}

// 创建任务
TaskHandle_t xHandle = NULL;

xTaskCreate(
    vMyTask,           // 任务函数
    "MyTask",          // 任务名（调试用）
    256,               // 栈大小（单位：word，即 4 字节）
    NULL,              // 传入参数
    tskIDLE_PRIORITY + 1, // 优先级（0 = Idle）
    &xHandle           // 任务句柄（不需要可传 NULL）
);

// 静态分配（不使用堆，推荐用于安全关键场景）
static StaticTask_t xTaskBuffer;
static StackType_t  xStack[256];

xTaskCreateStatic(vMyTask, "MyTask", 256, NULL,
                  tskIDLE_PRIORITY + 1, xStack, &xTaskBuffer);

// 启动调度器（此后 main 不再返回）
vTaskStartScheduler();
```

常用任务操作：

```c
vTaskDelete(xHandle);           // 删除任务（NULL = 删除自身）
vTaskSuspend(xHandle);          // 挂起任务
vTaskResume(xHandle);           // 恢复任务
vTaskPrioritySet(xHandle, 3);   // 改变优先级
uxTaskPriorityGet(xHandle);     // 获取优先级

// 获取任务信息（调试）
UBaseType_t stack_wm = uxTaskGetStackHighWaterMark(xHandle); // 栈最小剩余
```

## 队列（Queue）

队列是任务间传递数据最安全的方式，天然线程安全：

```c
#include "queue.h"

// 创建：可存 10 个 uint32_t 的队列
QueueHandle_t xQueue = xQueueCreate(10, sizeof(uint32_t));

// 发送（生产者任务）
uint32_t value = 42;
xQueueSend(xQueue, &value, portMAX_DELAY);     // 阻塞直到有空位
xQueueSendToFront(xQueue, &value, 0);          // 发到队首，超时 0 = 不等待
xQueueSendToBack(xQueue, &value, pdMS_TO_TICKS(100)); // 最多等 100ms

// 接收（消费者任务）
uint32_t recv;
if (xQueueReceive(xQueue, &recv, portMAX_DELAY) == pdTRUE) {
    // 处理 recv
}

// 偷看但不取出
xQueuePeek(xQueue, &recv, 0);

// 查询队列状态
UBaseType_t count = uxQueueMessagesWaiting(xQueue);
UBaseType_t spaces = uxQueueSpacesAvailable(xQueue);
```

**ISR 中使用队列**：

```c
BaseType_t xHigherPriorityTaskWoken = pdFALSE;

xQueueSendFromISR(xQueue, &value, &xHigherPriorityTaskWoken);

// ISR 结束时触发任务切换（若有更高优先级任务被唤醒）
portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
```

## 信号量（Semaphore）

### 二值信号量：同步事件

```c
#include "semphr.h"

SemaphoreHandle_t xSem = xSemaphoreCreateBinary();

// 任务等待事件
void vConsumerTask(void *p) {
    for (;;) {
        xSemaphoreTake(xSem, portMAX_DELAY);  // 阻塞等待
        handle_event();
    }
}

// ISR 触发事件
void ISR_UART(void) {
    BaseType_t xWoken = pdFALSE;
    xSemaphoreGiveFromISR(xSem, &xWoken);
    portYIELD_FROM_ISR(xWoken);
}
```

### 计数信号量：资源池

```c
// 创建：最大 5 个资源，初始 5 个可用
SemaphoreHandle_t xPool = xSemaphoreCreateCounting(5, 5);

// 申请资源
xSemaphoreTake(xPool, portMAX_DELAY);
use_resource();
// 归还资源
xSemaphoreGive(xPool);
```

### 互斥量（Mutex）：保护共享数据

```c
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();

void vTask(void *p) {
    for (;;) {
        xSemaphoreTake(xMutex, portMAX_DELAY);  // 加锁
        // 访问共享资源
        shared_data++;
        xSemaphoreGive(xMutex);                 // 解锁
    }
}
```

互斥量与二值信号量的区别：互斥量有**优先级继承**机制，可防止优先级反转。

> **不能在 ISR 中使用 Mutex**，ISR 中需要保护共享数据请用关中断。

## 事件组（Event Groups）

多个 bit 组合，一次等待多种事件：

```c
#include "event_groups.h"

#define BIT_UART_RX  (1 << 0)
#define BIT_SPI_DONE (1 << 1)
#define BIT_BUTTON   (1 << 2)

EventGroupHandle_t xEvents = xEventGroupCreate();

// 等待任意事件（OR）
EventBits_t bits = xEventGroupWaitBits(
    xEvents,
    BIT_UART_RX | BIT_SPI_DONE,  // 等待的 bit
    pdTRUE,    // 触发后自动清除
    pdFALSE,   // pdFALSE = OR（任意一个），pdTRUE = AND（全部）
    portMAX_DELAY
);

if (bits & BIT_UART_RX)  handle_uart();
if (bits & BIT_SPI_DONE) handle_spi();

// 置位事件（通常在 ISR 或其他任务中）
xEventGroupSetBits(xEvents, BIT_UART_RX);
xEventGroupSetBitsFromISR(xEvents, BIT_BUTTON, &xWoken);
```

## 任务通知（Task Notifications）

比队列和信号量更轻量，每个任务内置一个 32 位通知值：

```c
// 发送通知（类似二值信号量的 Give）
xTaskNotifyGive(xHandle);

// 接收通知（类似 Take，阻塞等待）
ulTaskNotifyTake(pdTRUE, portMAX_DELAY);  // pdTRUE = 收到后清零

// 携带数值的通知
xTaskNotify(xHandle, 0x12345678, eSetValueWithOverwrite);

uint32_t val;
xTaskNotifyWait(0, 0xFFFFFFFF, &val, portMAX_DELAY);

// ISR 版本
xTaskNotifyGiveFromISR(xHandle, &xWoken);
```

## 软件定时器

```c
#include "timers.h"

// 回调函数（运行在 Timer daemon 任务中，不能阻塞）
void vTimerCallback(TimerHandle_t xTimer) {
    uint32_t id = (uint32_t)pvTimerGetTimerID(xTimer);
    // 处理定时事件
}

// 创建：每 500ms 触发，自动重载
TimerHandle_t xTimer = xTimerCreate(
    "MyTimer",
    pdMS_TO_TICKS(500),  // 周期
    pdTRUE,              // pdTRUE = 自动重载，pdFALSE = 单次
    (void *)1,           // ID
    vTimerCallback
);

xTimerStart(xTimer, 0);       // 启动
xTimerStop(xTimer, 0);        // 停止
xTimerReset(xTimer, 0);       // 重置计时
xTimerChangePeriod(xTimer, pdMS_TO_TICKS(1000), 0);  // 修改周期
```

## FreeRTOSConfig.h 关键配置

```c
// 系统时钟频率（Hz）
#define configCPU_CLOCK_HZ              72000000UL

// Tick 频率（Hz），1000 = 1ms 精度
#define configTICK_RATE_HZ              1000

// 最大优先级数（任务优先级从 0 到此值-1）
#define configMAX_PRIORITIES            8

// 最小栈大小（word 数）
#define configMINIMAL_STACK_SIZE        128

// 堆大小（字节）
#define configTOTAL_HEAP_SIZE           (20 * 1024)

// 任务名最大长度
#define configMAX_TASK_NAME_LEN         16

// 功能开关
#define configUSE_PREEMPTION            1   // 抢占式调度
#define configUSE_TIME_SLICING          1   // 同优先级时间片轮转
#define configUSE_MUTEXES               1
#define configUSE_COUNTING_SEMAPHORES   1
#define configUSE_TIMERS                1
#define configUSE_TASK_NOTIFICATIONS    1

// 栈溢出检测（2 = 更严格的检查）
#define configCHECK_FOR_STACK_OVERFLOW  2

// 开启运行时统计（需提供计时源）
#define configGENERATE_RUN_TIME_STATS   1
```

栈溢出回调（必须实现）：

```c
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    (void)xTask;
    // 通常在这里点亮 LED、输出日志、触发看门狗
    for (;;) {}
}
```

## 内存分配方案

FreeRTOS 提供 5 种 heap 实现，按 `heap_x.c` 文件区分：

| 文件 | 特点 | 适用场景 |
|------|------|---------|
| heap_1.c | 只分配不释放 | 系统启动后资源固定 |
| heap_2.c | 支持释放，不合并碎片 | 固定大小块分配 |
| heap_3.c | 包装 stdlib malloc | 需要 C 库内存函数 |
| heap_4.c | 支持释放和碎片合并 | **通用首选** |
| heap_5.c | heap_4 + 多段内存区 | SRAM 分散的 MCU |

```c
// 查询堆使用情况
size_t free_bytes = xPortGetFreeHeapSize();
size_t min_ever   = xPortGetMinimumEverFreeHeapSize();
```

## 调试技巧

```c
// 列出所有任务状态（需 configUSE_TRACE_FACILITY = 1）
void print_task_list(void) {
    char buf[512];
    vTaskList(buf);
    printf("%s", buf);
}
// 输出示例：
// Name          State  Prio  Stack   Num
// IDLE          R      0     116     4
// MyTask        B      1     180     1
// Tmr Svc       B      2     220     2

// 运行时统计（需 configGENERATE_RUN_TIME_STATS = 1）
void print_runtime_stats(void) {
    char buf[512];
    vTaskGetRunTimeStats(buf);
    printf("%s", buf);
}
```

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| 任务函数直接 `return` | 返回后执行未定义行为 | 结尾加 `vTaskDelete(NULL)` 或死循环 |
| 在 ISR 调用普通 API | 会阻塞 ISR，破坏系统 | 使用 `FromISR` 版本 |
| 栈分配过小 | 栈溢出覆盖相邻内存 | 用 `uxTaskGetStackHighWaterMark` 测量实际用量 |
| 互斥量死锁 | A 等 B，B 等 A | 统一加锁顺序；使用超时而不是 `portMAX_DELAY` |
| Idle 任务饿死 | 高优先级任务不阻塞 | 每个任务必须有 `vTaskDelay` 或等待事件 |
| 定时器回调太慢 | Timer daemon 任务阻塞 | 回调只做标记，把实际工作交给专用任务 |

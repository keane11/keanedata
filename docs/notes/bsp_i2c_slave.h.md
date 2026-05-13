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

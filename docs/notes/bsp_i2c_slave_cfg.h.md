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

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
 *
 *  .com_text.i2c_slave 段只放 ISR 传递闭包里真正会跑的代码。
 *  当 I2C_SLAVE_CLOCK_STRETCH_EN=1 时，ISR READ 分支不再调用
 *  reg_prepare_tx / start_tx_first_byte，它们只在主任务上下文
 *  （poll / reg_set / tx_set / init）被调用，放普通 flash 即可。
 *  切回 stretch=0 时 ISR 重新需要它们，宏自动把 AT 补回来。
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
    /* 直接写入 s_tx_buf，避免在 ISR 栈上再开一块 TX_BUF_SIZE 的中转缓冲 */
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
/* 主循环准备好 TX 数据后调用：驱动首 bit、清 stretch 标志、释放 SCL。
 * 调用前提：s_stretch_active=1 且 s_state==SLAVE_SEND_DATA，s_tx_buf 已装载。
 * 只在主任务上下文调用（tx_set / reg_set / poll），无需放 com_text。 */
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
        I2C_SLAVE_PORTINTEDG |=  I2C_SLAVE_SCL_INT_BIT;   /* HIGH → 等下降沿 */
    } else {
        I2C_SLAVE_PORTINTEDG &= ~I2C_SLAVE_SCL_INT_BIT;   /* LOW  → 等上升沿 */
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

    s_rx_w      = s_pkt_start;  /* 回退写指针，丢弃不完整帧数据 */
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
    SCL_RELEASE();              /* 若之前在 stretch，立即释放 SCL */
    s_stretch_active = 0u;
    s_state     = SLAVE_RECV_ADDR;
    s_bit_cnt   = 0;
    s_shift_reg = 0;
}

/* 丢边沿恢复：字节中间检测到伪 START/STOP 时调用，丢弃未完成的帧并回到 IDLE。
 * 不调用 finalize_rx_frame()，避免把半截数据推进帧队列。 */
AT(.com_text.i2c_slave)
static inline void isr_drop_to_idle(void)
{
    SDA_RELEASE();
    SCL_RELEASE();
    s_stretch_active = 0u;
    s_restart_arm    = 0u;
    s_need_refresh   = 0u;
    s_rx_w           = s_pkt_start;   /* 丢弃本帧已收字节 */
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
                /*
                 * 一旦开始采样下一字节 bit7，说明“ACK 后等待 repeated START”的窗口已结束。
                 * 仅当当前没有处在 repeated START 候选窗口时才清掉 arm，
                 * 否则允许“SCL 先高、SDA 后低”的合法 repeated START 被识别出来。
                 */
                s_restart_arm = 0u;
            }
            s_shift_reg = (s_shift_reg << 1u) | (sda ? 1u : 0u);
            s_bit_cnt++;
        }
        break;

    case SLAVE_SEND_DATA:
        if (s_bit_cnt == 8u) {
            /* 当前上升沿采样的是 bit0，本字节数据位到此结束 */
            s_bit_cnt = 9u;
        } else if (s_bit_cnt == 10u) {
            /* 第 9 个 SCL 上升沿：采样主机 ACK(0) 或 NACK(1) */
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

    /* ---- 接收地址字节 ---- */
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
                /* 主机 WRITE：释放 SDA 给主机驱动数据 */
                SDA_RELEASE();
                s_pkt_start = s_rx_w;
                s_state     = SLAVE_RECV_DATA;
                s_bit_cnt   = 0u;
                s_shift_reg = 0u;
                s_restart_arm = 0u;
            } else {
                /*
                 * 主机 READ：进入 Clock Stretch，交给主循环按寄存器现算并回填。
                 * 主循环调用 bsp_i2c_slave_reg_set() 后会准备 TX 缓冲并释放 SCL，
                 * 保持标准 WRITE reg -> RESTART -> READ 流程不变。
                 */
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

    /* ---- 接收数据字节 ---- */
    case SLAVE_RECV_DATA:
        if (s_bit_cnt > 0u && s_bit_cnt < 8u && s_restart_arm) {
            /*
             * 一旦下一字节已经走到第一个 SCL 下降沿，说明 repeated START 窗口结束，
             * 后续再看到 SDA 跳变就不应再按 START 候选处理。
             */
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

    /* ---- 发送数据字节 ---- */
    case SLAVE_SEND_DATA:
        if (s_bit_cnt == 0u) {
            drive_sda_bit((s_shift_reg >> 7u) & 1u);
            s_bit_cnt = 1u;
        } else if (s_bit_cnt < 8u) {
            drive_sda_bit((s_shift_reg >> (7u - s_bit_cnt)) & 1u);
            s_bit_cnt++;
        } else if (s_bit_cnt == 9u) {
            /* 释放 SDA 供主机驱动 ACK/NACK */
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
 *
 *  读取 SCL/SDA 当前电平，与上次状态对比判断边沿方向；
 *  处理完毕后翻转 PORTINTEDG 对应 bit，检测下一次反向边沿。
 * ========================================================= */
AT(.com_text.i2c_slave)
void bsp_i2c_slave_isr(void)
{
    /* 先清 pending，尽量缩短窗口 */
    WKUPCPND = BIT(22) | BIT(23);

    uint8_t scl = SCL_IS_H() ? 1u : 0u;
    uint8_t sda = SDA_IS_H() ? 1u : 0u;

    /* ---- 假触发保护（最高优先级）----
     * 噪声毛刺触发 ISR 后电平已恢复 → SCL/SDA 与上次相同 → 无法翻转 PORTINTEDG
     * → 同一边沿极性保持 → 毛刺立刻再触发 → ISR 无限循环 → 系统死机。
     *
     * 修复：检测到假触发时，立刻关闭 PORTINTEN 中 SCL/SDA 对应 bit，
     * 中断源被禁用后不再产生新 pending，ISR 风暴立刻终止。
     * poll() 会在主循环中检查标志位并重新使能。 */
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

    /* ---- SDA 边沿：START / STOP ---- */
    if (sda != s_last_sda) {
        /*
         * START/STOP 的判定前提是：SDA 变化期间 SCL 必须稳定保持高电平。
         * 若 SDA 在 SCL=LOW 时变化，但 ISR 因延迟在 SCL 已回到 HIGH 时才执行，
         * 仅看“当前 scl=1”会把 ACK 释放或数据位切换误判成 START/STOP。
         * 因此这里要求“当前 scl=1 且上一次采样的 s_last_scl 也为 1”。
         */
        if (!sda && !scl && s_state == SLAVE_RECV_DATA && s_bit_cnt == 0u) {
            s_restart_arm = 0u;
        } else if (sda && !scl && s_state == SLAVE_RECV_DATA && s_bit_cnt == 0u) {
            /*
             * ACK 结束到下一字节 bit7 采样前的空窗期里，
             * 若看到 SDA 在 SCL=LOW 时先回到高电平，说明主机有机会发 repeated START。
             * 随后即便 SDA 下降沿 ISR 先于 SCL 上升沿 ISR 到达，也允许把它识别为 START。
             */
            s_restart_arm = 1u;
        }

        if (scl && (s_last_scl || ((!sda) && s_restart_arm))) {
            /*
             * 按 I2C 规范，真实的 START/STOP 只会出现在字节边界：
             *   - IDLE 状态
             *   - RECV_ADDR/RECV_DATA 的 bit_cnt==0（尚未开始采样）
             *   - bit_cnt==9/10（ACK 阶段，主机可发 repeated START 或 STOP）
             * 若在 bit_cnt ∈ [1..8] 中看到 SDA 跳变 + SCL 已回高，多半是 ISR 延迟
             * 丢掉了中间的 SCL 边沿对，当前帧已经不可信。
             * 直接丢弃本帧回到 IDLE，让下一次真正的 START 干净起手。
             */
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

    /* ---- SCL 边沿：时钟处理 ---- */
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
    /* 清功能复用使能（关键！参考 bsp_port_int.c:83 和 sc7a20.c:76 的标准模式）：
     * 必须把 SCL/SDA 引脚从"默认功能电路"交还给普通 GPIO，否则 GPIOxDIR/PU 写入无效。
     * 换引脚时同步修改顶部 FEN/WKUP 宏即可。 */
    I2C_SLAVE_SCL_FEN_REG &= ~I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SDA_FEN_REG &= ~I2C_SLAVE_SDA_PIN;

    /* SCL：数字使能 + 输入模式 + 内部上拉 */
    I2C_SLAVE_SCL_DE_REG  |= I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SCL_DIR_REG |= I2C_SLAVE_SCL_PIN;
    I2C_SLAVE_SCL_PU_REG  |= I2C_SLAVE_SCL_PIN;

    /* SDA：数字使能 + 输入模式（初始释放）+ 内部上拉 */
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

    /*
     * 初始边沿必须与当前总线电平匹配：
     *   HIGH → 等下降沿
     *   LOW  → 等上升沿
     * 首次上电时若主机侧 GPIO 还没释放，SCL/SDA 可能不是高电平，
     * 这里不能再假设总线空闲一定为 HIGH/HIGH。
     */
    sync_portint_edge_to_level();

    /* 预清历史 port int / wakeup pending：
     * 防止 PORTINTEN 使能瞬间或 WKUPCON BIT(16) 总使能时把历史 pending 翻出来误触发 ISR，
     * 导致 PORTINTEDG 被 ISR 的 XOR 翻转逻辑错位到反向边沿。
     * 参考 sc7a20.c:81 的 `WKUPCPND = 0xff << 16;` 模式。 */
    WKUPCPND = (0xffu << 16);

    I2C_SLAVE_PORTINTEN  |=  (I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);

    sys_irq_init(IRQ_PORT_VECTOR, 0, bsp_i2c_slave_isr);

    /*
     * AB896X PORT 中断通过 WAKEUP 系统路由到 CPU：
     *   WAKEUP source 6 = PORT INT 下降沿事件（PORTINTEDG bit=1 的引脚产生）
     *   WAKEUP source 7 = PORT INT 上升沿事件（PORTINTEDG bit=0 的引脚产生）
    * PORTINTEN/PORTINTEDG 决定哪根引脚/哪个边沿触发 PORT INT 事件；
     * WKUPCON/WKUPEDG 决定这两个事件是否转发为 IRQ_PORT_VECTOR 中断。
     * 缺少此配置则 PORTINTEN 永远不会触发 CPU 中断。
     */
    /* PB1/PB2 都是专用 WAKEUP SOURCE 引脚。
     * 显式禁用对应直连唤醒路径，确保边沿统一走 PORT INT src0 → WAKEUP src6/7，
     * 避免专用 WAKEUP 和 PORT INT 两条路径同时抢占同一根 IO。 */
    WKUPCON &= ~(I2C_SLAVE_SCL_WKUP_SRC_BIT | I2C_SLAVE_SDA_WKUP_SRC_BIT);
    WKUPEDG &= ~(I2C_SLAVE_SCL_WKUP_SRC_BIT | I2C_SLAVE_SDA_WKUP_SRC_BIT);

    WKUPEDG |=  BIT(6);    /* source 6 选下降沿触发 */
    WKUPCON |=  BIT(6);    /* 使能 source 6（PORT INT fall）中断 */
    WKUPEDG &= ~BIT(7);    /* source 7 选上升沿触发 */
    WKUPCON |=  BIT(7);    /* 使能 source 7（PORT INT rise）中断 */
    WKUPCON |=  BIT(16);   /* WAKEUP 中断总使能（必须最后设置） */

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
    /* 寄存器自检快照：启动后对照"检查清单"核验每个 bit 是否符合预期 */
    printf(s_str_gpio_a,
           (unsigned)GPIOAFEN, (unsigned)GPIOADIR,
           (unsigned)GPIOADE,  (unsigned)GPIOAPU);
    printf(s_str_gpio_b,
           (unsigned)GPIOBFEN, (unsigned)GPIOBDIR,
           (unsigned)GPIOBDE,  (unsigned)GPIOBPU);
    printf(s_str_wkup_reg, (unsigned)WKUPCON, (unsigned)WKUPEDG);
#endif
}

/*
 * bsp_i2c_slave_poll — 主循环周期调用（建议 5~10ms）
 *
 * 当前功能：总线超时检测。
 * 若从机非 IDLE 状态且 SCL 停止跳变超过 I2C_SLAVE_TIMEOUT_MS，
 * 则强制复位到 IDLE 并释放总线，防止主机异常断开后从机卡死。
 */
void bsp_i2c_slave_poll(void)
{
    /* ---- 假触发恢复 ----
     * ISR 检测到假触发后关闭了 PORTINTEN，这里重新使能。
     * 在主循环周期（5~10ms）内恢复，不影响正常 I2C 检测。 */
    if (s_int_disabled) {
        s_int_disabled = 0u;
        /* 同步 PORTINTEDG 到当前电平的反方向 */
        sync_portint_edge_to_level();
        WKUPCPND = BIT(22) | BIT(23);     /* 清历史 pending */
        I2C_SLAVE_PORTINTEN |= (I2C_SLAVE_SCL_INT_BIT | I2C_SLAVE_SDA_INT_BIT);
    }

#if I2C_SLAVE_CLOCK_STRETCH_EN && (I2C_SLAVE_STRETCH_TIMEOUT_MS > 0)
    /* stretch_active 仅在 ISR READ 分支与 s_state=SLAVE_SEND_DATA 同步置位，
     * 所有清零点成对，故此处必然处于 SEND_DATA 状态。 */
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
    /* ---------- 心跳：每累计 50 次 ISR 打印一次，确认中断在跑 ---------- */
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
        /* uint32 模减法在回绕时仍产生正确 delta，无需分支 */
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

    /* ---------- 事件日志：ISR 写环形缓冲，poll 读打印，互不阻塞 ---------- */
    while (s_dbg_r != s_dbg_w) {
        i2c_dbg_evt_t e;
        e.type = s_dbg_buf[s_dbg_r].type;
        e.val  = s_dbg_buf[s_dbg_r].val;
        e.val2 = s_dbg_buf[s_dbg_r].val2;
        s_dbg_r = (s_dbg_r + 1u) & (DBG_LOG_SIZE - 1u);

        switch (e.type) {
#if I2C_SLAVE_DEBUG_WKUP
        case DBG_WKUP:
            /* val2=SCL<<4|SDA 当前电平 */
            printf(s_str_wkup, e.val, (e.val2 >> 4) & 1, e.val2 & 1);
            break;
#endif
        case DBG_START:
            printf(s_str_start);
            break;
        case DBG_STOP:
            printf(s_str_stop, e.val);
            break;
        case DBG_ADDR_OK:
            printf(s_str_addr_ok, e.val, e.val >> 1u,
                   e.val2 ? s_str_rw_r : s_str_rw_w);
            break;
        case DBG_ADDR_NACK:
            printf(s_str_nack, e.val, e.val >> 1u,
                   (unsigned)I2C_SLAVE_ADDR, e.val2);
            break;
        case DBG_DATA:
            printf(s_str_data, e.val);
            break;
        case DBG_FALSE:
            printf(s_str_false, (e.val >> 4) & 1, e.val & 1, (int)e.val2);
            break;
        case DBG_PEND:
            printf(s_str_pend, e.val, (int)e.val2);
            break;
        case DBG_TX_PREP:
            printf(s_str_tx_prep, e.val, e.val2);
            break;
        case DBG_REG_SET:
            printf(s_str_reg_set, e.val, e.val2);
            break;
        case DBG_LOST:
            printf(s_str_lost, (int)e.val, (int)e.val2);
            break;
        default:
            break;
        }
    }
#endif /* I2C_SLAVE_DEBUG */
}

bool bsp_i2c_slave_rx_available(void)
{
    return (s_pkt_w != s_pkt_r);
}

/*
 * bsp_i2c_slave_rx_read — 读取最早收到的一帧
 *
 * 从帧元数据队列取出最早帧的 start/len，
 * 按位置从 rx_buf 复制数据，然后推进读指针并出队。
 * 支持连续多帧积压而不丢失帧长信息。
 */
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

    /* 推进 rx_r 到本帧结尾（让 ISR 的缓冲区满检测生效） */
    s_rx_r = (start + len) & (I2C_SLAVE_RX_BUF_SIZE - 1u);
    /* 出队 */
    s_pkt_r = (s_pkt_r + 1u) & (I2C_SLAVE_PKT_QUEUE_SIZE - 1u);

    return copy;
}

/*
 * bsp_i2c_slave_tx_set — 预填充发送缓冲区
 *
 * 可在主机 READ 前的任意时刻调用。
 * 若此时从机正在 Clock Stretch（s_stretch_active=1），
 * 填充完毕后立即驱动 SDA 首 bit 并释放 SCL，主机恢复传输。
 */
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
            slot = idx;
            break;
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
#if I2C_SW_SLAVE_EN

#define RISE_FALL_EDGE_MODE 1    // 模式一：双边沿触发
#define RISE_EDGE_MODE 0    // 模式二：上升沿触发
#define FALL_EDGE_MODE 0    // 模式三：下降沿触发


extern isr_t register_isr(int vector, isr_t isr);
#define IRQ_PORT_INT_VECTOR          26   //PORT_INI的中断号为26
AT(.com_text*)
const char strf[] = "[F_0x%X A:0x%X B:0x%X]\n";
AT(.com_text*)
const char strr[] = "[R_0x%X A:0x%X B:0x%X]\n";

AT(.com_text*)
const char str_state[] = "[S:0x%X L:%d]\n";

AT(.com_text*)
const char str_debug[] = "[d__:0x%X,f:%d,L:%d]\n";

//1、一个普通io的边沿触发 和一个特殊io的边沿触发示例(不支持同时两个普通io的边沿触发)
//AT(.com_text.port_int)
//void port_int_isr(void)
//{
//    // 若不开中断，也可以在任务下调用以下接口进行“查询法”检测外部IO状态 PA11 PB1
//    if (WKUPEDG & BIT(22)) {  //fall -->rise
//        printf(strf,WKUPEDG);
//        WKUPCPND = BIT(22);
//        #if RISE_FALL_EDGE_MODE
//        PORTINTEDG &= ~BIT(11); //rise
//        #endif
//    }
//    if (WKUPEDG & BIT(23)) { //rise -->fall
//        printf(strr,WKUPEDG);
//        WKUPCPND = BIT(23);
//        #if RISE_FALL_EDGE_MODE
//        PORTINTEDG |= BIT(11);  //fall
//        #endif
//    }
//
//    if (WKUPEDG & BIT(17)) {  //fall -->rise
//        printf(strf,WKUPEDG);
//        WKUPCPND = BIT(17);
//        WKUPCPND = BIT(23);
//
//        WKUPEDG ^= BIT(1);
//    }
//
//}
//
//void port_isr_init(void)
//{
//    printf("\r\nport_int_init\r\n");
//
//    GPIOBDE  |= BIT(1);
//    GPIOBDIR |= BIT(1);
//    GPIOBPU  |= BIT(1);
//
//    GPIOADE  |= BIT(11);
//    GPIOADIR |= BIT(11);
//    GPIOAPU  |= BIT(11);
//
//    register_isr(IRQ_PORT_INT_VECTOR, port_int_isr);
//    PICPR &= ~BIT(IRQ_PORT_INT_VECTOR);
//    PICEN |= BIT(IRQ_PORT_INT_VECTOR);
//
////    PORTINTEN |= (BIT(17));    // port Pb1 isr en
//
//    WKUPEDG |= BIT(1);     //wakeup select fall edge
//    WKUPCON |= BIT(1);      //fall isr en
//
//    ////
//    PORTINTEN |= BIT(11);    // port PA11 isr en
//
//    #if FALL_EDGE_MODE | RISE_FALL_EDGE_MODE
//    PORTINTEDG |= BIT(11); //port PA11 select fall edge
//    WKUPEDG |= BIT(6);     //wakeup select fall edge
//    WKUPCON |= BIT(6);      //fall isr en
//    #endif
//
//
//    #if RISE_EDGE_MODE | RISE_FALL_EDGE_MODE
//    PORTINTEDG &= ~BIT(11); //port PA11 select rise edge
//    WKUPEDG &= ~BIT(7);     //wakeup select rise edge
//    WKUPCON |= BIT(7);      //rise isr en
//    #endif // RISE_EDGE_MODE
//    ////
//
//
//    WKUPCON |= BIT(16);    //INT EN
//    my_printf("====>PORTINTEN:0x%x\n",PORTINTEN);
//}


#define SW_SLAVE_ADDR   0xa0   /*i2c 从机地址*/

/*i2c通信状态定义*/
#define I2C_STA_IDEL    0   /*空闲状态*/
#define I2C_STA_START   1   /*起始状态*/
#define I2C_STA_DATA    2   /*数据传输状态*/
#define I2C_STA_ACK     3   /*应答状态*/
#define I2C_STA_NACK    4   /*无应答状态*/
#define I2C_STA_STOP    5   /*停止状态*/

/*i2c 发送和接收缓存buf*/
#define RX_BUFFER_SIZE   32
#define TX_BUFFER_SIZE   32

AT(.i2c.buf)
u8 rx_buffer[RX_BUFFER_SIZE];

AT(.i2c.buf)
u8 tx_buffer[TX_BUFFER_SIZE];

#define I2C_READ    1
#define I2C_WRITE   0

#define I2C_SDA_IN_S()                    {GPIOADIR |= BIT(11); GPIOAPU |= BIT(11);}
#define I2C_SDA_OUT_S()                   {GPIOADIR &= ~BIT(11); GPIOADE |= BIT(11);}
#define I2C_SDA_H_S()                     GPIOASET = BIT(11);
#define I2C_SDA_L_S()                     GPIOACLR = BIT(11);

#define I2C_SDA_SLAVE_IS_H()                  (GPIOA & BIT(11))

// i2c 从机结构体
typedef struct _SlaveI2C_t
{
    u8 State;               /*i2c 通信状态*/
    u8 Rw;                  /*i2c 读写标志 0--写 1--读*/
    s8 SclFallCnt;          /*i2c 下降沿计数*/
    u8 Flag;                /*i2c 状态标志，BIT0: 0-地址无效，1-地址匹配*/
    u32 StartMs;            /*i2c 通信起始时间 单位ms 用于判断是否超时*/
    u8* RxBUf;              /*i2c 指向接收缓冲区的指针*/
    u8* TxBuf;              /*i2c 指向发送缓冲区的指针*/
    u8 RxIdx;               /*i2c 接收缓冲区数据写入索引*/
    u8 TxIdx;               /*i2c 发送缓冲区读取索引*/
} SlaveI2C_t;

SlaveI2C_t SlaveI2C;

void printf_iic(void)
{
    printf("rx_buffer:1:0x%x,2:0x%x,3:0x%x\n",rx_buffer[0],rx_buffer[1],rx_buffer[2]);
    printf("tx_buffer:1:0x%x,2:0x%x,3:0x%x,4:0x%x\n",tx_buffer[0],tx_buffer[1],SlaveI2C.TxIdx,SlaveI2C.Rw);
}

// I2C SLAVE TEST
//SCL------PB1  SDA-------PA11

AT(.com_text.i2c_slave)
void iic_slave_isr(void)
{

    if (WKUPEDG & BIT(22)) {  //fall -->rise    PA11 下降沿 SDA
        WKUPCPND |= BIT(22);
        PORTINTEDG &= ~BIT(11); //rise

        if (GPIOB & BIT(1)) {
            SlaveI2C.State = I2C_STA_START;
        }
    }
    if (WKUPEDG & BIT(23)) { //rise -->fall     PA11 上升沿 SDA
        WKUPCPND |= BIT(23);
        PORTINTEDG |= BIT(11);  //fall

        if (GPIOB & BIT(1)) {
            SlaveI2C.State = I2C_STA_IDEL;
        }
    }


    if (WKUPEDG & BIT(17)) {  //PB1  SCL  WKUPEDG的BIT(1)为0时表示上升沿触发    为1时表示下降沿触发
        WKUPCPND |= BIT(17);
        if (WKUPEDG & BIT(1)) {
            //下降沿触发
            switch(SlaveI2C.State){
                case I2C_STA_START:
                /*起始信号后的第一个下降沿 准备接收数据*/
                    SlaveI2C.SclFallCnt = 0;
                    SlaveI2C.Flag = 0;
                    SlaveI2C.StartMs = 0;
                    SlaveI2C.RxIdx = 0;
                    SlaveI2C.TxIdx = 0;
                    SlaveI2C.State = I2C_STA_DATA;
                    SlaveI2C.Rw    = I2C_WRITE;
                    SlaveI2C.RxBUf[0] = 0;
                    break;
                case I2C_STA_DATA:
                    SlaveI2C.SclFallCnt++;
                    if (SlaveI2C.SclFallCnt < 8) {
                        /*主机读取数据时候 在SCL低电平期间发送数据*/
                        if (SlaveI2C.Rw == I2C_READ) {
                            I2C_SDA_OUT_S();
                           if (SlaveI2C.TxBuf[SlaveI2C.TxIdx] & (1 << (7 - SlaveI2C.SclFallCnt))) {
                                //SDA设为输出 拉高
                                I2C_SDA_H_S();
                           } else {
                                //SDA设为输出 拉低
                                I2C_SDA_L_S();
                           }

                        }
                    } else if(SlaveI2C.SclFallCnt == 8) {

                        if (SlaveI2C.Rw == I2C_WRITE) {
                            /*处理地址匹配和读写标志*/
                            if(SlaveI2C.RxIdx == 0) {
                              /*第一个字节时设备地址*/
                              if ((SlaveI2C.RxBUf[0] & 0xFE) == SW_SLAVE_ADDR) {
                                SlaveI2C.Flag = 1;  /*地址匹配*/
                                SlaveI2C.Rw = SlaveI2C.RxBUf[0] & BIT(0); /*读取读写位*/
                              }
                            }

                            /*地址匹配 发送ACK */
                            if (SlaveI2C.Flag) {
                                I2C_SDA_OUT_S();
                                I2C_SDA_L_S(); /*ACK信号为低电平*/
                            }
                        } else {
                                I2C_SDA_IN_S();
                                SlaveI2C.TxIdx++;

                        }
                        SlaveI2C.State = I2C_STA_ACK;
                    }
                    break;
                case I2C_STA_ACK:
                    /*应答阶段完成，继续数据传输*/
                    SlaveI2C.SclFallCnt = 0;
                    if (SlaveI2C.Rw == I2C_WRITE) {
                        /*主机写入 准备接收下一字节*/
                        I2C_SDA_IN_S();
                         SlaveI2C.RxIdx++;
                         SlaveI2C.RxBUf[SlaveI2C.RxIdx] = 0;
                    } else {
                        /*主机读取 准备发送下一字节*/
                        I2C_SDA_OUT_S();
                        if(SlaveI2C.TxBuf[SlaveI2C.TxIdx] & 0x80) {
                                I2C_SDA_H_S();
                        } else {
                                I2C_SDA_L_S();
                        }


                    }
                    SlaveI2C.State = I2C_STA_DATA;
                    break;
                case I2C_STA_NACK:
                    /*收到NACK 准备stop 或ReSTART*/
                    SlaveI2C.SclFallCnt = 0;
                    I2C_SDA_IN_S();
                    break;

            }
//----------------------------------------------------------------------
        } else {
            //上升沿触发
            switch(SlaveI2C.State){
                case I2C_STA_DATA:
                    if ((SlaveI2C.Rw == I2C_WRITE) && (SlaveI2C.SclFallCnt < 8)) {

                        if (I2C_SDA_SLAVE_IS_H()) {
                            SlaveI2C.RxBUf[SlaveI2C.RxIdx] |= (1 << (7 - SlaveI2C.SclFallCnt));

                        }
                    }

                    if ((SlaveI2C.Rw == I2C_WRITE) && (SlaveI2C.SclFallCnt == 8)) {

                    }
                    break;
                case I2C_STA_ACK:
                    if (SlaveI2C.Rw == I2C_READ) {
                        if (I2C_SDA_SLAVE_IS_H()) {
                            SlaveI2C.State = I2C_STA_NACK;
                        }

                    }
                    break;
            }
        }
        WKUPEDG ^= BIT(1);// 切换边沿触发条件
    }
}

void iic_slave_init(void)
{
    printf("\r\nport_int_init\r\n");

    GPIOBDE  |= BIT(1);
    GPIOBDIR |= BIT(1);
    GPIOBPU  |= BIT(1);

    GPIOADE  |= BIT(11);
    GPIOADIR |= BIT(11);
    GPIOAPU  |= BIT(11);

    register_isr(IRQ_PORT_INT_VECTOR, iic_slave_isr);
    PICPR &= ~BIT(IRQ_PORT_INT_VECTOR);
    PICEN |= BIT(IRQ_PORT_INT_VECTOR);

    WKUPEDG |= BIT(1);     //wakeup select fall edge
    WKUPCON |= BIT(1);      //fall isr en

    PORTINTEN |= BIT(11);    // port PA11 isr en

    PORTINTEDG |= BIT(11); //port PA11 select fall edge
    WKUPEDG |= BIT(6);     //wakeup select fall edge
    WKUPCON |= BIT(6);      //fall isr en

    PORTINTEDG &= ~BIT(11); //port PA11 select rise edge
    WKUPEDG &= ~BIT(7);     //wakeup select rise edge
    WKUPCON |= BIT(7);      //rise isr en

    WKUPCON |= BIT(16);    //INT EN

    //初始化I2C状态机
    SlaveI2C.State = I2C_STA_IDEL;
    SlaveI2C.Rw    = I2C_WRITE;
    SlaveI2C.SclFallCnt = 0;
    SlaveI2C.Flag = 0;
    SlaveI2C.StartMs = 0;
    SlaveI2C.RxIdx = 0;
    SlaveI2C.TxIdx = 0;

    SlaveI2C.RxBUf =  rx_buffer;
    SlaveI2C.TxBuf =  tx_buffer;

    memset(tx_buffer,0,sizeof(tx_buffer));
    memset(rx_buffer,0,sizeof(rx_buffer));

    //测试发送数据
    tx_buffer[0] = 0xaa;
    tx_buffer[1] = 0xbb;
    //printf("rx_buffer:1:0x%x,2:0x%x,3:0x%x,4:0x%x,5:0x%x\n",rx_buffer[0],rx_buffer[1],rx_buffer[2],tx_buffer[0],tx_buffer[1]);

}

#endif

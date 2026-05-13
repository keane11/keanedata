# 中科蓝讯（Bluetrum）芯片数据库

> 来源：中科蓝讯选型表_v6.3-20260331
> 自动生成于 2026-05-11

---

## 芯片系列总览

| 系列分类 | 涵盖型号 | 适用场景 |
|---------|---------|---------|
|
| 音箱 BT896x/BT890x | BT8969B, BT8961B, BT8962B, BT8901A, BT8901B | 高阶音箱、Soundbar、会议音箱 |
| 音箱 AB580X/BT880X | BT8800A-D, AB5800T, AB5801A-H, AB5802B/D | 广播音箱、Soundbar、车机、直播声卡 |
| 音箱 AB570x | AB5702B/C, AB5705B/C, AB5707E | K歌音箱、带屏音箱、拉杆箱 |
| 音箱 AB530x/AB560x | AB5301C/H, AB5602B/C/D, AB5605B/C/E, AB5607E | 标准蓝牙音箱、时钟音箱、车机 |
| 耳机 AB561x/565x/575x/585x | 30+ 型号 | 极致性价比 TWS 耳机 |
| 耳机 AB573x/571x/563x | AB5736, AB5712/6, AB5632/5/6 | 低功耗 TWS、ANC 耳机 |
| 耳机 BT891x | BT8912E/F | FF ANC TWS 耳机 |
| 耳机 BT892x（讯龙二代） | BT8922A-H, BT8925B-D, BT8926B/D | ANC TWS 耳机、立体声头戴 |
| 耳机 BT893x（讯龙二代增强） | BT8931H, BT8932H/E/F/B/D | Hybrid ANC TWS/头戴 |
| 耳机 BT897x | BT8970H, BT8971H, BT8972H/F | Hybrid ANC TWS（最新中端） |
| 耳机 BT895x（讯龙三代） | BT8951H, BT8952F | 旗舰 Hybrid ANC TWS |
| 穿戴视频 | BT8790T/V, AB5790-92, AB569x, AB568x | 智能手表、带屏设备 |
| 数字音频 MCU | AB132A, AB135A/B, AB136M/D, AB137A, BT8936T, AB176D | USB音频、Type-C耳机、转接头 |
| BLE | AB205x, AB202x, AB203x（18 型号） | IoT、遥控器、电子烟、手环、防丢器 |
| 语音玩具 | AB15x, AB18x（17 型号） | 儿童玩具、电子琴、电子烟、录音玩具 |

---

## 一、音箱系列

### 1.1 高阶音箱 BT896x / BT890x（带 HiFi4 DSP）

| 参数 | BT8969B | BT8961B | BT8962B | BT8901A | BT8901B |
|------|---------|---------|---------|---------|---------|
| 封装 | QFN68 7x7 | QFN52 6x6 | QFN32 4x4 | QFN40 5x5 | QFN40 5x5 |
| BT | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual |
| CPU | RISC-V+ 125MHz | RISC-V+ 125MHz | RISC-V+ 125MHz | RISC-V Max 160MHz | RISC-V Max 160MHz |
| DSP | HiFi4 300MHz | HiFi4 300MHz | HiFi4 300MHz | — | — |
| RAM | 892KB | 892KB | 892KB | 320KB | 320KB |
| 外接PSRAM | ✅ | ✅ | ✅ | — | — |
| Flash | 16Mbit | 16Mbit | 8Mbit | 8Mbit | 16Mbit |
| LE Audio | ✅收发 | ✅收发 | — | — | — |
| LC3/LHDC/LDAC | ✅/✅/✅ | ❌/✅/✅ | ❌/✅/✅ | ❌/❌/✅ | ❌/❌/✅ |
| MIC输入 | 3路 | 2路 | 1路 | 5路 | 5路 |
| DAC声道 | 3 | 3 | 2 | 2 | 2 |
| GPIO | 41 | 33 | 15 | 19 | 19 |
| **推荐应用** | **高阶差异化音箱、会议音箱** | **全功能音箱、Soundbar** | **高音质蓝牙音箱** | **高音质蓝牙音箱** | **高音质蓝牙音箱** |

### 1.2 广播音箱 AB580X / BT880X（双核 RISC-V）

| 参数 | BT8800A | BT8800B | BT8800C | BT8800D | AB5800T | AB5801A | AB5801H | AB5802B |
|------|---------|---------|---------|---------|---------|---------|---------|---------|
| 封装 | QFN52 | QFN52 | QFN52 | QFN52 | QFN52 | LQFP48 | QFN48 | QFN32 |
| BT | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual | 6.0 Dual |
| CPU | **双核 RISC-V FPU 187MHz** | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 |
| RAM | 312KB | 312KB | 312KB | 312KB | 312KB | 312KB | 312KB | 312KB |
| Flash | 8Mbit | 16Mbit | 8Mbit | 16Mbit | 外挂 | 8Mbit | 8Mbit | 8Mbit |
| LE Audio | ✅收发 | ✅收发 | ✅收发 | ✅收发 | ✅收发 | ✅收发 | ✅收发 | ✅收发 |
| LC3/LHDC/LDAC | ✅/✅/✅ | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 |
| DAC声道 | 差分双声道/四声道 | 同左 | 同左 | 同左 | 双声道 | 同左 | 差分双声道/四声道 | 差分单声道 |
| HDMI/SPDIF | ✅/✅/✅ | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 | 同左 |
| GPIO | 35 | 35 | 34 | 34 | 28 | 27 | 32 | 17 |
| 内置FM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **推荐应用** | **Soundbar / 广播音箱 / 车机 / 直播声卡 / AI音箱 / 彩屏音箱** |

### 1.3 K歌音箱 AB570x（带 PACC DSP 加速器）

| 参数 | AB5702B | AB5702C | AB5705B | AB5705C | AB5707E |
|------|---------|---------|---------|---------|---------|
| 封装 | QFN32 4x4 | QFN32 4x4 | SSOP24 | SSOP24 | SOP16 |
| CPU | RISC-V 180MHz + PACC | 同左 | 同左 | 同左 | 同左 |
| RAM | 192KB | 192KB | 192KB | 192KB | 192KB |
| Flash | 4Mbit | 4Mbit | 4Mbit | 4Mbit | 4Mbit |
| DAC/ADC SNR | 92/107 | 92/107 | 92/107 | 92/107 | 92/107 |
| 云端AI协议+Opus | ✅ | ✅ | ✅ | ✅ | ✅ |
| 内置充电 | 400mA | 400mA | 400mA | ❌ | 400mA |
| **推荐应用** | **K歌音箱 / 带屏音箱 / Soundbar** | **K歌音箱 / 带屏音箱** | **K歌音箱 / 头戴耳机** | **K歌音箱** | **简易音箱** |

### 1.4 标准音箱 AB530x / AB560x

| 参数 | AB5301C/H | AB5602D | AB5602B/C | AB5605B/C/E | AB5607E |
|------|-----------|---------|-----------|-------------|---------|
| 封装 | QFN48 | QFN32 | QFN32 | SSOP24 | SOP16 |
| CPU | RISC-V 180MHz+HWP | RISC-V 160MHz+HWP | 同左 | 同左 | 同左 |
| RAM | **192KB** | 128KB | 128KB | 128KB | 128KB |
| Flash | 8Mbit | 4Mbit | 4Mbit | 4Mbit | 4Mbit |
| DAC声道 | 立体声/四声道 | 立体声 | 立体声/单声道 | 立体声/单声道 | 双声道 |
| TWS对箱 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 云端AI+Opus | ✅ | ❌ | ❌ | ❌ | ❌ |
| **推荐应用** | **TWS对箱/拉杆箱/车机/Soundbar** | **时钟音箱/带屏音箱** | **立体声音箱** | **单声道音箱/K歌宝** | **简易带卡带U音箱** |

---

## 二、耳机系列

### 2.1 极致性价比 TWS AB561x/565x/575x/585x

**核心规格：** RISC-V 160MHz, 96-115KB RAM, 1-2Mbit Flash, QFN20 3x3 极小封装

**选型建议：**
- **需要 APP 控制：** AB5856C / AB5756A / AB5656A3 / AB5696D
- **OTP/EEPROM 低成本方案：** AB5756F(1Mbit OTP) / AB5756T(OTP) / AB5656T3(OTP)
- **ESOP8 超小封装：** AB5759C / AB5659C3
- **立体声（非 TWS）：** AB5655B2 / AB5656B2 / AB5616B
- **需要 ANC（FF）：** AB5696D(内置ANC) / AB5616D6(FF ANC)
- **最新型号 AB585x 系列：** DAC SNR 提升到 110dB，支持入耳检测

### 2.2 低功耗 TWS AB573x / AB571x / AB563x（带 NPU）

| 参数 | AB5736E/F (FF ANC) | AB5712C (ANC头戴) | AB5712F (ANC TWS) | AB5632F (ANC TWS) |
|------|-------------------|-------------------|-------------------|-------------------|
| 封装 | QFN20 3x3 | QFN32 4x4 | QFN32 4x4 | QFN32 4x4 |
| CPU | RISC-V+HWP+PACC | **RISC-V+NPU+HWP** | **RISC-V+NPU+HWP** | RISC-V 160MHz+HWP |
| RAM | **280KB** | **280KB** | **280KB** | 256KB |
| 功耗 | **~4.5mA** | ~6.3mA | ~5.8mA | ~6.0mA |
| ANC | FF | **FF/FB** | FF | FF |
| ENC | 双MIC AI ENC | 单MIC DNN ENC | 双MIC AI ENC | 双MIC AI ENC |
| DAC SNR | **108dB** | 103dB | 103dB | 99dB |
| **推荐应用** | **低功耗 FF ANC TWS** | **ANC 头戴耳机** | **ANC TWS 耳机** | **标准 ANC TWS** |

### 2.3 BT891x（入门级 ANC TWS）

BT8912E (8Mbit) / BT8912F (16Mbit)
- 300KB RAM, RISC-V+NPU+HWP+PACC
- **功耗最低 ~4.2mA**
- FF ANC, 双MIC AI ENC
- 声加 ENC 内置
- **96KHz/24bit, DAC SNR 110dB, LDAC 支持**
- ✅ 云端AI+Opus, BLE 2Mbps

### 2.4 BT892x 讯龙二代（主流 ANC TWS）

| 型号 | ANC | MIC | 封装 | 推荐应用 |
|------|-----|-----|------|---------|
| BT8922A | FF | 1MIC | QFN32 | 入门ANC单麦 |
| BT8922H | **Hybrid** | 2MIC | QFN32 | **Hybrid ANC 旗舰** |
| BT8922C | **Hybrid** | 2MIC | QFN32 | Hybrid ANC |
| BT8922E | FF | 2MIC | QFN32 | FF ANC 双麦 |
| BT8922F | FF | 2MIC | QFN32 | FF ANC 双麦(16M) |
| BT8922B/D | 无 | 1MIC | QFN32 | 无ANC TWS |
| BT8926B/D | 无 | 1MIC | QFN20 | 超小封装 TWS |

全部 256KB RAM, 8-16Mbit Flash, 声加 ENC 内置, BLE 弹窗, 云端AI

### 2.5 BT893x 讯龙二代增强版（Hi-Res）

**核心升级：** DAC SNR **106dB**, LDAC 支持, 96KHz/24bit, 320KB RAM

| 型号 | ANC | MIC | 封装 | 定位 |
|------|-----|-----|------|------|
| BT8931H | **Hybrid ANC Stereo** | 5MIC | QFN40 4x6 | **旗舰头戴 ANC** |
| BT8932H | **Hybrid/FF/FB** | 3MIC | QFN32 | Hybrid TWS 旗舰 |
| BT8932E | FF | 2MIC | QFN32 | FF ANC TWS |
| BT8932F | FF | 2MIC | QFN32 | FF ANC TWS (16M) |
| BT8932B | 无 | 1MIC | QFN32 | 无ANC TWS |
| BT8932D | 无 | 1MIC | QFN32 | 无ANC TWS (16M) |

### 2.6 BT897x（最新中端 TWS）

| 型号 | 定位 | RAM | DAC SNR | LDAC/LHDC |
|------|------|-----|---------|-----------|
| BT8970H | **Hybrid ANC 头戴** 🏆 | 408KB | 110dB | ✅/✅ |
| BT8971H | **Hybrid ANC TWS** 🏆 | 408KB | 110dB | ✅/✅ |
| BT8972H | Hybrid ANC TWS | 408KB | 110dB | ✅/✅ |
| BT8972F | FF ANC TWS | 408KB | 110dB | ✅/✅ |

全部：RISC-V-FPU+NPU+HWP+PACC, 16Mbit Flash, 96KHz/24bit, Hi-res USB

### 2.7 BT895x 讯龙三代（旗舰级）

| 型号 | BT8951H | BT8952F |
|------|---------|---------|
| 封装 | QFN40 4x6 | QFN32 4x4 |
| CPU | RISC-V+ 125MHz + **HiFi4 DSP** | 同左 |
| RAM | **892KB** | **892KB** |
| LE Audio | ✅ | ✅ |
| 功耗 | **~4.0mA** | **~4.0mA** |
| ANC | **Hybrid + Adaptive (WING)** | **Hybrid + Adaptive (WING)** |
| Pass through | AI Pass through | AI Pass through |
| 3rd ANC/ENC | ✅ | ✅ |
| 语音唤醒 | ✅ | ✅ |
| Audio | **192KHz/24bit** | **192KHz/24bit** |
| LC3/LHDC/LDAC | ✅/✅/✅ | ✅/✅/✅ |
| **推荐应用** | **旗舰 Hybrid ANC TWS** | **旗舰 Hybrid ANC TWS** |

---

## 三、穿戴视频系列

### BT8790TS4 / VS4（旗舰智能手表芯片）

- **双核 RISC-V-FPU 288MHz**（CPU 480KB + GPU 288KB = **768KB SRAM**）
- 外挂 Flash + PSRAM 32Mbit（200MHz OPI DDR, 400MB/s）
- **Bluetrum-GUI + LVGL-GUI** 双引擎
- **2.5D UI / 高斯模糊 / 动态表盘 / 矢量字体**
- 支持 30W&100W SPI-CSI & DVP-CSI 摄像头
- 外挂 GPS/CAT1/WiFi 模块
- 42 GPIO, USB 2.0 HighSpeed

### AB579x（中端手表芯片）

| 型号 | Flash | 定位 |
|------|-------|------|
| AB5790T | 外挂 | 旗舰级，2.5D UI，外挂GPS |
| AB5791B | 16Mbit SIP | 蓝牙通话，2.5D UI |
| AB5791C | 32Mbit SIP | 蓝牙通话，2.5D UI |
| AB5791F | 64Mbit SIP | 蓝牙通话，2.5D UI |
| AB5791G | **128Mbit SIP** | 蓝牙通话，2.5D UI |
| AB5792C | 32Mbit SIP | **小封装 QFN32** |

### AB569x / AB568x（入门手表/手环）

- AB569x: QFN40/52, 210KB RAM, SIP 8-256Mbit Flash
- AB568x: QFN32/3x3 小封装, 210KB RAM
- 适用：**手环 / 简易手表 / 带屏充电仓**
- 不支持 2.5D UI / 不支持摄像头

---

## 四、数字音频 MCU

| 型号 | 封装 | RAM | Flash | 应用 |
|------|------|-----|-------|------|
| **AB132A** | QFN32 | 64KB | 256KB | MP3音箱/扩音器/解码板/USB MIC/录音笔 |
| AB135A | SSOP24 | 64KB | 256KB | 无软开机MP3音箱 |
| AB135B | SSOP24 | 64KB | 256KB | 有软开机MP3音箱 |
| AB136M | QFN20 | 64KB | 256KB | **Type-C/Lightning 耳机转接头 96K** |
| AB136D | QFN20 | 64KB | 256KB | Type-C/Lightning 耳机转接头 |
| AB137A | SOP16 | 64KB | 256KB | 有软开机MP3音箱 |
| **BT8936T** | QFN32 | **320KB** | **512KB** | **Type-C/Lightning 耳机 96K Hi-Res** |
| AB176D | QFN20 | 28KB | 256KB | Type-C 有线耳机/转接头 |

---

## 五、BLE 系列

### AB205x（最新 BLE，2026 新增）

| 型号 | 封装 | GPIO | Flash | 应用 |
|------|------|------|-------|------|
| AB2057B | SOP16 | 10 | 2Mbit | 语音遥控器 |
| AB2056B | QFN20 | 12 | 2Mbit | **电子价签/物流标签/FMD** |
| AB2056D | QFN20 | 12 | **8Mbit** | 手环/智能戒指 |
| AB2051C | QFN32 | 23 | 4Mbit | 语音遥控器/键盘/鼠标/带屏充电仓 |
| AB2051T | QFN32 | 19 | 外挂 | 推屏/电子烟 |

- **功耗更低：** Deep sleep 2.1uA, sniff@1s 仅 19uA(buck) / 28uA(ldo)
- **DE SPI 支持**（显示屏接口）
- **RF 更强：** TX: 10-11dBm, RX: -95dBm

### AB202x / AB203x（成熟 BLE 系列）

详见选型表，覆盖从 ESOP8 到 QFN32 的 18 个型号。

---

## 六、语音玩具系列

### AB15x（基础玩具 MCU）

20KB RAM, 160MHz RISC-V, 0.5W Class-D 功放, MIDI 支持
- AB152H/A: **带屏电子烟**（QFN32, 28 GPIO, 21 Touch）
- AB153T: 挂图/儿童玩具/电子琴（SSOP28）
- AB155D/E/F/H: 地鼠机/儿童玩具（SSOP24, 17 Touch）
- AB157A/B/T: 棒棒糖/儿童玩具（SOP16, 10 Touch）
- AB159A/B: 按键播报玩具（SOP8，极致小封装）

### AB18x（增强玩具 MCU）

32KB RAM, USB 支持, 更多 ADC 通道
- AB187C: 录音/变音/播放玩具
- AB185C: 录音/变音/播放玩具
- AB182H: **带屏电子烟**（QFN32, 27 GPIO, 23 Touch）
- AB187H: 推屏/播放类应用
- AB185H: 推屏/播放类应用

---

## 芯片选型快速指南

| 你要做什么 | 推荐芯片 | 理由 |
|-----------|---------|------|
| **高阶 Soundbar / 会议音箱** | BT8969B | HiFi4 DSP + 892KB RAM + LE Audio |
| **广播音箱 / 车机 / 直播声卡** | BT8800A-D | 双核 RISC-V + 全功能接口 |
| **标准蓝牙音箱** | AB5301C/H | 180MHz + 192KB + TWS对箱 |
| **K歌音箱 / 带屏音箱** | AB5702B | PACC DSP + 云端AI |
| **成本敏感音箱** | AB5605B (SSOP24) | 最简封装，基本功能齐全 |
| **旗舰 Hybrid ANC TWS** | **BT8951H** 🏆 | 讯龙三代 + HiFi4 + Adaptive ANC |
| **Hi-Res ANC TWS** | BT8931H/BT8932H | LDAC + 106dB SNR |
| **Hybrid ANC TWS 中端** | BT8972H | 408KB + 110dB SNR + LHDC |
| **低功耗 ANC TWS** | AB5736E/F | 4.5mA + 280KB |
| **入门 ANC TWS** | BT8912E/F | 300KB + 110dB + LDAC |
| **极致性价比 TWS** | AB5756A/C | QFN20 3x3 极小封装 |
| **智能手表（旗舰）** | **BT8790TS4** 🏆 | 双核288MHz + 768KB + LVGL + 摄像头 |
| **智能手表（中端）** | AB5791G | 128Mbit SIP + 2.5D UI |
| **手环 / 带屏充电仓** | AB5692C | QFN32 小封装 |
| **Type-C 耳机 / 转接头** | **BT8936T** | 320KB + Hi-Res |
| **USB 音频 / 录音笔** | AB132A | 经典方案 |
| **BLE 遥控器 / 鼠标** | AB2051C | 最新 BLE + 23 GPIO |
| **BLE 电子价签 / 防丢器** | AB2056B | 超低功耗 2.1uA |
| **BLE 手环 / 智能戒指** | AB2056D | 8Mbit Flash 大存储 |
| **儿童玩具 / 电子琴** | AB153T | MIDI + 0.5W 功放 |
| **带屏电子烟** | AB152H / AB182H | 大 GPIO + Touch |
| **蓝牙通话手表** | AB5791C | 蓝牙通话 + 2.5D UI |

---

## 配套工具索引

### 下载工具
| 工具 | 位置 |
|------|------|
| Downloader v3.5.5 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/downloader_v3.5.5/` |
| Downloader v3.5.1 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/downloader_v3.5.1/` |
| Downloader v3.3.8 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/downloader_v3.3.8_authoried/` |
| Downloader v2.x | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/downloader_v2.9.8/` 等 |
| USBDown v1.5 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/USBDown安装包-v1.5/` |

### 调试/产测工具
| 工具 | 位置 |
|------|------|
| TSBox v284 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/tsbox_v284_20240430/` |
| UartDump 2.0 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/UartDump 2.0/` |
| 蓝牙测试盒 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/蓝牙测试盒使用说明书_V2.0_20200728.pdf` |
| FCC 工具 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/FCC/` |
| DebugData | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/DebugDatas/` |

### 音效工具
| 工具 | 位置 |
|------|------|
| Bluetrum DSP Tool v1.5.4 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/blueturm_dsp_tool_v1.5.4-20240408/` |
| Equalizer v1.2.1 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/equalizer_v1.2.1/` |
| GoldWave | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/goldwave/` |

### 其他工具
| 工具 | 位置 |
|------|------|
| IDE 编译环境 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/IDE/` |
| RV32 Toolchain v1.5.7 | `/mnt/e/Keane/中科蓝汛/中科蓝讯编译环境/rv32-toolchain_v1.5.7/` |
| OTA 工具 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/ab-ota-demo_general_1.4/` |
| ABControl v1.6.1 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/abcontrol_v1.6.1/` |
| ABMate v1.2.1 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/abmate_v1.2.1/` |
| XLink v2.0 | `/mnt/e/Keane/中科蓝汛/bluetrum_ tools/xlink_v2.0/` |
| 加密狗 | `/mnt/e/Keane/中科蓝汛/加密狗/中科蓝讯加密狗使用说明_私钥配置/` |

---

> **使用方式：** 在 Hermes CLI 中输入 `@file:/mnt/d/Hermes/projects/bluetrum/bluetrum_chip_db.md` 即可快速查找芯片资料
> 或运行 `python3 /mnt/d/Hermes/projects/bluetrum/bluetrum_query.py` 交互式搜索

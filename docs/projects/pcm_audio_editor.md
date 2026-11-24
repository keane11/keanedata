---
title: 纯 C 零依赖音频波形/频谱编辑器（PCMPlayer）
description: 用单文件 ~1180 行纯 C + Win32 GDI + Windows Media Foundation 实现 Audition 风格轻量音频工具：支持裸 PCM/WAV/MP3/FLAC/M4A 解码、实时波形与 FFT 频谱图、帧级剪辑与 16 级撤销、格式重采样导出。
date: 2026-11-24
tags: [C, Win32, 音频处理, FFT, Media Foundation, 工具开发]
order: 5
---

# 纯 C 零依赖音频波形/频谱编辑器（PCMPlayer）

> 在嵌入式音频与蓝牙调试日常中，经常要打开一堆裸 `.pcm`（无文件头）或非标 `.wav` 文件看波形、看底噪频谱、剪掉头尾静音再转成 16kHz 单声道。打开 Adobe Audition 太重，于是用 **单文件 ~1180 行纯 C + Windows 原生 API（零第三方依赖）** 写了一个秒开的 Audition 风格音频播放器与编辑器。

---

## 1. 项目目标与设计取舍

### 核心需求
- **极速启动、单文件分发**：不依赖 Qt / Electron / FFmpeg 动态库，编译出来就是一个几百 KB 的独立 `.exe`；
- **裸 PCM 友好**：支持直接拖入 `.pcm` 文件，顶部下拉框实时切换采样率（8k–96kHz）、位深（8/16 bit）、声道数（1/2 ch），立即重绘波形与频谱；
- **常见格式全兼容**：直接解码 `WAV / MP3 / FLAC / M4A / AAC / WMA / OGG`；
- **可视化分析**：上半区波形（带幅度轴与时间轴），下半区短时傅里叶变换（STFT）频谱图，支持滚轮以鼠标为中心缩放、调整 dB 噪底与配色方案；
- **常用音频剪辑**：拖拽选区 → 删除片段、插入指定毫秒静音、复制/粘贴、移动片段、16 级撤销（`Ctrl+Z`）、安全覆写源文件（`Ctrl+S`）或另存为；
- **内置格式转换**：支持内部重采样、声道混音（单声道↔立体声）、位深重量化后导出为 `WAV / MP3 / FLAC`。

### 技术选型（零外部依赖）

| 能力模块 | 采用方案 | 选型原因 |
|---|---|---|
| 窗口与界面 | Win32 API（Unicode `wWinMain`）+ GDI | 零运行时依赖，Windows 原生秒开 |
| 通用编解码 | Windows **Media Foundation**（`IMFSourceReader` / `IMFSinkWriter`） | Windows 10/11 系统自带，免打包 FFmpeg |
| 非标 WAV 兜底 | 自写 RIFF/WAVE 解析器（支持 PCM / IEEE Float32 / **IMA-ADPCM**） | 嵌入式设备录制的非标 WAV（尤其是 4-bit IMA-ADPCM）常被系统解码器拒开 |
| 音频播放 | `winmm`（`waveOutOpen` / `waveOutWrite` / `waveOutGetPosition`） | 极简直接，按字节偏移实现精确点播与播放游标同步 |
| 频谱计算 | 自写 1024 点基 2 Cooley-Tukey FFT + Hann 窗 | 代码仅 ~20 行，无 FFTW 依赖 |
| 频谱绘制 | `CreateDIBSection` 32 位像素缓冲 + `BitBlt` | 避免逐像素 `SetPixel`，重绘流畅不闪烁 |

---

## 2. 界面布局与架构总览

整体采用类 Audition 深色双栏布局（最小窗口 `1240×600`）：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 顶栏：打开... 转换... | 采样率 位深 声道 | dB底 配色 | 时间读数 | 状态提示 │
├──────────────┬───────────────────────────────────────────────────────┤
│ 文件列表      │ 波形 Waveform（幅值轴 +1.0 ~ -1.0 + 时间轴）            │
│ (支持多文件   │   [双缓冲 HBITMAP + 选区反色高亮 + 黄色光标 / 红色播放线] │
│  拖拽导入)    ├───────────────────────────────────────────────────────┤
│              │ 频谱 Spectrogram（频率轴 0 ~ Nyquist + 时间轴）         │
│ 删片段/插空白 │   [1024-pt FFT DIBSection + 热力/灰度/冰蓝 3套配色]     │
│ 复制/粘贴     ├───────────────────────────────────────────────────────┤
│ 移动片段      │ [================ 水平视图滚动条 ================]     │
│ 保存源/另存为 │                                                       │
│ 撤销/列表删   │                                                       │
│ 放大/缩小/全览│                                                       │
│ 上一首/下一首 │                                                       │
│ 播放 / 停止   │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

内部所有音频编辑和渲染都统一在**内存中的原始 PCM 缓冲区**（`g_data` + `g_size` + `g_fmtRate/g_fmtBits/g_fmtChans`）上完成：
- 解码时将压缩格式统一展开为交错 PCM；
- 剪辑时直接按帧边界（`frameBytes = chans * bits / 8`）做字节级切片、插入、搬移；
- 渲染、播放、导出全部共用同一份 PCM 缓冲，逻辑高度统一。

---

## 3. 核心模块实现拆解

### 3.1 解码链路：Media Foundation + 原生 WAV/ADPCM 兜底

加载文件时按扩展名与容错策略走三级路径：

1. **`.pcm` 文件**：直接按原始字节读入内存，按顶部下拉框当前参数解释并渲染；
2. **其他音频格式**：优先调用 `MFCreateSourceReaderFromURL`，强制设置输出子类型为 16-bit PCM，循环 `ReadSample` 拼接到动态扩容缓冲区；
3. **原生 WAV 兜底**：如果 Media Foundation 打开 `.wav` 失败，自动回退到自写的 `DecodeWAV`，手动遍历 RIFF chunk：
   - `0x0001`（标准 8/16-bit PCM）：直接提取 `data` 块；
   - `0x0003`（IEEE Float32）：逐样本限幅 `[-1.0, 1.0]` 后量化为 `int16`；
   - `0x0011`（4-bit **IMA-ADPCM**）：按块头读取 `predictor` 与 `step_index`，查 89 级步长表还原 16-bit PCM（兼容单声道与双声道 4 字节交错块）。

### 3.2 波形与 FFT 频谱双缓冲渲染

为了保证拖动播放线、拖拽选区时不卡顿，将**耗时的计算与轻量级叠加层**分离：

- **离线位图缓存**：仅在加载文件、编辑音频、缩放或窗口大小变化时重算 `g_wfBmp`（波形位图）与 `g_specBmp`（频谱位图）；
- **波形降采样**：对屏幕每一列像素 `x`，计算对应样本区间 `[a, b)` 内的最大值 `mx` 和最小值 `mn`，画一条竖线连接 `(x, y1)` 到 `(x, y2)`，既保证峰值不丢失又极大减少绘制调用；
- **频谱图渲染**：对每个像素列 `x` 在当前视口内取 1024 个单声道样本，加 Hann 窗后执行原位基 2 FFT，将幅值转为 dB（`20 * log10(mag + 1e-9)`），按可调底噪（`-60 / -72 / -90 / -120 dB`）归一化后查 3 套色表（热力 Heat / 灰度 Gray / 冰蓝 Ice）直接写入 `CreateDIBSection` 像素内存；
- **高频叠加层**：`WM_PAINT` 中只需 `BitBlt` 拷贝缓存位图，再叠加选区（`PatBlt(..., DSTINVERT)` 反色高亮）、黄色编辑光标与红色播放进度线，33ms 定时刷新（~30 FPS）几乎零 CPU 占用。

### 3.3 帧对齐编辑、16 级撤销与安全覆写保存

音频剪辑最容易出现的问题是**字节未按帧对齐**导致声道错位或爆音。核心保护措施：

- **帧边界强制对齐**：所有选区起止点与光标偏移都经过 `AlignByte` 向下对齐到 `chans * (bits / 8)` 的整数倍；
- **8-bit 与 16-bit 静音差异**：16-bit 有符号 PCM 静音字节是 `0x00`，而 8-bit 无符号 PCM 静音中点是 **`0x80`（128）**，插入空白时需按位深区分填充，否则 8-bit 音频插静音会产生刺耳直流爆音；
- **16 级 Undo 快照栈**：每次删片段、插空白、粘贴、移动前调用 `PushUndoState`，不仅保存 PCM 数据快照，连同格式参数、视口缩放位置、选区与 `dirty` 状态一并压栈；
- **原子覆写源文件**：按 `Ctrl+S` 保存源文件时，先写入同扩展名临时文件（`xxx.tmp.wav`），确认写入成功后再用 `MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)` 原子替换原文件，防止编码失败或中断把原音频写坏。

### 3.4 内部格式转换与重采样导出

「转换...」弹窗支持指定目标采样率、位深、声道，并导出为 `WAV / MP3 / FLAC`：
1. 将当前 PCM 统一归一化为 `float` 多声道数组；
2. 按 `ratio = targetRate / srcRate` 做线性插值重采样；
3. 执行声道混音（多声道均值下混单声道，或单声道复制扩展立体声）；
4. 重新量化为目标位深（8/16-bit），再按目标格式走 `WriteWavBuf` 或 Media Foundation `IMFSinkWriter`（MP3 128kbps / FLAC 无损）写出。

---

## 4. 快捷键与交互速查

| 操作 / 快捷键 | 功能说明 |
|---|---|
| 拖入文件（支持多选） | 自动加入左侧文件列表并加载首文件 |
| 波形/频谱上**单击** | 从点击位置直接开始播放 |
| 波形/频谱上**拖拽** | 框选音频片段（自动停止播放并显示选区时长与字节数） |
| 鼠标滚轮 | 以当前鼠标指针位置为中心缩放时间轴 |
| `Ctrl + C` / `Ctrl + V` | 复制选区 / 在黄色光标处粘贴（会校验格式一致性） |
| `Delete` | 删除当前选中片段 |
| `Ctrl + Z` | 撤销上一步编辑（最多 16 级） |
| `Ctrl + S` / `Ctrl + Shift + S` | 安全覆写源文件 / 另存为 `.pcm/.wav/.mp3/.flac` |
| `Esc` | 清除当前选区 |

---

## 5. 编译命令（WSL / MinGW 交叉编译）

在 WSL Ubuntu 安装 `mingw-w64` 后，一行命令直接生成 Windows 64 位独立可执行文件：

```bash
x86_64-w64-mingw32-gcc pcmplayer.c -o PCMPlayer.exe \
  -mwindows -municode -finput-charset=UTF-8 -O2 \
  -lwinmm -lcomdlg32 -lgdi32 -lole32 -lmfplat -lmfreadwrite -lmfuuid -lm
```

同时程序在启动时通过 `SetUnhandledExceptionFilter(CrashHandler)` 注册了全局崩溃捕获器，遇到未处理异常会自动把异常码、地址与操作日志写入同目录的 `PCMPlayer.log`，方便排查现场问题。

---

## 6. 实战踩坑复盘

1. **切换文件崩溃（UAF）**：`waveOutWrite` 播放时直接引用了 `g_data` 内存指针。如果加载新文件时先 `free(g_data)` 再停播放，声卡驱动线程会读到已释放内存直接崩溃。必须在 `LoadAny` 和每次破坏性编辑的最开头先调用 `StopPlay()`（`waveOutReset` + `waveOutUnprepareHeader` + `waveOutClose`）。
2. **8-bit PCM 静音填充**：习惯性 `memset(buf, 0, len)` 会导致 8-bit 音频插入“静音”时拉到 `-1.0` 满幅直流偏移，产生巨大“啪”声；必须按 `bits == 8 ? 128 : 0` 填充。
3. **Media Foundation 编码 8-bit 失败**：Windows 自带的 MP3 / FLAC SinkWriter 不接受 8-bit PCM 输入，编码前需先把 8-bit 无符号样本左移提升为 16-bit 有符号 PCM。
4. **Windows `WM_ERASEBKGND` 闪烁**：播放游标 30Hz 重绘时如果放任系统擦除背景，画面会严重闪烁。直接拦截 `WM_ERASEBKGND` 返回 `1` 并配合离线位图 `BitBlt`，即可彻底消除闪烁。

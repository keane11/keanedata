---
title: Windows 私有 SCSI 固件升级协议静态逆向实战
description: 零实机运行、零硬件抓包，通过静态源码、PE32 原生 DLL 反汇编与 MSI/.NET IL 分析，完整还原一套基于 Windows IOCTL_SCSI_PASS_THROUGH_DIRECT 的嵌入式 USB 固件升级协议，并审计出 5 类可靠性缺陷。
date: 2026-11-24
tags: [逆向分析, USB, SCSI, Windows, 嵌入式, 固件升级]
order: 6
---

# Windows 私有 SCSI 固件升级协议静态逆向实战

> 本文记录一次针对某嵌入式音频设备 Windows 上位机升级工具的**纯静态协议逆向与可靠性审计实践**（文中已对具体厂商工具名、芯片型号与内部路径做泛化脱敏，聚焦协议原理与分析方法论）。
>
> **分析前提**：全程不安装软件包、不运行原 EXE/DLL、不连接实机设备，仅凭安装包、上位机源码及二进制静态分析，还原 PC 端真实传输链路，并严格界定「可证实结论」与「待实机抓包验证范围」。

---

## 1. 背景与核心结论

许多嵌入式设备接入 PC 后会枚举成 U 盘（USB Mass Storage）形态，容易让人误以为“把固件文件拖进盘符就完成了升级”。通过静态分析，这套上位机实际采用的是 **「USB 存储设备 + 厂商自定义 SCSI CDB（Command Descriptor Block）」** 方案：

- **不是**把文件复制到盘符文件系统；
- **不使用**串口、HID、标准 USB DFU 或网络接口；
- 盘符（如 `X:`）仅用来通过 Windows `CreateFileW` 打开底层存储设备句柄，再借助 **`IOCTL_SCSI_PASS_THROUGH_DIRECT`** 将厂商私有 SCSI 命令与原始固件分块透传给设备。

### 完整调用链

```text
上位机应用（C# WinForms / x86）
  └─ P/Invoke 调用原生封装 DLL（x86 PE32）
       ├─ OpenByDrv  → CreateFileW("\\.\X:", GENERIC_READ|GENERIC_WRITE, ...)
       ├─ GetInfo    → DeviceIoControl(0x002D1400 / IOCTL_STORAGE_QUERY_PROPERTY)
       └─ Request    → DeviceIoControl(0x0004D014 / IOCTL_SCSI_PASS_THROUGH_DIRECT)
            └─ Windows 存储协议栈（USB Mass Storage 驱动）
                 └─ 设备端私有 SCSI 命令处理器
```

---

## 2. 静态取证方法论（四步闭环）

为了防止“看错旧版源码”或“凭注释瞎猜”，整个分析遵循严格的静态取证流程：

1. **归档完整性校验**：先对原始压缩包与解压出的全部文件计算 SHA-256 清单，并针对中文旧版 ZIP 按 CP936/GBK 解码保留路径；同时比对不同构建目录和安装包内提取的原生 DLL 哈希，确认多份 DLL 完全一致。
2. **托管层分析（C# 源码 + .NET IL）**：
   - 通读 WinForms 源码定位设备枚举、文件读取、分块发送和 UI 定时器逻辑；
   - 对仅提供 `.msi` 的历史安装包，只读解析 MSI 表并解包内嵌 CAB 取出 EXE，反编译查看其 **.NET IL**，交叉验证不同版本的核心发包逻辑是否一致（避免仅凭新版源码推测旧版行为）。
3. **原生层分析（x86 PE32 反汇编）**：
   - 对封装传输的原生 DLL 定位导出函数（`OpenByDrv`、`GetInfo`、`Request`）的 RVA 与文件偏移；
   - 结合微软官方 WDK 文档，逐字段还原传递给 `DeviceIoControl` 的结构体偏移、控制码、超时与重试逻辑。
4. **缺陷独立复现**：发现可疑越界代码后，不运行原程序，而是抽出等价最小片段单独验证触发条件，避免误报。

---

## 3. 协议与传输机制深度还原

### 3.1 设备识别逻辑（存储属性而非 USB 数值 VID/PID）

上位机周期性枚举 `DriveInfo.GetDrives()`，筛选 `DriveType.Removable`，打开盘符句柄后调用 `GetInfo`：

- 底层通过 **`IOCTL_STORAGE_QUERY_PROPERTY`（`0x002D1400`）** 查询 `StorageDeviceProperty`；
- 检查总线类型 `BusType == 7`（`BusTypeUsb`）；
- 将返回的 `VendorId`、`ProductId`、`ProductRevision` ASCII 描述字符串直接拼接，与目标设备固定标识字符串做精确匹配。

> 💡 **常见误区澄清**：`StorageDeviceProperty` 里的 `VendorId` / `ProductId` 是 SCSI Inquiry 返回的描述字符串，**并非** USB 设备描述符里的 16 位十六进制 VID/PID。

### 3.2 私有 SCSI CDB 报文结构

选定固件文件后，上位机直接调用 `File.ReadAllBytes` 原样读取原始字节——**PC 端不做任何解压、解密、封装头解析或校验计算**，随后按 **512 字节** 分块循环下发：

| 参数 | 实际值 | 说明 |
|---|---|---|
| **写命令 CDB** | `F0 21 00 00 00 00 00 00 00 00` | 10 字节固定命令（厂商自定义操作码 `0xF0` + 子命令 `0x21`，后 8 字节全零） |
| **数据方向** | `DataIn = 0`（`SCSI_IOCTL_DATA_OUT`） | PC → 设备 |
| **单块负载** | 512 字节连续原始固件字节 | 长度通过独立 `DataTransferLength` 传入，不编码在 CDB 内 |
| **地址/序号** | 无 | 偏移量仅在 PC 内存中顺序递增，CDB 内不携带偏移、块号或总长度 |
| **结束握手** | 无 | 本地剩余字节数归零后直接停定时器、关句柄并提示“升级成功” |

> **细节考证**：源码定义了一个 6 字节请求模板数组，拷贝进清零的 16 字节缓冲区后，调用底层接口时传入 `cdbLen = 10`——因此线上传输的真实 CDB 长度是 **10 字节**，而不是直觉看到的 6 字节或 16 字节。

另外，界面上所谓的「高速 / 标准 / 低速」模式，**并没有切换 USB 总线速率**，本质上只是把 WinForms `Timer` 的发包间隔分别设为 `1ms / 25ms / 150ms`。

### 3.3 底层 `SCSI_PASS_THROUGH_DIRECT` 内存布局（x86）

通过反汇编原生 DLL 的 `Request` 函数，还原出它使用了一块 **80 字节** 复用缓冲区（44 字节结构体 + 4 字节对齐填充 + 32 字节 Sense Buffer）调用 `DeviceIoControl(0x0004D014)`：

```text
Offset  Size  字段                  赋值（x86 PE32 实测）
────────────────────────────────────────────────────────────
0x00    2     Length                44 (sizeof(SCSI_PASS_THROUGH_DIRECT))
0x02    1     ScsiStatus            (返回状态，DLL 未检查)
0x03    1     PathId                0
0x04    1     TargetId              1
0x05    1     Lun                   0
0x06    1     CdbLength             调用参数（升级时为 10）
0x07    1     SenseInfoLength       32
0x08    1     DataIn                调用参数（写=0，读=1）
0x0C    4     DataTransferLength    单块长度（常规整块 512）
0x10    4     TimeOutValue          5（秒）
0x14    4     DataBuffer            调用方固件块指针（32 位指针）
0x18    4     SenseInfoOffset       48（指向结构尾后的 32 字节 Sense 区）
0x1C    16    Cdb[16]               拷贝前 CdbLength 字节（F0 21 00...）
0x30    32    SenseBuffer           Sense 返回区
```

DLL 内部自带简单重试机制：`DeviceIoControl` 返回失败时最多尝试 **10 次**（间隔 `20ms`）；如果 `GetLastError() == 55`（`ERROR_DEV_NOT_EXIST`，设备拔出），则立即中止返回失败。

---

## 4. 审计发现的 5 类可靠性缺陷

静态梳理完协议逻辑后，顺手发现了几个直接影响产线/用户端升级可靠性的典型 Bug：

1. **非 512 字节整数倍文件必触发尾块越界**：
   - 上位机发送逻辑先执行了 `Array.Copy(fileBytes, offset, buf, 0, 512)`，**之后**才判断剩余长度不足 512 并计算实际 `sendLen`。
   - 一旦固件长度不是 512 字节整数倍（或小于 512 字节），最后一块拷贝就会在发包前直接抛出 `System.ArgumentException`。
   - *注意*：这属于上位机代码缺陷，**不能**凭此推定设备协议要求补零对齐，更不应擅自在未知固件尾部填充 `0x00`。
2. **上层忽略底层传输返回值**：调用 `Request(...)` 时未检查返回值，哪怕 DLL 10 次重试全部失败，发送进度计数依然继续往前推进。
3. **底层忽略 SCSI 状态与 Sense 码**：DLL 只判断 `DeviceIoControl` API 本身是否返回 `TRUE`，未检查 `ScsiStatus != 0` 或解析 `SenseBuffer`（即使设备端明确返回 SCSI `CHECK CONDITION`，上位机也会当成成功）。
4. **“升级成功”缺少设备端闭环**：只要 PC 本地剩余字节数减到 0 就直接弹窗成功，没有任何提交命令、CRC 校验回执或版本读回确认（源码中预留了一条 `0xF1` 读命令，但调用代码已被注释）。
5. **升级期间未暂停设备扫描定时器**：后台在线检测定时器在升级过程中仍在运行，且扫描逻辑遇到其他非移动盘符时会错误重置设备在线状态标志。

---

## 5. 静态分析的证据边界（工程严谨性）

做逆向和协议分析时，最忌讳把“合理推测”写成“已确认事实”。本次纯静态分析明确划分了边界：

- **✅ 已证实（PC 端完整传输层）**：设备打开方式、存储属性识别逻辑、私有 CDB 命令字与长度、数据方向、512B 分块方式、Windows IOCTL 结构体布局、超时与重试策略，以及 5 处上位机缺陷。
- **❓ 暂无法仅凭上位机证实（需设备端固件或 USB 抓包）**：
  - USB 总线层传输细节（BOT 封装、端点号、真实 VID/PID）；
  - 固件包内部头部结构、加密/签名与 CRC 校验规则；
  - 设备端 Flash 擦写地址映射、如何判定固件接收完毕以及是否自动复位。

> 若后续要编写跨平台（如 Linux / macOS / Python）替代烧录工具或还原设备端接收逻辑，下一步应基于 Wireshark + USBPcap 抓一次真实升级流量，并结合设备 Bootloader 反汇编做端到端交叉印证。

---

## 6. 参考资料

- Microsoft WDK: [`IOCTL_SCSI_PASS_THROUGH_DIRECT`](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddscsi/ni-ntddscsi-ioctl_scsi_pass_through_direct)
- Microsoft WDK: [`SCSI_PASS_THROUGH_DIRECT` structure](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddscsi/ns-ntddscsi-_scsi_pass_through_direct)

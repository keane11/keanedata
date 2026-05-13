# Hermes Agent 配置优化任务书

> 用法：把这份文档完整发给 Hermes Agent，让 Hermes 按步骤检查、备份、修改配置、下载/安装 Skills，并输出执行结果。  
> 目标环境：Windows + WSL2 Ubuntu-22.04，本机已部署 Hermes Agent，当前只配置了 DeepSeek API，其它配置基本未改。

---

## 0. 你是 Hermes，请严格按这些原则执行

你需要帮我把 Hermes Agent 从“只配置了模型 API、可以启动”的状态，优化成一个更适合我日常使用的本地智能助手。我的主要用途是：

1. 嵌入式 C 代码分析、重构、调试、优化；
2. WSL2 / Windows / BAT 脚本 / 固件打包流程排错；
3. OTA 升级、串口协议、BLE、音频 FFT、MCU 低资源场景分析；
4. 通过微信或 CLI 给我做提醒、总结、排查和自动化任务；
5. 能记住我的开发环境和长期偏好；
6. 能下载、安装或创建一些实用的 Skill。

执行时必须遵守：

- 不要在聊天输出里泄露任何 API Key、Token、密码、Cookie。
- 修改任何配置文件之前，必须先备份。
- 不要删除我已有配置，只能追加、合并或注释说明。
- 如果遇到不确定的配置项，不要强行覆盖，先保留原配置并说明。
- 如果某个命令失败，要输出失败命令、错误信息、可能原因、下一步建议。
- 下载第三方 Skill 前要先检查来源、目录结构和 `SKILL.md` 内容，不要直接执行未知脚本。
- 对本机终端、文件写入、自动化任务等高权限能力要谨慎开启，优先限制工作目录。

---

## 1. 先收集当前 Hermes 状态

请先执行这些命令，并总结结果：

```bash
which hermes || command -v hermes
hermes --version || true
hermes config show || true
hermes model || true
hermes tools || true
```

如果 `hermes config show` 会输出密钥，请只确认“已配置/未配置”，不要打印密钥明文。

同时检查这些路径是否存在：

```bash
ls -la ~/.hermes || true
ls -la ~/.hermes/skills || true
ls -la ~/.hermes/memories || true
ls -la ~/.hermes/cron || true
ls -la ~/.hermes/config.yaml || true
ls -la ~/.hermes/.env || true
```

---

## 2. 备份当前配置

在任何修改前，创建带时间戳的备份目录：

```bash
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/.hermes_backup_$TS"
mkdir -p "$BACKUP_DIR"

[ -f "$HOME/.hermes/config.yaml" ] && cp "$HOME/.hermes/config.yaml" "$BACKUP_DIR/config.yaml.bak"
[ -f "$HOME/.hermes/.env" ] && cp "$HOME/.hermes/.env" "$BACKUP_DIR/.env.bak"
[ -d "$HOME/.hermes/skills" ] && cp -a "$HOME/.hermes/skills" "$BACKUP_DIR/skills.bak"
[ -d "$HOME/.hermes/memories" ] && cp -a "$HOME/.hermes/memories" "$BACKUP_DIR/memories.bak"
[ -d "$HOME/.hermes/cron" ] && cp -a "$HOME/.hermes/cron" "$BACKUP_DIR/cron.bak"

echo "Backup saved to: $BACKUP_DIR"
```

执行后告诉我备份目录路径。

---

## 3. 检查并优化模型配置

当前我只配置了 DeepSeek API。请检查 DeepSeek 是否已作为默认模型可用。

目标：

- DeepSeek 作为主模型；
- 如果已配置其它 Provider，可以设置 fallback；
- 如果没有其它 Provider，不强制配置，只提示我后续可以配置 OpenRouter / OpenAI / Claude / Gemini；
- 不要把 API Key 打印出来。

请检查：

```bash
hermes model
hermes config show
```

建议策略：

```text
主模型：DeepSeek，适合日常中文对话、代码分析、低成本使用。
备用模型：OpenRouter / OpenAI / Claude / Gemini 中任意一个，用于 DeepSeek 不稳定或不支持的任务。
视觉模型：如果我要让 Hermes 看图、分析截图，建议额外配置支持 vision 的模型。
辅助模型：标题生成、压缩、会话搜索等可用便宜小模型，降低成本。
```

如果 Hermes 支持 `hermes fallback` 命令，请帮我检查 fallback 是否配置；如果未配置，只输出建议，不要强制进入交互式流程。

---

## 4. 启用适合我的工具集

请检查当前启用的 toolsets/tools，然后建议启用下面这些：

```text
必要工具：
- file / 文件读写
- terminal / 本机终端命令
- code_execution / 代码执行
- memory / 长期记忆
- session_search / 会话搜索
- skills / Skill 加载与管理
- cronjob / 定时任务
- todo / 任务拆解
- PDF/word/PPT/excel等办公文档创建编辑

按需工具：
- web / search / browser，用于查资料
- messaging / send_message，用于微信或其它消息平台
- vision，用于截图/图片分析

暂时不建议默认全开：
- 高风险浏览器自动化
- Discord 管理类工具
- HomeAssistant 控制类工具
- 任何不明确用途的高权限插件
```

如果配置文件中存在 toolsets 字段，请在不破坏原配置的前提下合并。建议最终方向类似：

```yaml
toolsets:
  - file
  - terminal
  - code_execution
  - memory
  - session_search
  - skills
  - cronjob
  - todo
  - web
  - search
  - messaging
  - send_message
```

注意：实际字段名以本机 Hermes 版本为准。如果字段不同，请按当前版本正确格式修改。

---

## 5. 终端执行环境要限制风险

我在 Windows + WSL2 中使用 Hermes，常见项目路径在 `/mnt/d/`。请优先将终端工作目录限制在安全范围内，不要默认允许它在整个系统乱改。

建议：

```yaml
terminal:
  backend: local
  cwd: "/mnt/d"
  timeout: 180
```

如果 Hermes 当前版本使用不同字段，请按实际版本转换。

高风险命令规则：

- 不要执行 `rm -rf /`、格式化磁盘、清空用户目录等危险命令。
- 修改系统级文件前必须说明目的。
- 修改项目代码前先查看 git 状态。
- 能先 dry-run 就先 dry-run。

---

## 6. 写入我的长期记忆 Memory

请把下面内容写入 Hermes 的长期记忆中，优先使用 Hermes 内置 memory 工具；如果当前无法用 memory 工具，请写入 `~/.hermes/memories/USER.md` 或 `~/.hermes/memories/MEMORY.md`，但不要覆盖已有内容，只能追加。

需要记住：

```markdown
## 用户长期偏好与开发环境

- 用户主要做嵌入式 C 开发，很多场景是 MCU、无 OS 或弱 RTOS、低 RAM、低 CPU 开销。
- 用户默认不希望使用 Arduino 风格代码，除非明确要求。
- 用户常用 Windows + WSL2 Ubuntu-22.04，项目经常在 `/mnt/d/` 路径下。
- 用户经常处理 GPIO、定时器中断、UART、OTA 升级、FIFO、BLE、音频 FFT、RGB LED 效果、固件打包等问题。
- 用户希望技术回答默认使用中文。
- 给用户代码时，优先给可直接编译/运行/验证的完整方案，不要只给概念。
- 批处理 BAT 脚本场景中，用户通常要求双击运行、不要依赖 PowerShell、不要依赖第三方工具，除非用户明确放宽限制。
- 固件打包场景中，用户非常在意“二进制字段”和“ASCII 字符串”的区别，例如 4 字节长度/CRC 必须是真正的 binary little-endian 字段，不能写成文本。
- 用户希望排查问题时给出命令、预期输出、异常分支和回退方案。
- 用户不喜欢没有验证的猜测，遇到不确定点要说明不确定并给验证方法。
```

完成后，请告诉我 Memory 写入位置。

---

## 7. 下载官方/社区 Skill

请优先下载 Hermes 官方仓库里的 Skills。不要直接执行未知脚本，只复制 Skill 文档和相关模板。

### 7.1 下载官方 Hermes Agent 仓库到临时目录

```bash
mkdir -p "$HOME/.hermes_sources"
cd "$HOME/.hermes_sources"

if [ ! -d hermes-agent ]; then
  git clone --depth 1 https://github.com/NousResearch/hermes-agent.git
else
  cd hermes-agent
  git pull --ff-only || true
fi
```

如果无法访问 GitHub，请输出错误并停止下载，不要乱改。

### 7.2 查看官方 Skills 目录

```bash
find "$HOME/.hermes_sources/hermes-agent/skills" -maxdepth 3 -name "SKILL.md" | sort
```

请从中优先安装这些软件开发相关 Skill，如果存在：

```text
software-development/systematic-debugging
software-development/writing-plans
software-development/requesting-code-review
software-development/test-driven-development
software-development/subagent-driven-development
software-development/python-debugpy
```

如果某个目录不存在，跳过并说明。

### 7.3 安装到我的本地 Skills 目录

```bash
mkdir -p "$HOME/.hermes/skills/community/software-development"

SRC="$HOME/.hermes_sources/hermes-agent/skills/software-development"
DST="$HOME/.hermes/skills/community/software-development"

for skill in systematic-debugging writing-plans requesting-code-review test-driven-development subagent-driven-development python-debugpy; do
  if [ -d "$SRC/$skill" ]; then
    mkdir -p "$DST/$skill"
    cp -a "$SRC/$skill/." "$DST/$skill/"
    echo "Installed skill: $skill"
  else
    echo "Skip missing skill: $skill"
  fi
done
```

安装后请执行：

```bash
find "$HOME/.hermes/skills/community/software-development" -maxdepth 2 -name "SKILL.md" | sort
```

如果 Hermes 有 `skills_list`、`skill_view`、`skill_manage` 或类似命令/工具，请用它验证这些 Skill 能否被识别。

---

## 8. 创建我自己的嵌入式开发 Skills

请在 `~/.hermes/skills/user/` 下创建下面这些自定义 Skills。每个 Skill 至少包含一个 `SKILL.md`。

### 8.1 embedded-c-review

路径：

```bash
~/.hermes/skills/user/embedded-c-review/SKILL.md
```

内容：

```markdown
name: embedded-c-review
description: 嵌入式 C 代码审查：关注中断、缓冲区、低资源、可移植性和异常处理。
version: 1.0.0
author: user
license: private
platforms:
  - linux
  - windows
  - wsl

tags:
  - embedded-c
  - mcu
  - code-review
  - interrupt
  - memory

# 嵌入式 C 代码审查 Skill

## 适用场景

当用户让我审查、优化或重构嵌入式 C 代码时使用，尤其是 MCU、无 OS、弱 RTOS、UART、BLE、OTA、FIFO、中断、定时器、DMA、音频 FFT、RGB LED 控制相关代码。

## 审查重点

1. 中断上下文中是否做了耗时操作、阻塞调用、动态内存分配、复杂解析。
2. ISR 与主循环共享变量是否需要 `volatile`、临界区、关中断保护或原子访问。
3. FIFO/ring buffer 是否有越界、读写指针竞争、满/空判断错误。
4. OTA 接收是否区分固件流和普通交互数据。
5. 固件数据是否按块写入，例如 1 KB 满包写 FIFO，不要逐字节重负载处理。
6. 普通交互是否允许定时 20 ms 扫描处理，避免频繁解析。
7. 内存使用是否适合 MCU：避免大栈、递归、不可控 malloc/free。
8. 协议解析是否有长度检查、CRC 校验、状态机异常恢复。
9. 定时器周期、计数溢出、单位换算是否正确。
10. 是否能给出可编译、可验证、低资源开销的修改方案。

## 输出格式

优先按下面格式输出：

- 问题定位
- 风险等级
- 原因分析
- 修改建议
- 关键代码
- 验证方法

不要只给抽象建议，尽量给完整 C 代码片段。
```

### 8.2 ota-buffer-workflow

路径：

```bash
~/.hermes/skills/user/ota-buffer-workflow/SKILL.md
```

内容：

```markdown
name: ota-buffer-workflow
description: OTA 与普通交互接收缓冲区拆分流程，适合 UART/BLE/WiFi 固件升级通道。
version: 1.0.0
author: user
license: private
platforms:
  - linux
  - windows
  - wsl

tags:
  - ota
  - fifo
  - uart
  - ble
  - embedded-c

# OTA 接收缓冲区工作流

## 目标

当用户要求重构接收逻辑时，默认目标是区分 OTA 升级数据和普通交互数据：

- OTA 模式：接收数据累计满 1 KB 后写入 FIFO 或 flash 写入队列；
- 普通模式：不要每字节立即复杂处理，优先定时 20 ms 扫描或一次性解析；
- 两种模式共用底层接收入口，但状态机和缓冲策略分离。

## 推荐结构

1. 接收 ISR / 回调只做轻量搬运。
2. 使用 `rx_mode` 区分 `RX_MODE_NORMAL` 和 `RX_MODE_OTA`。
3. OTA 使用独立 `ota_buf[1024]`、`ota_len`、`ota_fifo_push()`。
4. 普通数据使用 ring buffer 或交互缓冲区。
5. 主循环或 20 ms timer 调度普通协议解析。
6. OTA 写入失败必须有错误状态和重试/退出策略。
7. 模式切换时清理相关缓冲区，避免普通数据混入 OTA 固件流。

## 必须检查

- 1 KB 边界处理：刚好满、超过 1 KB、多包残留。
- OTA 结束时不足 1 KB 的尾包处理。
- FIFO 满时如何处理。
- CRC/长度校验在哪一层做。
- 中断和主循环共享变量是否安全。
- OTA 模式下是否禁止普通协议误解析。

## 输出要求

提供状态机图或状态表，给出关键 C 结构体、枚举、接收入口函数、20 ms 处理函数、OTA flush 函数。
```

### 8.3 windows-bat-firmware-packaging

路径：

```bash
~/.hermes/skills/user/windows-bat-firmware-packaging/SKILL.md
```

内容：

```markdown
name: windows-bat-firmware-packaging
description: Windows BAT 固件拼接与二进制头生成排错流程。
version: 1.0.0
author: user
license: private
platforms:
  - windows
  - wsl

tags:
  - bat
  - firmware
  - ota
  - crc32
  - binary-header

# Windows BAT 固件打包 Skill

## 用户常见要求

用户经常要求纯 Windows `.bat` 双击运行，不使用 Arduino，不依赖第三方工具，不依赖 PowerShell，除非用户明确放宽。

## 关键原则

1. 文件大小、CRC32、时间戳等字段如果要求 4 字节 binary，就必须写真正的二进制字节，不要写 ASCII 文本。
2. `echo 0x12345678 > file` 写进去的是文本，不是 4 字节整数。
3. `copy /b a+b out` 用于二进制拼接，但不会自动生成 binary header。
4. Windows 原生命令生成任意 binary 字节能力有限，需要谨慎说明限制。
5. 如果允许使用 `certutil -decodehex`，可以通过 hex 文本生成 binary 文件，但要处理大小端。
6. 如果要求 CRC32，纯 BAT 很难可靠实现，应说明可选方案：PowerShell、Python、certutil/hash 限制、预编译小工具。

## OTA 头部常见格式

用户常用 OTA header：

- magic：4 字节 ASCII，例如 `zklx`
- firmware_crc32：4 字节
- total_length：4 字节，通常等于 header_len + firmware_len
- timestamp：4 字节
- version：6 字节，例如 ASCII `020001`
- header_len：22 字节

## 输出要求

先确认限制，再给方案。必须明确：哪些字段是 binary，哪些字段是 ASCII。给出可验证命令，例如 `certutil -dump`、`xxd`、`Format-Hex` 或 WSL `hexdump -C`。
```

### 8.4 wsl-windows-debug

路径：

```bash
~/.hermes/skills/user/wsl-windows-debug/SKILL.md
```

内容：

```markdown
name: wsl-windows-debug
description: Windows + WSL2 环境排查流程，适合 CLI 工具、路径、网络代理、apt 源、浏览器打开失败。
version: 1.0.0
author: user
license: private
platforms:
  - windows
  - wsl
  - linux

tags:
  - wsl2
  - windows
  - cli
  - proxy
  - apt

# WSL / Windows 排查 Skill

## 适用场景

用户在 WSL2 Ubuntu-22.04 中运行 Codex CLI、Claude Code、Gemini CLI、Hermes、apt、git、代理、VPN、浏览器登录等工具时遇到问题。

## 默认检查命令

```bash
pwd
whoami
uname -a
cat /etc/os-release
wsl.exe -l -v 2>/dev/null || true
ip addr || true
cat /etc/resolv.conf || true
env | grep -i proxy || true
which xdg-open || true
which git || true
which curl || true
```

## 常见问题

- 从 `/mnt/c/WINDOWS/system32` 启动导致工作目录不合适。
- WSL 没有浏览器，`xdg-open` 失败。
- apt 源慢或不可达，需要切换镜像源。
- Windows 代理可用，但 WSL 没有正确继承代理。
- CLI 工具要求在 git repo 或 trusted directory 中运行。

## 输出要求

给出 Windows PowerShell 和 WSL Bash 两套命令时，要明确在哪个环境运行。路径要区分 `C:\...`、`/mnt/c/...`、`/mnt/d/...`。
```

---

## 9. 创建几个实用 Cron 定时任务建议

先不要强制创建所有任务。请检查 cron 功能是否可用，并给我推荐下面任务。如果我允许，再创建。

推荐任务：

```text
1. 每天 09:00，总结嵌入式 C、AI Agent、蓝牙音频相关技术新闻，发送到微信或 CLI。
2. 每天 18:00，提醒我整理当天代码修改、遗留 bug、明天待办。
3. 每周五 17:30，生成本周项目问题清单和下周计划。
4. 每 2 小时检查指定日志文件，如果出现 error/fail/exception，就总结并通知我。
```

如果我已经配置了微信 `HOME_CHANNEL`，可以建议投递到微信；否则默认只在 CLI 或本地文件记录。

---

## 10. 微信/消息平台建议

如果我已经配置了微信，请检查当前策略。由于扫码登录可能是 iLink bot identity，普通微信群消息不一定可靠，优先保证私聊可用。

建议方向：

```env
WEIXIN_DM_POLICY=open
WEIXIN_GROUP_POLICY=disabled
WEIXIN_HOME_CHANNEL=我的私聊 chat_id
WEIXIN_HOME_CHANNEL_NAME=Home
```

如果要提高安全性，建议后续改成 allowlist：

```env
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=我的微信 user_id
```

不要直接把 ID 或 token 打印到公开输出里。

---

## 11. 最终验证

完成配置、Memory、Skills 后，请执行验证：

```bash
hermes config show || true
hermes tools || true
find ~/.hermes/skills -maxdepth 3 -name "SKILL.md" | sort
find ~/.hermes/memories -maxdepth 2 -type f | sort
```

然后启动测试：

```bash
hermes
```

在 Hermes 会话中测试这些问题：

```text
请读取我的长期偏好，告诉我回答嵌入式 C 问题时应该遵守哪些规则。

请列出当前可用 skills，并说明哪些适合嵌入式 C 代码重构。

请使用 embedded-c-review skill，审查一个 UART 中断接收函数时重点看什么？

请使用 ota-buffer-workflow skill，给我一个 OTA 模式和普通模式分离的接收架构。
```

如果 gateway 需要常驻运行，再执行：

```bash
hermes gateway run
```

---

## 12. 最终输出给我的报告格式

执行完成后，请按这个格式汇报：

```markdown
# Hermes 配置优化执行结果

## 已完成
- [ ] 已备份配置，备份目录：...
- [ ] 已检查模型配置
- [ ] 已检查/建议 fallback
- [ ] 已检查/启用工具集
- [ ] 已写入 Memory
- [ ] 已下载/安装官方 Skills
- [ ] 已创建用户自定义 Skills
- [ ] 已检查 Cron 能力
- [ ] 已检查微信/消息平台配置

## 安装的 Skills
- ...

## 修改过的文件
- ...

## 未完成/需要用户确认
- ...

## 风险提醒
- ...

## 下一步建议
- ...
```
 
---

## 13. 参考资料

- Hermes Agent 官方文档：https://hermes-agent.nousresearch.com/docs/
- Hermes Agent GitHub：https://github.com/NousResearch/hermes-agent
- Hermes Skills 文档：https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes Cron 文档：https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- Hermes 配置文档：https://hermes-agent.nousresearch.com/docs/user-guide/configuration

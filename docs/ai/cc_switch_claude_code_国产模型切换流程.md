# CC Switch 安装与 Claude Code 切换国产模型流程

本文档记录在 **Windows + WSL Ubuntu-22.04** 环境下安装 **CC Switch**，并通过 CC Switch 给 **Claude Code CLI** 切换到国产大模型，例如 DeepSeek API 的完整流程。

> 适用场景：Claude Code CLI 安装在 WSL Ubuntu 中，平时在 WSL 终端里执行 `claude`。

---

## 1. 环境说明

示例环境：

```bash
Windows PowerShell 进入 WSL：
wsl

WSL 路径：
/mnt/c/Users/11787/Downloads

WSL 用户：
keane

Ubuntu：
Ubuntu-22.04
```

Claude Code 如果是在 WSL 里运行，那么它读取的是 WSL 用户目录下的配置：

```bash
~/.claude/
```

不要和 Windows 用户目录混淆：

```text
C:\Users\11787\.claude\
```

如果 Claude Code 是在 WSL 里跑，建议 CC Switch 也安装到 WSL 里，否则 Windows 版 CC Switch 可能只修改 Windows 目录下的配置，导致 WSL 里的 `claude` 不生效。

---

## 2. 下载 CC Switch Linux 安装包

进入 Windows 下载目录对应的 WSL 路径：

```bash
cd /mnt/c/Users/11787/Downloads
```

下载 Linux x86_64 的 `.deb` 包：

```bash
curl -L -o CC-Switch-v3.14.1-Linux-x86_64.deb \
https://github.com/farion1231/cc-switch/releases/download/v3.14.1/CC-Switch-v3.14.1-Linux-x86_64.deb
```

检查文件是否正常：

```bash
ls -lh CC-Switch-v3.14.1-Linux-x86_64.deb
file CC-Switch-v3.14.1-Linux-x86_64.deb
```

正常情况下应类似：

```text
-rwxrwxrwx 1 keane keane 12M May  9 17:24 CC-Switch-v3.14.1-Linux-x86_64.deb
CC-Switch-v3.14.1-Linux-x86_64.deb: Debian binary package
```

如果下载出来只有几字节，例如 9 字节，说明下载错了文件名或 GitHub 链接没有真正下载到安装包。

错误示例：

```text
-rwxrwxrwx 1 keane keane 9 May  9 17:22 CC-Switch-v3.14.1-Linux.deb
```

这种文件不能安装，会出现：

```text
E: Invalid archive signature
E: could not locate member control.tar
```

正确文件名应带架构字段：

```text
CC-Switch-v3.14.1-Linux-x86_64.deb
```

---

## 3. 安装 CC Switch

执行：

```bash
sudo apt install ./CC-Switch-v3.14.1-Linux-x86_64.deb
```

如果系统提示需要安装很多依赖，输入：

```text
Y
```

等待安装完成。

看到类似下面内容，说明安装成功：

```text
Setting up cc-switch (3.14.1) ...
```

检查安装位置：

```bash
which cc-switch
dpkg -L cc-switch | grep -i bin
dpkg -L cc-switch | grep -i desktop
```

---

## 4. 启动 CC Switch 图形界面

执行：

```bash
cc-switch
```

如果命令找不到，可以尝试：

```bash
CC-Switch
```

或者：

```bash
gtk-launch cc-switch
```

如果可以弹出 CC Switch 窗口，说明 WSL 图形界面正常。

如果提示：

```text
cannot open display
```

或者没有弹出窗口，检查 WSL 图形变量：

```bash
echo $DISPLAY
echo $WAYLAND_DISPLAY
```

如果为空，说明当前 WSL 图形环境不可用。Windows 11 一般自带 WSLg，Windows 10 可能需要额外配置 X Server，或者改用手动配置环境变量的方式。

---

## 5. 解决 CC Switch 中文显示方框问题

如果界面里中文显示成方框，说明 WSL 缺中文字体。

安装字体：

```bash
sudo apt update
sudo apt install -y fonts-wqy-zenhei fonts-wqy-microhei
fc-cache -fv
```

关闭 CC Switch 后重新打开：

```bash
pkill cc-switch
cc-switch
```

---

## 6. CC Switch 界面说明

打开后，顶部选择 **Claude Code** 对应的图标。

默认会看到类似：

```text
Claude Official
default
```

含义：

```text
Claude Official：官方 Claude Code 登录方式
default：默认配置
```

如果要接国产模型，不建议直接改 `Claude Official`，建议新增一个 Provider。

---

## 7. 添加 DeepSeek 国产模型 Provider

点击右上角橙色 **+** 按钮。

如果里面有 DeepSeek 预设，可以直接选择 DeepSeek。

如果没有预设，选择：

```text
Custom / 自定义
```

按下面方式填写。

### DeepSeek Provider 示例

```text
Provider 名称：
DeepSeek V4 Pro

API Format / 接口格式：
Anthropic / Anthropic Messages / Claude Compatible

Base URL / API 地址：
https://api.deepseek.com/anthropic

Auth Type / 认证方式：
Bearer Token / ANTHROPIC_AUTH_TOKEN

API Key / Token：
填写你的 DeepSeek API Key

Default Model / 默认模型：
deepseek-v4-pro[1m]

Opus Model：
deepseek-v4-pro[1m]

Sonnet Model：
deepseek-v4-pro[1m]

Haiku Model：
deepseek-v4-flash

Subagent Model：
deepseek-v4-flash

Effort Level：
max
```

注意：API Key 不要截图发给别人，也不要写进公开仓库。

---

## 8. 启用 DeepSeek Provider

保存后，主界面会多出一行，例如：

```text
DeepSeek V4 Pro
```

点击这一行右侧的：

```text
启用 / Enable / 播放按钮 / 勾选按钮
```

启用后建议关闭当前 Claude Code 会话，重新打开一个新的 WSL 终端。

进入项目目录：

```bash
cd /mnt/d/你的项目目录
```

启动 Claude Code：

```bash
claude
```

进入 Claude Code 后输入：

```text
/status
```

再问一句：

```text
你当前使用的模型名是什么？只输出模型名。
```

如果返回类似：

```text
deepseek-v4-pro[1m]
```

说明已经切换到 DeepSeek。

---

## 9. 切回官方 Claude

如果要切回官方 Claude，不需要删除 DeepSeek 配置。

在 CC Switch 图形界面中：

```text
1. 顶部选择 Claude Code 图标
2. 找到 Claude Official 这一行
3. 点击右侧启用按钮
4. 等它显示已启用
5. 关闭当前 Claude Code 会话
6. 重新打开一个新的 WSL 终端
7. 执行 claude
```

进入 Claude Code 后验证：

```text
/status
```

如果显示官方 Claude 登录状态，而不是 DeepSeek 的自定义 Base URL，就说明已经切回官方 Claude。

---

## 10. 检查是否被环境变量覆盖

如果你之前手动配置过环境变量，可能即使 CC Switch 切回官方 Claude，终端里还是走 DeepSeek。

检查：

```bash
env | grep -E "ANTHROPIC|CLAUDE_CODE"
```

如果看到：

```bash
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=...
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
```

说明当前终端仍然被 DeepSeek 环境变量覆盖。

临时清掉当前终端变量：

```bash
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_MODEL
unset ANTHROPIC_DEFAULT_OPUS_MODEL
unset ANTHROPIC_DEFAULT_SONNET_MODEL
unset ANTHROPIC_DEFAULT_HAIKU_MODEL
unset CLAUDE_CODE_SUBAGENT_MODEL
unset CLAUDE_CODE_EFFORT_LEVEL
```

然后重新执行：

```bash
claude
```

如果你把这些变量写进过 `~/.bashrc`，需要编辑删除或注释掉：

```bash
nano ~/.bashrc
```

把相关行删掉或改成：

```bash
# export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
# export ANTHROPIC_AUTH_TOKEN="..."
# export ANTHROPIC_MODEL="..."
# export ANTHROPIC_DEFAULT_OPUS_MODEL="..."
# export ANTHROPIC_DEFAULT_SONNET_MODEL="..."
# export ANTHROPIC_DEFAULT_HAIKU_MODEL="..."
# export CLAUDE_CODE_SUBAGENT_MODEL="..."
# export CLAUDE_CODE_EFFORT_LEVEL="..."
```

刷新配置：

```bash
source ~/.bashrc
```

再次检查：

```bash
env | grep -E "ANTHROPIC|CLAUDE_CODE"
```

如果没有 DeepSeek 相关输出，就不会再覆盖官方 Claude。

---

## 11. 手动配置 DeepSeek 的备用方案

如果 CC Switch 不生效，也可以直接用 WSL 环境变量配置 DeepSeek。

编辑：

```bash
nano ~/.bashrc
```

追加：

```bash
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="你的DeepSeek API Key"
export ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"
```

保存后执行：

```bash
source ~/.bashrc
claude
```

这种方式简单直接，但缺点是切回官方 Claude 时需要手动删除或注释这些环境变量。

---

## 12. 使用 DeepSeek API 后 Skill 失效的问题

切到 DeepSeek 后，Claude Code 外壳还在，但后端模型已经不是 Claude 官方模型。

因此可能出现：

```text
Skill 不工作
MCP 调用异常
子代理效果变差
/debug、/simplify、/batch 等能力不稳定
自动工具编排能力变差
```

这是正常现象，不一定是配置错误。

原因是 Claude Code 的 Skill、工具调用、子代理编排高度依赖 Claude 模型本身的工具调用格式和执行策略。国产模型通过 Anthropic 兼容接口接入后，只能模拟部分协议，不一定完整支持 Claude Code 的全部生态能力。

推荐使用方式：

```text
Claude Official：
适合复杂项目重构、Skill、MCP、自动读写文件、复杂 agent 工作流。

DeepSeek API：
适合低成本代码问答、函数解释、普通代码修改建议、简单脚本生成。
```

需要完整 Skill 能力时，建议切回：

```text
Claude Official
```

---

## 13. 常见问题排查

### 13.1 下载的 `.deb` 只有几字节

原因：下载链接或文件名错误。

错误文件名：

```text
CC-Switch-v3.14.1-Linux.deb
```

正确文件名：

```text
CC-Switch-v3.14.1-Linux-x86_64.deb
```

重新下载：

```bash
rm -f CC-Switch-v3.14.1-Linux.deb
rm -f CC-Switch-v3.14.1-Linux-x86_64.deb

curl -L -o CC-Switch-v3.14.1-Linux-x86_64.deb \
https://github.com/farion1231/cc-switch/releases/download/v3.14.1/CC-Switch-v3.14.1-Linux-x86_64.deb
```

### 13.2 安装时报 Invalid archive signature

原因：下载到的不是 Debian 安装包，可能是错误页面或 404 内容。

检查：

```bash
ls -lh CC-Switch-v3.14.1-Linux-x86_64.deb
file CC-Switch-v3.14.1-Linux-x86_64.deb
```

正常应显示：

```text
Debian binary package
```

### 13.3 CC Switch 配了但 Claude Code 没变化

检查 Claude Code 是否在 WSL 中运行：

```bash
which claude
echo $HOME
```

检查配置和环境变量：

```bash
cat ~/.claude/settings.json
env | grep -E "ANTHROPIC|CLAUDE_CODE"
```

如果 Windows 版 CC Switch 修改的是：

```text
C:\Users\11787\.claude\
```

而你的 Claude Code 实际读取的是：

```bash
~/.claude/
```

那么 WSL 里的 `claude` 不会生效。

### 13.4 切回官方 Claude 后仍然走 DeepSeek

检查环境变量：

```bash
env | grep -E "ANTHROPIC|CLAUDE_CODE"
```

如果还有 DeepSeek，说明被环境变量覆盖。清掉或修改 `~/.bashrc`。

### 13.5 不想用 CC Switch，直接手动切换

可以做两个脚本：

#### use-deepseek.sh

```bash
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="你的DeepSeek API Key"
export ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"
claude
```

#### use-claude-official.sh

```bash
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_MODEL
unset ANTHROPIC_DEFAULT_OPUS_MODEL
unset ANTHROPIC_DEFAULT_SONNET_MODEL
unset ANTHROPIC_DEFAULT_HAIKU_MODEL
unset CLAUDE_CODE_SUBAGENT_MODEL
unset CLAUDE_CODE_EFFORT_LEVEL
claude
```

赋予执行权限：

```bash
chmod +x use-deepseek.sh use-claude-official.sh
```

使用：

```bash
./use-deepseek.sh
```

或者：

```bash
./use-claude-official.sh
```

---

## 14. 推荐工作流

嵌入式 C 开发建议保留两个配置：

```text
1. Claude Official
   用于复杂代码重构、Skill、MCP、自动读写文件、复杂 agent 任务。

2. DeepSeek V4 Pro
   用于低成本代码问答、函数解释、普通重构建议、脚本生成。
```

日常建议：

```text
普通问答、简单函数分析：
使用 DeepSeek API。

复杂项目重构、批量改文件、Skill、MCP：
切回 Claude Official。
```

---

## 15. 最简命令总结

安装：

```bash
cd /mnt/c/Users/11787/Downloads

curl -L -o CC-Switch-v3.14.1-Linux-x86_64.deb \
https://github.com/farion1231/cc-switch/releases/download/v3.14.1/CC-Switch-v3.14.1-Linux-x86_64.deb

sudo apt install ./CC-Switch-v3.14.1-Linux-x86_64.deb
```

启动：

```bash
cc-switch
```

验证 Claude Code：

```bash
claude
/status
```

检查环境变量：

```bash
env | grep -E "ANTHROPIC|CLAUDE_CODE"
```

切回官方时清理变量：

```bash
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_MODEL
unset ANTHROPIC_DEFAULT_OPUS_MODEL
unset ANTHROPIC_DEFAULT_SONNET_MODEL
unset ANTHROPIC_DEFAULT_HAIKU_MODEL
unset CLAUDE_CODE_SUBAGENT_MODEL
unset CLAUDE_CODE_EFFORT_LEVEL
```

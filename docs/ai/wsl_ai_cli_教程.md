---
title: WSL 安装 AI CLI 工具完整教程
description: Windows WSL2 + Ubuntu 环境下安装 Claude Code、Codex CLI、Antigravity CLI（原 Gemini CLI）完整教程
date: 2026-11-24
tags: [WSL, CLI, AI]
order: 4
---

# WSL + Ubuntu 安装 AI CLI 工具完整教程

> 适用环境：Windows 10 (2004+) / Windows 11 + WSL 2 + Ubuntu 24.04 LTS  
> 涵盖工具：Claude Code · OpenAI Codex CLI · Antigravity CLI（原 Gemini CLI）· GitHub Copilot CLI  
> 更新日期：2026-11-24

---

## 目录

1. [前置要求](#1-前置要求)
2. [启用 WSL 2](#2-启用-wsl-2)
3. [安装 Ubuntu](#3-安装-ubuntu)
4. [初始化 Ubuntu 环境](#4-初始化-ubuntu-环境)
5. [安装 Node.js（Codex / Copilot CLI 依赖）](#5-安装-nodejscodex--copilot-cli-依赖)
6. [Claude Code（Anthropic）](#6-claude-codeanthropic)
7. [Codex CLI（OpenAI）](#7-codex-cliopenai)
8. [Antigravity CLI（Google，接替 Gemini CLI）](#8-antigravity-cligoogle接替-gemini-cli)
9. [GitHub Copilot CLI](#9-github-copilot-cli)
10. [多工具并存配置](#10-多工具并存配置)
11. [Windows Terminal 配置](#11-windows-terminal-配置)
12. [常见问题排查](#12-常见问题排查)

---

## 1. 前置要求

- Windows 10 版本 2004（Build 19041）或更高，推荐 Windows 11
- BIOS 已启用虚拟化（Intel VT-x / AMD-V）
- 以**管理员身份**运行 PowerShell

检查 Windows 版本：

```powershell
winver
```

检查虚拟化是否开启：

```powershell
systeminfo | findstr "虚拟化"
```

---

## 2. 启用 WSL 2

以**管理员身份**打开 PowerShell，执行：

```powershell
wsl --install
```

该命令会自动启用 WSL 功能、安装 WSL 2 内核，并默认安装 Ubuntu。

安装完成后**重启电脑**，再验证：

```powershell
wsl --status
wsl --list --verbose
```

若已安装旧版 WSL，手动升级为 WSL 2：

```powershell
wsl --set-default-version 2
wsl --set-version Ubuntu 2
```

---

## 3. 安装 Ubuntu

```powershell
# 查看可用发行版
wsl --list --online

# 安装 Ubuntu 24.04 LTS
wsl --install -d Ubuntu-24.04
```

从开始菜单打开 Ubuntu，按提示创建用户：

```
Enter new UNIX username: your_username
New password: ****
Retype new password: ****
```

> 密码输入时不显示字符，属于正常的 Unix 行为。

---

## 4. 初始化 Ubuntu 环境

### 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 安装基础依赖

```bash
sudo apt install -y curl wget git build-essential ca-certificates \
  gnupg lsb-release unzip
```

### 配置 WSL 选项

```bash
sudo tee /etc/wsl.conf > /dev/null << 'EOF'
[boot]
systemd=true

[automount]
enabled=true
options="metadata,umask=22,fmask=11"

[network]
generateResolvConf=true
EOF
```

在 Windows 侧创建 `%USERPROFILE%\.wslconfig`：

```powershell
notepad $env:USERPROFILE\.wslconfig
```

```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

修改后重启 WSL：

```powershell
wsl --shutdown
```

---

## 5. 安装 Node.js（Codex / Copilot CLI 依赖）

Codex CLI 与新版 GitHub Copilot CLI（`@github/copilot`）基于 Node.js，建议用 **nvm** 管理版本。（**Claude Code** 与 **Antigravity CLI** 现均提供官方独立原生二进制安装器，不依赖 Node.js，可跳过本步骤直接安装。）

```bash
# 安装 nvm（最新稳定版 v0.41.0）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash

# 重载 Shell
source ~/.bashrc

# 安装最新 LTS 版本（Node 22/24 LTS，注意 Node 20 已于 2026-04 EOL）
nvm install --lts
nvm use --lts
nvm alias default node

# 验证
node --version
npm --version
```

---

## 6. Claude Code（Anthropic）

Claude Code 是 Anthropic 官方 CLI，支持代码编写、调试、文件操作及多步骤任务执行，可直接读写项目文件并执行终端命令。

### 安装（官方原生安装器）

> ⚠️ **重要变更**：Anthropic 已官方弃用 `npm install -g @anthropic-ai/claude-code` 全局安装方式，请统一使用下方独立原生二进制安装器（无需 Node.js，启动更快且支持自动更新）。如之前用 npm 装过，可先执行 `npm uninstall -g @anthropic-ai/claude-code`。

```bash
curl -fsSL https://claude.ai/install.sh | bash
source ~/.bashrc
claude --version
claude doctor
```

### 配置认证 / API Key

支持直接运行 `claude` 通过 Claude Pro / Max / Ultra 账号 OAuth 登录，或前往 [platform.claude.com](https://platform.claude.com/) 获取 API Key：

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

### 常用命令

```bash
# 启动交互式对话
claude

# 单次提问后退出
claude "用 Python 写一个读取 CSV 文件的函数"

# 将文件内容作为上下文传入
claude "解释这段代码的逻辑" < main.py

# 在当前项目目录启动（自动加载项目结构）
cd my-project && claude

# 继续上一次会话
claude --continue

# 恢复指定会话（通过会话 ID）
claude --resume <session-id>

# 以非交互模式输出结果（适合脚本调用）
claude --print "生成一份 .gitignore 模板"

# 指定模型
claude --model opus "帮我做代码审查"

# 允许所有文件操作（跳过逐步确认）
claude --dangerously-skip-permissions

# 查看所有可用选项
claude --help
```

### 交互模式内常用指令

在 `claude` 交互会话中，可使用以下斜杠命令：

| 指令 | 功能 |
|------|------|
| `/help` | 查看所有可用指令 |
| `/clear` | 清空当前对话上下文 |
| `/compact` | 压缩上下文，节省 token |
| `/model` | 切换模型 |
| `/cost` | 查看本次会话的 token 消耗 |
| `/review` | 对当前改动进行代码审查 |
| `/quit` | 退出 |

---

## 7. Codex CLI（OpenAI）

Codex CLI 是 OpenAI 推出的终端编程助手，通过审批模式控制 AI 的操作权限，支持全自动执行任务。

### 安装

```bash
npm install -g @openai/codex
codex --version
```

### 配置 API Key

前往 [platform.openai.com](https://platform.openai.com) 获取 API Key：

```bash
echo 'export OPENAI_API_KEY="sk-xxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

### 常用命令

> ⚠️ 旧版 `--approval-mode suggest/auto-edit/full-auto` 已弃用，新版通过 `--sandbox`（`-s`）和 `--ask-for-approval`（`-a`）分别控制沙箱范围与审批策略，配置保存在 `~/.codex/config.toml`。

```bash
# 启动交互式会话（支持 ChatGPT 账号登录或 OPENAI_API_KEY）
codex

# 单次任务描述
codex "列出当前目录下所有大于 1MB 的文件"

# 非交互脚本模式
codex exec "为 utils.py 补充单元测试并运行"

# 指定模型
codex --model gpt-5-codex "分析这段代码的时间复杂度"

# 指定沙箱模式与审批策略
codex -s read-only "审查当前项目的安全风险"
codex -s workspace-write -a on-request "为所有函数添加类型注解"
codex -s workspace-write -a never "运行测试并自动修复所有失败用例"

# 内联覆盖配置项
codex -c approval_policy=never -c sandbox_mode=workspace-write "优化数据库查询语句"

# 跳过全部沙箱与确认（仅限隔离环境，慎用）
codex --yolo

# 查看帮助
codex --help
```

### 沙箱与审批策略说明

| 参数 | 选项 | 行为 | 适用场景 |
|------|------|------|---------|
| `--sandbox` (`-s`) | `read-only` | 只读，不改文件也不执行副作用命令 | 学习、代码评审 |
| | `workspace-write` | 仅允许在当前工作区内读写和执行 | 日常开发 |
| | `danger-full-access` | 无沙箱限制 | 受控隔离环境 |
| `--ask-for-approval` (`-a`) | `on-request` | 越界操作前请求人工确认 | 日常开发 |
| | `never` | 全程不弹窗确认 | CI/自动化脚本 |

---

## 8. Antigravity CLI（Google，接替 Gemini CLI）

::: danger 重要变更（2026-06 已生效）
Google 已于 **2026 年 6 月 18 日**正式停止向个人用户（Google AI Pro / Ultra 及免费版 Gemini Code Assist）提供旧版 **Gemini CLI**（`@google/gemini-cli`），由新一代 **Antigravity CLI**（命令 `agy`）接替。

- **受影响**：用 Google 账号免费登录或个人订阅的用户——旧版 `gemini` 已无法调用，请迁移至 `agy`。
- **不受影响**：企业版授权用户，以及使用**付费 Gemini API Key** 认证的用户，仍可继续使用旧版 Gemini CLI。

Antigravity CLI 是 Google 基于 Antigravity 平台推出的新一代终端 AI 助手。与旧版不同，它是 **Go 编译的独立二进制**，不再依赖 Node.js，启动更快，并支持多 Agent 协作。
:::

### 卸载旧版 Gemini CLI（如已安装）

```bash
npm uninstall -g @google/gemini-cli
```

### 安装 Antigravity CLI

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

安装后二进制位于 `~/.local/bin/`，**命令名为 `agy`**（注意：不是 `antigravity`，这一点很容易踩坑）。

确保 `~/.local/bin` 在 PATH 中，并验证：

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
agy --version
```

### 配置认证

**方式一：Google 账号登录（推荐）**

```bash
agy
# 桌面环境会自动打开浏览器完成 OAuth 登录；
# WSL / SSH 等无浏览器环境会打印一条授权链接，
# 复制到本机浏览器登录后即可完成认证。
```

**方式二：API Key（自动化 / 无浏览器场景）**

前往 [aistudio.google.com](https://aistudio.google.com) 获取 API Key：

```bash
echo 'export ANTIGRAVITY_API_KEY="AIzaxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

> ⚠️ 环境变量名 `ANTIGRAVITY_API_KEY` 目前仅见于第三方资料、尚未在官方文档明确，使用前请以 `agy --help` 或官方文档为准。

### 常用命令

```bash
# 启动交互式会话
agy

# 单次提问
agy "解释 WSL 2 和虚拟机的区别"

# 读取文件内容作为上下文
agy "总结这个项目的架构" < README.md

# 传入多个文件
cat src/*.py | agy "找出这些文件中的潜在 Bug"

# 查看全部命令与参数
agy --help
```

> Antigravity CLI 仍在快速迭代，旧版 `gemini` 的 `--model`、`--json`、`--no-search` 等参数不一定原样保留。具体可用参数请以 `agy --help` 的实际输出为准。

### 配置文件迁移

- 项目级上下文文件 **`GEMINI.md` 仍然有效**，同时新增支持通用的 `AGENTS.md`。
- 全局配置、MCP 配置、Skills 等迁移到 `~/.gemini/antigravity-cli/` 目录下。
- ⚠️ 迁移 MCP 服务器时，配置字段需把 `url` 改名为 `serverUrl`，否则启动时会**静默失败**（不报错但连不上）。

> 上述配置路径与字段为社区整理，置信度有限，请以 [Antigravity 官方文档](https://antigravity.google) 为准。

---

## 9. GitHub Copilot CLI

::: danger 重要变更（旧版 gh-copilot 扩展已退役）
旧版 `gh extension install github/gh-copilot`（以及 `gh copilot suggest` / `gh copilot explain` 命令）已于 **2025 年 10 月 25 日**正式停止服务。GitHub 现已推出全新的独立 Agent 版 **GitHub Copilot CLI**（命令为 `copilot`），支持项目级规划、编码、调试与命令执行。
:::

### 安装独立版 GitHub Copilot CLI

```bash
# 方式一：通过 npm 全局安装（WSL 推荐）
npm install -g @github/copilot

# 方式二：通过 Homebrew 安装（如 WSL 已装 Homebrew）
brew install github/copilot/copilot

# 验证安装
copilot --version
```

> 如之前装过已废弃的旧扩展，可清理卸载：`gh extension remove gh-copilot`。

### 登录认证

首次在终端运行 `copilot`，按提示使用 GitHub 账号完成浏览器 OAuth 授权登录即可（需账号开通 GitHub Copilot Free / Pro / Pro+ / Business / Enterprise）。

### 常用命令

```bash
# 启动交互式 Agent 会话（在项目目录下运行）
cd my-project && copilot

# 非交互单次任务（-p / --prompt）
copilot -p "修复当前目录下失败的单元测试"
copilot -p "列出当前目录下所有大于 1MB 的文件并按大小排序"
copilot -p "解释 find . -name '*.py' -exec sed -i 's/foo/bar/g' {} + 这条命令的含义"
copilot -p "根据当前 git diff 生成一条规范的 commit message"

# 查看全部参数与子命令
copilot --help
```

> 新版 Copilot CLI 不再局限于单条 Shell 命令翻译，而是与 Claude Code / Codex 同级的终端编程 Agent，并且可以在会话中按需切换支持的模型（Claude / GPT / Gemini 等）。

---

## 10. 多工具并存配置

四个工具可同时安装，互不干扰。

### 环境变量统一管理

在 `~/.bashrc` 末尾添加（`~/.zshrc` 同理）：

```bash
# ── AI CLI API Keys ───────────────────────────
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
export OPENAI_API_KEY="sk-xxxxxxxx"
export ANTIGRAVITY_API_KEY="AIzaxxxxxxxx"   # Antigravity CLI（原 Gemini CLI）
# GitHub Copilot CLI 通过首次运行 copilot 登录授权，无需手动配 Key
```

### 工具选择参考

| 使用场景 | 推荐工具 |
|---------|---------|
| 复杂多步骤编程任务、文件级操作 | Claude Code |
| 代码自动重构、沙箱化全自动任务 | Codex CLI |
| 大型代码库分析、超长文档处理 | Antigravity CLI（原 Gemini CLI） |
| GitHub 生态深度联动、多模型终端 Agent | GitHub Copilot CLI |

### 一键验证所有工具

```bash
echo "=== AI CLI 环境检查 ===" && \
printf "Claude Code : " && claude --version 2>/dev/null || echo "未安装" && \
printf "Codex CLI   : " && codex --version 2>/dev/null || echo "未安装" && \
printf "Antigravity : " && agy --version 2>/dev/null || echo "未安装" && \
printf "Copilot CLI : " && copilot --version 2>/dev/null || echo "未安装"
```

---

## 11. Windows Terminal 配置

### 安装 Windows Terminal

```powershell
winget install Microsoft.WindowsTerminal
```

### 推荐配置（settings.json）

打开 Windows Terminal → 设置 → 右下角「打开 JSON 文件」：

```json
{
  "profiles": {
    "defaults": {
      "font": {
        "face": "Cascadia Code",
        "size": 12
      },
      "colorScheme": "One Half Dark",
      "opacity": 95,
      "useAcrylic": true,
      "cursorShape": "bar"
    },
    "list": [
      {
        "name": "Ubuntu 24.04",
        "source": "Windows.Terminal.Wsl",
        "startingDirectory": "//wsl$/Ubuntu-24.04/home/your_username"
      }
    ]
  }
}
```

### 常用快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+T` | 新建标签页 |
| `Ctrl+W` | 关闭标签页 |
| `Ctrl+Shift+5` | 水平分割面板 |
| `Ctrl+Shift+D` | 垂直分割面板 |
| `Alt+方向键` | 切换面板 |

---

## 12. 常见问题排查

### WSL 网络连接失败

```bash
sudo tee /etc/resolv.conf > /dev/null << 'EOF'
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
sudo chattr +i /etc/resolv.conf
```

### npm 全局安装需要 sudo

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### apt / npm 安装速度慢

```bash
# apt 换阿里云镜像
sudo tee /etc/apt/sources.list > /dev/null << 'EOF'
deb https://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse
EOF
sudo apt update

# npm 换淘宝镜像
npm config set registry https://registry.npmmirror.com
```

### API Key 未生效

```bash
# 确认环境变量已加载
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $ANTIGRAVITY_API_KEY

# 若为空，手动重载
source ~/.bashrc
```

### WSL 内存占用过高

```powershell
wsl --shutdown
```

---

*如遇其他问题，可查阅各工具官方文档或 GitHub Issues。*

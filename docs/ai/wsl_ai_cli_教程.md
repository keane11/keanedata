# WSL + Ubuntu 安装 AI CLI 工具完整教程

> 适用环境：Windows 10 (2004+) / Windows 11 + WSL 2 + Ubuntu 24.04 LTS  
> 涵盖工具：Claude Code · OpenAI Codex CLI · Gemini CLI · GitHub Copilot CLI  
> 更新日期：2026-04-21

---

## 目录

1. [前置要求](#1-前置要求)
2. [启用 WSL 2](#2-启用-wsl-2)
3. [安装 Ubuntu](#3-安装-ubuntu)
4. [初始化 Ubuntu 环境](#4-初始化-ubuntu-环境)
5. [安装 Node.js（所有 CLI 的依赖）](#5-安装-nodejs所有-cli-的依赖)
6. [Claude Code（Anthropic）](#6-claude-codeanthropic)
7. [Codex CLI（OpenAI）](#7-codex-cliopenai)
8. [Gemini CLI（Google）](#8-gemini-cligoogle)
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

## 5. 安装 Node.js（所有 CLI 的依赖）

Claude Code、Codex CLI 和 Gemini CLI 均基于 Node.js，建议用 **nvm** 管理版本。

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 重载 Shell
source ~/.bashrc

# 安装最新 LTS 版本
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

### 安装

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### 配置 API Key

前往 [console.anthropic.com](https://console.anthropic.com) 获取 API Key：

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
claude --model claude-opus-4-7 "帮我做代码审查"

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

```bash
# 启动交互式会话
codex

# 单次任务描述
codex "列出当前目录下所有大于 1MB 的文件"

# 将文件内容作为输入
codex "重构这个函数，减少嵌套层级" < utils.py

# 指定模型（默认 o4-mini）
codex --model o3 "分析这段代码的时间复杂度"

# 指定审批模式
codex --approval-mode suggest "优化数据库查询语句"
codex --approval-mode auto-edit "为所有函数添加类型注解"
codex --approval-mode full-auto "运行测试并自动修复所有失败用例"

# 指定工作目录
codex --cwd /path/to/project "检查项目依赖是否有安全漏洞"

# 静默模式（减少交互提示）
codex --quiet "生成 README.md"

# 查看帮助
codex --help
```

### 审批模式说明

| 模式 | 行为 | 适用场景 |
|------|------|---------|
| `suggest`（默认） | 只给出建议，不自动执行 | 学习、探索 |
| `auto-edit` | 自动修改文件，执行命令前需确认 | 日常开发 |
| `full-auto` | 全自动执行，无需确认 | CI/脚本环境 |

---

## 8. Gemini CLI（Google）

Gemini CLI 是 Google 推出的终端 AI 助手，支持超长上下文（100 万 token），适合大型代码库分析，Google 账号登录有较高免费额度。

### 安装

```bash
npm install -g @google/gemini-cli
gemini --version
```

### 配置认证

**方式一：Google 账号登录（推荐，有免费额度）**

```bash
gemini
# 首次运行会自动打开浏览器完成 Google OAuth 登录
```

**方式二：API Key**

前往 [aistudio.google.com](https://aistudio.google.com) 获取 API Key：

```bash
echo 'export GEMINI_API_KEY="AIzaxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

### 常用命令

```bash
# 启动交互式会话
gemini

# 单次提问
gemini "解释 WSL 2 和虚拟机的区别"

# 读取文件内容作为上下文
gemini "总结这个项目的架构" < README.md

# 传入多个文件
cat src/*.py | gemini "找出这些文件中的潜在 Bug"

# 指定模型
gemini --model gemini-2.5-pro "对这份代码做全面的性能分析"
gemini --model gemini-2.5-flash "快速生成单元测试"

# 关闭联网搜索（仅用本地上下文）
gemini --no-search "解释这段正则表达式"

# 输出为 JSON 格式（适合脚本处理）
gemini --json "列出这段代码的所有函数名及其功能"

# 调整输出长度
gemini --max-output-tokens 2048 "详细解释这个算法"

# 查看帮助
gemini --help
```

### 交互模式内常用指令

| 指令 | 功能 |
|------|------|
| `/help` | 查看所有指令 |
| `/clear` | 清空对话 |
| `/model` | 切换模型 |
| `/tools` | 查看已启用的工具 |
| `/memory` | 管理长期记忆 |
| `/quit` | 退出 |

### 主要特点

| 特性 | 说明 |
|------|------|
| 超长上下文 | 最多 100 万 token，可加载整个代码库 |
| 免费额度 | Google 账号登录每分钟 60 次请求 |
| 多模态 | 支持图片、PDF、代码混合输入 |
| Google 搜索 | 可联网实时检索信息 |

---

## 9. GitHub Copilot CLI

GitHub Copilot CLI 以 `gh` 扩展形式提供，专注于 Shell 命令生成与解释，深度集成 GitHub 工作流。

### 安装 gh CLI

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh
```

### 登录 GitHub 账号

```bash
gh auth login
# 选择：GitHub.com → HTTPS → 浏览器认证
```

### 安装 Copilot 扩展

```bash
gh extension install github/gh-copilot
gh copilot --version
```

### 常用命令

GitHub Copilot CLI 提供两个核心子命令：`suggest` 和 `explain`。

#### `gh copilot suggest`：自然语言生成命令

```bash
# 生成 Shell 命令
gh copilot suggest "递归查找并删除所有 .log 文件"
gh copilot suggest "找出占用 8080 端口的进程并杀掉"
gh copilot suggest "统计当前目录下每种文件类型的数量"
gh copilot suggest "将目录下所有 .jpg 文件批量转换为 .png"
gh copilot suggest "监控某个文件的实时变化"

# 生成 Git 命令
gh copilot suggest -t git "撤销最近三次提交但保留文件改动"
gh copilot suggest -t git "把当前分支的某个提交摘到另一个分支"
gh copilot suggest -t git "查看两个分支之间的文件差异"
gh copilot suggest -t git "清理所有已合并的本地分支"
gh copilot suggest -t git "修改最近一次提交的信息"

# 生成 gh 命令
gh copilot suggest -t gh "列出我所有未合并的 PR"
gh copilot suggest -t gh "把某个 Issue 分配给指定用户"
gh copilot suggest -t gh "下载某次 Actions 运行的产物"
gh copilot suggest -t gh "创建一个草稿 PR"
```

#### `gh copilot explain`：解释命令含义

```bash
# 解释复杂的 Shell 命令
gh copilot explain "find . -name '*.py' -exec sed -i 's/foo/bar/g' {} +"
gh copilot explain "awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10"
gh copilot explain "tar -czvf archive.tar.gz --exclude='node_modules' ."
gh copilot explain "lsof -i :3000"
gh copilot explain "ps aux | grep '[n]ode'"

# 解释 Git 命令
gh copilot explain "git rebase -i HEAD~3"
gh copilot explain "git reflog"
gh copilot explain "git stash pop"
gh copilot explain "git bisect start"

# 解释权限和系统命令
gh copilot explain "chmod 755"
gh copilot explain "chown -R www-data:www-data /var/www"
gh copilot explain "sudo systemctl enable --now nginx"
```

### 设置快捷别名（推荐）

```bash
echo 'alias ghcs="gh copilot suggest"' >> ~/.bashrc
echo 'alias ghce="gh copilot explain"' >> ~/.bashrc
source ~/.bashrc

# 使用示例
ghcs "压缩当前目录，排除 .git 和 node_modules"
ghce "grep -rn --include='*.js' 'TODO' ."
```

---

## 10. 多工具并存配置

四个工具可同时安装，互不干扰。

### 环境变量统一管理

在 `~/.bashrc` 末尾添加（`~/.zshrc` 同理）：

```bash
# ── AI CLI API Keys ───────────────────────────
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
export OPENAI_API_KEY="sk-xxxxxxxx"
export GEMINI_API_KEY="AIzaxxxxxxxx"
# GitHub Copilot 通过 gh auth login 管理，无需手动配置
```

### 工具选择参考

| 使用场景 | 推荐工具 |
|---------|---------|
| 复杂多步骤编程任务、文件级操作 | Claude Code |
| 代码自动重构、全自动任务执行 | Codex CLI |
| 大型代码库分析、超长文档处理 | Gemini CLI |
| Shell 命令生成与解释、Git 操作 | GitHub Copilot CLI |

### 一键验证所有工具

```bash
echo "=== AI CLI 环境检查 ===" && \
printf "Claude Code : " && claude --version 2>/dev/null || echo "未安装" && \
printf "Codex CLI   : " && codex --version 2>/dev/null || echo "未安装" && \
printf "Gemini CLI  : " && gemini --version 2>/dev/null || echo "未安装" && \
printf "gh Copilot  : " && gh copilot --version 2>/dev/null || echo "未安装"
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
echo $GEMINI_API_KEY

# 若为空，手动重载
source ~/.bashrc
```

### WSL 内存占用过高

```powershell
wsl --shutdown
```

---

*如遇其他问题，可查阅各工具官方文档或 GitHub Issues。*

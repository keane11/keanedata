---
title: Hermes Agent 完整配置指南
date: 2026-05-13
order: 5
---

# Hermes Agent 完整配置指南

> 覆盖内容：安装部署 → DeepSeek 配置 → 微信 Gateway → 文档处理增强 → Gemini API 备选 → 常见问题排查。  
> 适用环境：Windows + WSL2 Ubuntu / 独立 Ubuntu / 云服务器。

---

## 1. 整体架构

```
你 / 微信 / CLI
   ↓
Hermes Agent（运行在 Ubuntu / WSL2）
   ↓
DeepSeek API（主模型）  ←→  Gemini API（备选，图片优先）
   ↓
本机执行：读文件 · 查工程 · 跑命令 · 生成报告 · 定时任务
```

- **DeepSeek** = 大脑（推理）
- **Hermes Agent** = 外壳 + 工具执行器 + 记忆 + Gateway
- **Ubuntu** = 执行环境 / 工作区

Hermes 不是模型本身，它负责连接模型、管理上下文、调用工具、运行 Gateway、执行自动化任务。

---

## 2. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl nano tmux python3
```

---

## 3. 安装 Hermes Agent

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version
```

如果命令不存在，重新打开终端或执行 `source ~/.bashrc`。

---

## 4. 推荐目录规划

```bash
mkdir -p ~/ai/hermes
mkdir -p ~/ai/reports
mkdir -p ~/projects
cd ~/ai/hermes
```

> 如果工程在 Windows 盘，用 `/mnt/d/...` 路径访问即可，但频繁读写大量文件时建议移到 Linux 文件系统。

---

## 5. DeepSeek 配置

### 5.1 通过向导配置（推荐）

```bash
hermes setup   # 完整初始化
# 或只改模型：
hermes model
```

配置参数：

| 选项 | 值 |
|------|----|
| Provider | DeepSeek (direct API) |
| API Key | 你的 DeepSeek API Key |
| Base URL | `https://api.deepseek.com` |
| 主力模型 | `deepseek-v4-pro` |
| 轻量模型 | `deepseek-v4-flash`（低成本日常任务） |

### 5.2 手动编辑 `.env`

```bash
mkdir -p ~/.hermes
nano ~/.hermes/.env
```

```bash
# DeepSeek 主模型（Key 不要带引号和空格）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 微信私聊策略（只允许白名单）
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=你的微信ID@im.wechat

# 群聊关闭（iLink Bot 一般收不到群消息）
WEIXIN_GROUP_POLICY=closed

# Gateway 默认工作目录
MESSAGING_CWD=/home/你的用户名
```

> **常见错误**：`DEEPSEEK_API_KEY=Bearer sk-xxxx` 或 `DEEPSEEK_API_KEY="sk-xxxx"` 都是错的，不要带前缀和引号。

### 5.3 验证 API Key

```bash
set -a && source ~/.hermes/.env && set +a

curl -sS https://api.deepseek.com/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-pro","messages":[{"role":"user","content":"ping"}],"max_tokens":16}'
```

返回 401 说明 Key 无效或格式错误。

---

## 6. Gemini API 备选配置

Gemini 作为 DeepSeek 的 fallback，图片 / OCR / 视觉任务优先走 Gemini。

### 6.1 配置前备份

```bash
backup_dir=~/.hermes_backups/backup_$(date +%Y%m%d_%H%M%S)
mkdir -p ~/.hermes_backups
cp -a ~/.hermes "$backup_dir"
echo "备份保存到：$backup_dir"
```

### 6.2 在 `.env` 中添加 Gemini Key

```bash
nano ~/.hermes/.env
```

追加以下内容（**不要覆盖** DeepSeek 配置）：

```bash
# Gemini API（备选 / 图片视觉任务）
GEMINI_API_KEY=AIzaSy-xxxxxxxxxxxxxxxxxxxx

# Gemini 兼容 OpenAI 端点（部分 Hermes 版本使用）
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-2.0-flash
```

### 6.3 配置 Fallback

```bash
hermes model           # 确认 DeepSeek 为主模型
hermes fallback list   # 查看备选模型列表（如命令可用）
```

如果 Hermes 支持多 provider，在 `config.yaml` 中追加：

```yaml
fallback_provider: gemini
vision_provider: gemini   # 图片任务默认走 Gemini
```

---

## 7. 文档处理配置

配置 Hermes 输出真实文件（`.xlsx` / `.docx` / `.pdf`），而非纯文本：

### 7.1 安装依赖

```bash
pip3 install openpyxl python-docx reportlab Pillow
```

### 7.2 告知 Hermes 输出规范

每次处理文档前加说明，或写入 Memory：

```text
处理 Excel/Word/PDF/PPT 时：
1. 输出真实文件格式（.xlsx/.docx/.pdf），不要只输出文本摘要
2. 尽量保留原文件的样式、表格、图片、标题层级
3. 修改已有文件前必须先备份，备份路径加时间戳
4. 备份命名：原文件名_backup_YYYYMMDD.扩展名
```

---

## 8. 微信 Gateway

### 8.1 配置 Gateway

```bash
hermes gateway setup
```

选择 Weixin/WeChat，扫码登录。DM 权限建议选：

```
Use DM pairing approval（推荐）
```

或手动白名单：

```
Only allow listed user IDs
```

### 8.2 启动 Gateway

```bash
hermes gateway run
```

后台运行（推荐）：

```bash
tmux new -s hermes-gateway 'hermes gateway run'
# 退出 tmux 但保持运行：Ctrl+B → D
# 重新进入：
tmux attach -t hermes-gateway
```

### 8.3 添加白名单用户

日志出现 `Unauthorized user: xxxxx@im.wechat` 时：

```bash
nano ~/.hermes/.env
# 修改或追加：
WEIXIN_ALLOWED_USERS=xxxxx@im.wechat
# 多用户用逗号分隔：user1@im.wechat,user2@im.wechat
```

保存后重启 Gateway。

---

## 9. 常用命令速查

```bash
hermes                 # 启动交互式聊天
hermes setup           # 完整初始化
hermes model           # 重新配置模型
hermes gateway setup   # 配置消息平台
hermes gateway run     # 启动 Gateway
hermes cron list       # 查看定时任务
hermes tools           # 查看可用工具
hermes --version       # 查看版本
```

---

## 10. 推荐 Prompt 模板

### 工程扫描

```
你是我的嵌入式 C 工程助手。
请扫描当前工程，找出 UART、OTA、FIFO、timer、20ms 处理相关代码。
先不要修改文件，只输出相关文件、函数调用链、风险点和重构建议。
重点检查：ISR 耗时、buffer 越界、FIFO 读写竞争、volatile 使用。
```

### 代码重构方案

```
基于刚才分析，请给出重构方案：
1. ISR 中只做入队和状态判断
2. OTA 模式：满 1KB 写入 FIFO
3. 普通模式：每 20ms 处理一次
4. 不引入动态内存和复杂第三方库
先给方案，不要修改文件。
```

### 项目日报

```
根据当前工程状态生成项目日报，包含：
今日修改、影响模块、风险点、测试建议、明日计划。
不要修改任何文件。
```

### 发版 Checklist

```
生成本次固件发版 checklist，覆盖：
version 信息、bin 文件、OTA header、CRC32、蓝牙连接、
UART 协议、音频功能、回归测试、量产风险。
```

---

## 11. 日报脚本

```bash
nano ~/daily_report.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail
PROJECT="/mnt/d/your/project"
OUT="$HOME/ai/reports/daily_$(date +%F).md"
mkdir -p "$(dirname "$OUT")"
cd "$PROJECT"
hermes -z "
根据当前工程生成今日项目日报（中文 Markdown）：
1. git status --short 结果
2. git log --oneline -5
3. 影响模块分析
4. 风险点与测试建议
5. 明日计划
不要修改文件。
" > "$OUT"
echo "日报：$OUT"
```

```bash
chmod +x ~/daily_report.sh && ~/daily_report.sh
```

---

## 12. 常见问题排查

### DeepSeek 401 Authentication Fails

```bash
nano ~/.hermes/.env
# 检查 Key 格式：DEEPSEEK_API_KEY=sk-xxxx（无引号、无 Bearer、无空格）
```

### 微信 Bot 无回复

| 日志关键字 | 处理方法 |
|-----------|---------|
| `Unauthorized user` | 把 ID 加到 `WEIXIN_ALLOWED_USERS` |
| `API call failed` | 检查 DeepSeek API Key / 余额 / 模型名 |
| 无任何日志 | 检查扫码登录状态或 iLink 状态 |

### Another gateway already using this Weixin token

```bash
ps -ef | grep -Ei "hermes|gateway" | grep -v grep
# 停止多余进程后重新运行
hermes gateway run
```

---

## 13. 安全建议

- 所有任务初期加：**不要修改文件，只分析**
- 在 Git 仓库工作，修改前先 `git status`
- 不要开启 `GATEWAY_ALLOW_ALL_USERS=true`
- 消息平台只允许自己的白名单
- 不要把 API Key 发到聊天窗口或截图里

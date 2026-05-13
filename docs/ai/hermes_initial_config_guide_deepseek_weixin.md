# Hermes Agent 初始化配置模板（Ubuntu/WSL2 + DeepSeek + 微信 Gateway）

> 适用场景：Windows + WSL2 Ubuntu、独立 Ubuntu 主机、云服务器。  
> 目标：本机只运行 Hermes Agent，不在本地跑模型；模型推理走 DeepSeek API；日常可通过 CLI 或微信 Gateway 使用。

---

## 1. 整体架构理解

```text
你 / 微信 / CLI
   ↓
Hermes Agent（运行在 Ubuntu / WSL2 / 云服务器）
   ↓
DeepSeek API（deepseek-v4-pro，负责推理）
   ↓
Hermes 在本机执行：读文件、查工程、跑命令、生成报告、做定时任务
```

简单理解：

```text
DeepSeek = 大脑
Hermes Agent = Agent 外壳 + 工具执行器 + 记忆 + Gateway
Ubuntu = 执行环境 / 项目工作区
```

Hermes 不是模型本身，它负责连接模型、管理上下文、调用工具、运行 Gateway、做自动化任务。

---

## 2. 推荐目录规划

不要长期在下面目录运行：

```bash
/mnt/c/WINDOWS/system32
```

建议使用 Ubuntu 用户目录：

```bash
mkdir -p ~/ai/hermes
mkdir -p ~/ai/reports
mkdir -p ~/projects
cd ~/ai/hermes
```

如果你的工程在 Windows D 盘，可以这样进入：

```bash
cd "/mnt/d/blueturm/WIFI toy LCD/sdk_ab5800_ai_toy_trunk_beta_s3111_20260325"
```

但是如果要频繁读写大量文件，建议把项目放到 WSL Linux 文件系统里，性能和权限问题会少一些。

---

## 3. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl nano tmux python3
```

---

## 4. 安装 Hermes Agent

推荐使用官方安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
```

检查是否安装成功：

```bash
hermes --version
hermes --help
```

如果命令不存在，先执行：

```bash
source ~/.bashrc
```

或者重新打开一个 Ubuntu 终端。

---

## 5. DeepSeek 模型配置

### 5.1 推荐通过向导配置

```bash
hermes setup
```

或者只重新配置模型：

```bash
hermes model
```

Provider 选择：

```text
DeepSeek (DeepSeek-V3, R1, coder — direct API)
```

配置参数：

```text
API Key: 你的 DeepSeek API Key
Base URL: https://api.deepseek.com
Model: deepseek-v4-pro
```

日常建议：

```text
deepseek-v4-pro   复杂代码分析、项目管理、方案设计
deepseek-v4-flash 普通问答、低成本日常任务
```

---

## 6. 手动维护 `.env` 配置

Hermes 的环境变量一般放在：

```bash
~/.hermes/.env
```

可以这样编辑：

```bash
mkdir -p ~/.hermes
nano ~/.hermes/.env
```

推荐模板：

```bash
# ==============================
# Hermes Agent 基础环境变量
# ==============================

# DeepSeek API Key：不要带 Bearer，不要加引号，不要有空格
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==============================
# Gateway 安全策略
# ==============================

# 不建议开启全局开放，除非只是短时间测试
# GATEWAY_ALLOW_ALL_USERS=true

# 推荐：微信私聊只允许白名单用户
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=你的微信用户ID@im.wechat

# 群聊策略：普通个人微信 iLink Bot 很可能收不到普通微信群消息
# 如无明确需求，建议关闭或先不依赖群聊
WEIXIN_GROUP_POLICY=closed

# Gateway 消息模式下的默认工作目录
MESSAGING_CWD=/home/keane
```

注意：

```bash
DEEPSEEK_API_KEY=sk-xxxx
```

不要写成：

```bash
DEEPSEEK_API_KEY="sk-xxxx"
DEEPSEEK_API_KEY=Bearer sk-xxxx
DEEPSEEK_API_KEY=sk-xxxx # deepseek api
API Key: sk-xxxx
```

---

## 7. 检查 DeepSeek API Key 是否有效

先加载 `.env`：

```bash
set -a
source ~/.hermes/.env
set +a
```

用 curl 直接测试：

```bash
curl -sS https://api.deepseek.com/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "user", "content": "ping"}
    ],
    "max_tokens": 16
  }'
```

如果返回 `Authentication Fails` 或 HTTP 401，说明 Key 无效、复制错、带了空格，或者不是 DeepSeek 官方平台的 API Key。

---

## 8. 常用 Hermes 命令

```bash
hermes                 # 启动交互式聊天
hermes chat            # 启动聊天
hermes model           # 重新配置模型 / provider
hermes setup           # 完整初始化配置
hermes gateway setup   # 配置微信、Telegram、Slack 等消息平台
hermes gateway run     # 启动消息 Gateway 和 cron scheduler
hermes --help          # 查看帮助
hermes --version       # 查看版本
```

在 Hermes 聊天界面里可以输入：

```text
/help
/model
```

---

## 9. 终端执行后端选择

初始化时如果出现：

```text
选择终端后端：
( ) 本地-直接在此机器上运行（默认）
( ) Docker-配置资源的隔离容器
( ) SSH-在远程机器上运行
...
(●) 保持当前（本地）
```

个人 Ubuntu / WSL2 使用建议选择：

```text
保持当前（本地）
```

这个“本地”只是指命令在当前 Ubuntu 环境执行，不代表本地跑模型。模型仍然走 DeepSeek API。

---

## 10. 微信 Gateway 配置

### 10.1 配置入口

```bash
hermes gateway setup
```

选择 Weixin / WeChat 后，根据提示扫码登录。

### 10.2 DM 私聊权限选择

如果出现：

```text
(●) Use DM pairing approval (recommended)
(○) Allow all direct messages
(○) Only allow listed user IDs
(○) Disable direct messages
```

推荐选择：

```text
Use DM pairing approval (recommended)
```

如果你希望手动白名单控制，也可以选择：

```text
Only allow listed user IDs
```

不建议长期选择：

```text
Allow all direct messages
```

因为 Hermes 可能拥有执行命令、读写文件的权限。

### 10.3 启动 Gateway

```bash
hermes gateway run
```

启动后不要关闭终端。此时微信私聊 Bot 才会有响应。

如果需要后台运行，使用 tmux：

```bash
tmux new -s hermes-gateway 'hermes gateway run'
```

退出 tmux 但保持运行：

```text
Ctrl + B
然后按 D
```

重新进入：

```bash
tmux attach -t hermes-gateway
```

停止 Gateway：

```bash
# 进入 tmux 后按 Ctrl + C
```

---

## 11. 微信 Unauthorized user 处理

如果日志出现：

```text
Unauthorized user: xxxxx@im.wechat on weixin
```

说明微信消息已经进来了，但用户没有授权。

把日志里的 ID 加到 `.env`：

```bash
nano ~/.hermes/.env
```

添加或修改：

```bash
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=xxxxx@im.wechat
```

如果多个用户，用英文逗号分隔：

```bash
WEIXIN_ALLOWED_USERS=user1@im.wechat,user2@im.wechat
```

保存后重启 Gateway：

```bash
hermes gateway run
```

---

## 12. 微信群聊警告说明

如果启动 Gateway 时出现：

```text
WEIXIN_GROUP_POLICY=open is set, but QR-login connects an iLink bot identity...
group messages may never reach Hermes
```

含义：普通个人微信群消息可能收不到，这是 iLink Bot 身份限制，不一定是 Hermes 配置问题。

建议：

```text
1. 先只测试微信私聊，不要先测微信群
2. 私聊正常后，再考虑群聊
3. 如果群聊收不到，优先认为是 iLink 侧限制
```

---

## 13. 日常使用方式

### 13.1 手动进入 Hermes

```bash
cd ~/ai/hermes
hermes
```

示例提示词：

```text
你是我的嵌入式 C 工程助手，同时兼任项目管理助理。
默认先分析，不要直接修改文件。
重点关注 ISR 中断耗时、buffer 越界、FIFO 读写、OTA 升级流程、20ms 定时处理和内存占用。
输出内容使用中文。
```

### 13.2 在工程目录使用

```bash
cd "/mnt/d/blueturm/WIFI toy LCD/sdk_ab5800_ai_toy_trunk_beta_s3111_20260325"
hermes
```

推荐首条提示词：

```text
请扫描当前工程，查找 UART、OTA、FIFO、timer、20ms 定时处理相关代码。
先不要修改文件，只输出：
1. 相关文件列表
2. 函数调用链
3. ISR 中可能的耗时操作
4. buffer 越界风险
5. OTA 和普通交互接收流程的重构建议
```

---

## 14. 一次性任务 / 脚本调用

如果你的 Hermes 版本支持 one-shot，可以用：

```bash
hermes -z "总结当前目录 git status 和最近 5 条提交，输出中文日报"
```

如果 `-z` 不支持，先查看帮助：

```bash
hermes --help
hermes chat --help
```

也可以尝试：

```bash
hermes chat -q "总结当前目录 git status 和最近 5 条提交，输出中文日报"
```

---

## 15. 日报脚本模板

创建脚本：

```bash
nano ~/daily_project_report.sh
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT="/mnt/d/blueturm/WIFI toy LCD/sdk_ab5800_ai_toy_trunk_beta_s3111_20260325"
OUT_DIR="$HOME/ai/reports"
DATE="$(date +%F)"

mkdir -p "$OUT_DIR"
cd "$PROJECT"

hermes -z "
你是我的嵌入式项目助理。
请基于当前工程目录生成今天的项目日报。
要求：
1. 查看 git status --short；
2. 查看 git log --oneline -5；
3. 如果有修改，分析可能影响的模块；
4. 不要修改任何文件；
5. 输出中文 Markdown；
6. 包含：今日修改、风险点、测试建议、明日计划。
" > "$OUT_DIR/daily_report_$DATE.md"

echo "日报已生成：$OUT_DIR/daily_report_$DATE.md"
```

赋予执行权限：

```bash
chmod +x ~/daily_project_report.sh
```

执行：

```bash
~/daily_project_report.sh
```

---

## 16. 定时任务建议

Hermes Gateway 可以同时负责消息平台和 cron scheduler。使用定时任务前，建议先确认命令：

```bash
hermes cron --help
```

如果你的版本支持 `cron create`，可以参考：

```bash
hermes cron create "every 1d at 09:00" \
"检查当前嵌入式工程 git status、最近提交、风险点和测试建议，输出中文项目日报。不要修改文件。" \
--workdir "/mnt/d/blueturm/WIFI toy LCD/sdk_ab5800_ai_toy_trunk_beta_s3111_20260325" \
--name "daily embedded project report"
```

查看任务：

```bash
hermes cron list
```

运行 Gateway 后，定时任务才适合长期执行：

```bash
tmux new -s hermes-gateway 'hermes gateway run'
```

---

## 17. 安全建议

因为 Hermes 可能执行命令、读写文件，所以建议：

```text
1. 前期所有任务都加：不要修改文件，只分析
2. 在 Git 仓库里工作，修改前先 git status
3. 重要文件先备份
4. 不要开启 GATEWAY_ALLOW_ALL_USERS=true
5. 微信 / Telegram / Slack 只允许自己或团队白名单
6. 不要把 API Key 发到聊天窗口或日志截图里
7. 不要在 /mnt/c/WINDOWS/system32 里做项目操作
8. 先私聊测试 Gateway，再考虑群聊
```

推荐代码修改流程：

```text
先分析 → 给方案 → 你确认 → 再修改 → 输出 git diff → 你人工 review → 编译测试
```

---

## 18. 常见问题排查

### 18.1 DeepSeek 401 Authentication Fails

现象：

```text
HTTP 401: Authentication Fails, Your api key is invalid
```

处理：

```bash
nano ~/.hermes/.env
```

检查：

```bash
DEEPSEEK_API_KEY=sk-xxxx
```

不要带 `Bearer`，不要加引号，不要有空格。

---

### 18.2 微信 Bot 无回复

先启动 Gateway：

```bash
hermes gateway run
```

然后看日志：

```text
Unauthorized user    → 加 WEIXIN_ALLOWED_USERS
API call failed      → 检查 DeepSeek API Key / 余额 / 模型名
没有任何日志       → 微信消息没有送到 Hermes，检查扫码登录或 iLink 状态
```

---

### 18.3 提示 Another local Hermes gateway is already using this Weixin token

说明同一个微信 token 已经被另一个 Hermes Gateway 使用。

处理：

```bash
ps -ef | grep -Ei "hermes|gateway|weixin" | grep -v grep
```

停止多余进程后再运行：

```bash
hermes gateway run
```

---

### 18.4 当前路径在 `/mnt/c/WINDOWS/system32`

建议退出 Hermes，切换目录：

```bash
cd ~
mkdir -p ~/ai/hermes
cd ~/ai/hermes
hermes
```

---

## 19. 嵌入式工程师 + 项目经理推荐 Prompt

### 19.1 工程扫描

```text
你是我的嵌入式 C 工程助手。
请扫描当前工程，找出 UART、OTA、FIFO、timer、20ms 处理相关代码。
先不要修改文件，只输出相关文件、函数调用链、风险点和重构建议。
重点检查：ISR 中断耗时、buffer 越界、FIFO 读写竞争、volatile 使用、无 OS MCU 适配性。
```

### 19.2 代码修改前方案

```text
基于刚才分析，请给出重构方案。
要求：
1. ISR 中尽量只做入队和状态判断；
2. OTA 模式下满 1KB 写入 FIFO；
3. 普通交互模式下每 20ms 处理一次；
4. 不引入动态内存；
5. 不引入复杂第三方库；
6. 先给方案，不要修改文件。
```

### 19.3 项目日报

```text
请根据当前工程状态生成项目日报。
包含：
1. 今日修改内容；
2. 影响模块；
3. 风险点；
4. 需要测试的功能；
5. 明日计划；
6. 给项目经理看的简短总结。
不要修改任何文件。
```

### 19.4 发版 checklist

```text
请生成本次固件发版 checklist。
重点覆盖：
1. version 信息；
2. bin/fot/app.bin 文件；
3. OTA header；
4. CRC32；
5. 固件长度；
6. 蓝牙连接；
7. UART 协议；
8. 音频功能；
9. 回归测试；
10. 量产风险。
```

---

## 20. 推荐最终配置路线

```text
第一阶段：CLI 跑通
- hermes model 配置 DeepSeek
- hermes 里确认 deepseek-v4-pro 正常回复

第二阶段：Gateway 跑通
- hermes gateway setup 配置微信
- WEIXIN_ALLOWED_USERS 加白名单
- hermes gateway run 私聊测试

第三阶段：日常工作流
- 项目日报脚本
- 发版 checklist
- 嵌入式代码风险扫描

第四阶段：自动化
- tmux 后台运行 gateway
- cron 定时日报/周报
- 后续按需接 Telegram / 飞书 / 企业微信
```

---

## 21. 参考资料

- NousResearch/hermes-agent GitHub 仓库
- Hermes Agent 官方 Installation / Configuration / CLI / Gateway / Environment Variables 文档
- DeepSeek 官方 Hermes Agent 集成文档
- Hermes Weixin Gateway 文档与常见错误说明


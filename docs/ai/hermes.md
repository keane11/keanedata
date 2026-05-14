---
title: Hermes Agent 完整配置指南
description: Hermes Agent 部署指南：DeepSeek 主力 + 微信 Gateway + Gemini 备选，WSL2 环境完整配置
date: 2026-05-13
tags: [AI, Agent, DeepSeek]
order: 6
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

## 2. Harness Engineering 方法论

> **Harness Engineering（驾驭工程）** — 围绕 AI Agent 构建约束机制、反馈回路、工作流控制和持续改进循环的系统工程实践。  
> 核心哲学：**人类掌舵，智能体执行（Human Steer, Agent Execute）**。

用马的比喻来理解：大模型就像一匹马，跑得很快，但也可能跑偏。Harness（马具）就是马鞍、缰绳、辔头这一套——**不优化模型本身，而是优化模型运行的环境**。

Hermes 的所有设计（背压系统、持久化记忆、结构化执行）都建立在这套方法论之上。

### 2.1 为什么需要 Harness Engineering

五个独立团队得出相同结论：**瓶颈不在模型智能，而在基础设施**。

**OpenAI 实证数据：**

| 指标 | 数据 |
|------|------|
| 团队规模 | 3–7 人 |
| 周期 | 5 个月 |
| 总代码量 | **100 万行** |
| 人工编写代码 | **0 行** |
| 合并 PR 数 | ~1500 个 |
| 人均每日 PR | 3.5 个 |

**LangChain 实证（模型一个参数都没改）：**

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| Terminal Bench 排名 | 第 30 位 | **第 5 位** |
| 编码 Agent 得分 | 52.8% | **66.5%** |

仅仅优化外部环境（文档结构、验证回路、追踪系统），排名大幅跃升。

### 2.2 AI 工程范式三次跃迁

| 阶段 | 时间 | 核心问题 | 关键手段 |
|------|------|----------|----------|
| **提示词工程** | 2023–2024 | 怎么写好 Prompt | 措辞、格式、示例优化 |
| **上下文工程** | 2024–2025 | 怎么给 AI 喂信息 | 文档切片、代码片段、历史对话 |
| **驾驭工程** | 2026 至今 | 怎么让 AI 持续可靠工作 | 约束机制、反馈回路、工作流控制 |

### 2.3 三种典型失败模式

| 失败模式 | 表现 | 在 Hermes 中的应对 |
|----------|------|-------------------|
| **一步到位（One-shotting）** | Agent 试图一次完成所有功能，上下文耗尽，留下没有文档的半成品代码 | 拆分任务，每次只做一个明确阶段，写完立即提交 |
| **过早宣布胜利** | 部分功能完成后 Agent 认为任务已完成，忽略剩余需求 | Prompt 中明确列出完成标准，要求逐项确认 |
| **未验证就标记完成** | 写完代码直接宣布 done，没有端到端测试 | 要求 Agent 给出验证命令并实际执行后才算完成 |

### 2.4 Harness 核心组件

#### 上下文工程（Context Engineering）

类比新员工手册：**AGENTS.md** 是 AI Agent 进入代码仓库时看到的第一份文件，决定了 Agent 能否"看懂"项目。在 Hermes 中对应 `.hermes/AGENTS.md`，写入约束规则、项目背景、禁止操作等。

#### 结构化执行（Structured Execution）

> 核心原则：**将思考与执行分离**

研究和规划在受控阶段进行，执行基于验证过的计划，验证通过自动化反馈（测试、编译、CI）完成。

```
理解  →  规划  →  执行  →  验证
```

1. **理解**：读 git log、进度文件、相关代码，梳理现状
2. **规划**：给出方案，**不修改文件**，等待确认
3. **执行**：按确认的方案分步实现，每完成一个功能点提交一次
4. **验证**：运行测试/编译，输出结果，确认功能正确

#### 持久化记忆（Persistent Memory）

> 核心原则：**进度持久化在文件系统上，而非上下文窗口中**

每次新会话从零开始，通过文件系统制品重建上下文：

```bash
# 每次会话开始，让 Agent 执行这个初始化序列：
pwd
git log --oneline -5
cat PROGRESS.md        # 读取进度文件
cat .hermes/AGENTS.md  # 读取约束规则
```

**进度文件示例（PROGRESS.md）：**

```markdown
# 当前任务进度

## 已完成
- [x] UART ISR 入队逻辑重构（commit abc1234）
- [x] OTA 模式 1KB 写入 FIFO（commit def5678）

## 进行中
- [ ] 普通模式 20ms 处理器实现

## 待开始
- [ ] 单元测试补充
- [ ] 文档更新
```

#### 架构约束（Architecture Constraints）

将架构规则编码为**自动化检查**，违反即阻止合并——不管代码是 AI 写的还是人写的：
- 定义模块依赖方向（如 Types → Config → Service → UI，下层不能反向依赖上层）
- 错误信息不只标记违规，**还告诉 Agent 如何修复**（错误信息本身也是上下文工程的一部分）

#### 反馈循环（Feedback Loops）

传统开发中人类工程师负责代码审查，在 Harness Engineering 中变成 **Agent 对 Agent** 的方式：
- Agent 在本地审核自身更改 → 请求额外审查 → 循环直至通过
- Agent 独立评估自身代码，若有 bug 的测试通过了 → 判定为无效测试，要求重新编写

#### 代码债务管理（Garbage Collection）

Agent 批量生成大量代码时，会复制已有代码的风格和问题。应对策略：
- **持续小额偿还**，而非问题严重了再处理
- 定期运行后台 Agent 扫描偏差，发起针对性重构 PR
- 专门的**文档一致性 Agent**：自动扫描文档与代码不一致，发现问题就提交 PR 修复

### 2.5 背压模型（Backpressure）

Hermes 的 `.hermes/backpressure/` 目录实现了双向背压控制：

| 方向 | 机制 | 作用 |
|------|------|------|
| **上背压**（执行前） | AGENTS.md、Memory、约束 Prompt | 在 Agent 开始工作前施加约束，引导走向正确方向 |
| **下背压**（执行后） | 编译检查、测试、格式验证 | Agent 完成后验证产出，拒绝无效输出并反馈 |

> 记录规则：每次工具调用失败时写入 `.hermes/backpressure/README.md`，连续失败 6 次即停止当前方向，换思路。

自治循环模式（Huntley 背压模型）：
```bash
while :; do cat PROMPT.md | hermes; done
```
生产环境中 Agent 直接推送，出错时自动回滚并进入修复循环自我修复。

### 2.6 上下文管理

- 不要把所有文件都塞进上下文，只注入当前任务相关的片段
- 日志写入文件而非打印到终端（避免污染上下文窗口）
- 让 Agent 用 `grep` 定向搜索，而非 `cat` 整个文件
- 计算聚合统计而非输出原始数据（如输出"共 100 行"而非全文）

### 2.7 业界实战案例

#### OpenAI — 百万代码零手写工程

**五大原则：**

1. **设计环境，而非编写代码** — 把关注点从代码转移到环境设计，代码用 AI 生成，环境的设计需要人来把控
2. **机械化执行架构约束** — 自定义 Linter + 结构测试自动检测违规；文档表明是不够的，不能机械化执行 Agent 就会偏离
3. **将代码仓库作为唯一事实源** — Slack 讨论、Google Docs 中的知识对 Agent 等于不存在，所有知识放到仓库里
4. **将可观测性连接到 Agent** — 使 Agent 能够捕获 DOM 快照和截图，让"将启动时间降至 800ms 以下"变成可度量目标
5. **对抗熵（持续代码清理）** — 最初每周五手动清理 AI 代码，后期改用后台 Codex 任务自动清理

#### Anthropic — 长时间运行 Agent 的两阶段方案

**核心痛点：** 长时间运行的 Agent 必须在多个独立会话中工作，每次新会话启动时对之前的工作一无所知。

| 阶段 | 角色 | 行为 |
|------|------|------|
| 初始化 Agent | 建立者 | 运行专门的 Prompt 初始化环境，建立 `init.sh`、进度文件、初始 git 提交 |
| 编码 Agent | 执行者 | 每次后续会话：读取进度文件和 git log，做出增量进展，留下结构化更新 |

**实际工作模式：** 每天最后 30 分钟启动一个或多个 Agent，Agent 在非工作时间推进进展，为第二天提供"暖启动"。

**Anthropic OSS 项目数据：**

| 指标 | 数据 |
|------|------|
| 周期 | 2 周 |
| Agent 数量 | 16 个 |
| Claude Code 会话数 | ~2000 |
| 最终产出代码 | 10 万行 |
| 测试通过率 | 99% |
| API 总成本 | ~$20,000 |

关键设计：每个 Agent 运行随机 1–10% 的测试，跨 Agent 随机抽样，集体覆盖完整测试套件。

#### Stripe — 极致 PR 自动化

- 开发者发一条消息，从写代码到跑 CI 到提交 PR **全程包办**
- 关键要素：500+ 工具覆盖内部系统、隔离预发布沙盒（与人类工程师使用相同环境）
- Agent 和人类工程师拥有**相同的上下文和工具**，而非事后集成

#### Hashimoto — Ghostty 实践

> AGENTS.md 的每一行都对应着一个过去的 Agent 失败案例 — 现在被永久预防。

### 2.8 六大行业落地准则

综合 OpenAI、Anthropic、LangChain、Stripe、HashiCorp 的共识：

| 准则 | 核心观点 |
|------|---------|
| **1. 瓶颈在基础设施** | 仅改变工具格式，模型得分可从 6.7% 跳到 68.3% |
| **2. 文档必须是活的反馈循环** | 静态文档是坟墓；后台 Agent 定期清理过时文档并提交 PR |
| **3. 思考与执行分离** | 复杂任务不可能在单一上下文窗口内完成，状态持久化到外部存储 |
| **4. 上下文不是越多越好** | 上下文是稀缺资源，需要裁剪和动态注入 |
| **5. 约束必须自动化** | 人工审核是瓶颈，编码到 Linter/CI 由机器执行 |
| **6. 工程师角色在转变** | 从代码的编写者 → **环境的设计师** |

---

## 3. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl nano tmux python3
```

---

## 4. 安装 Hermes Agent

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version
```

如果命令不存在，重新打开终端或执行 `source ~/.bashrc`。

---

## 5. 推荐目录规划

```bash
mkdir -p ~/ai/hermes
mkdir -p ~/ai/reports
mkdir -p ~/projects
cd ~/ai/hermes
```

> 如果工程在 Windows 盘，用 `/mnt/d/...` 路径访问即可，但频繁读写大量文件时建议移到 Linux 文件系统。

---

## 6. DeepSeek 配置

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

## 7. Gemini API 备选配置

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

## 8. 文档处理配置

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

## 9. 微信 Gateway

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

## 10. 常用命令速查

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

## 11. 推荐 Prompt 模板

### 会话初始化（每次新会话必用）

```
请按以下顺序初始化：
1. 执行 pwd，确认工作目录
2. 执行 git log --oneline -5，了解最近提交
3. 读取 PROGRESS.md（如有），了解当前任务进度
4. 读取 .hermes/AGENTS.md（如有），了解约束规则
5. 简述当前状态，等待我下一步指令
不要主动开始修改任何文件。
```

### 结构化任务启动

```
任务：[具体任务描述]

请按四步执行：
1. 【理解】分析相关代码，列出现状和影响范围
2. 【规划】给出实现方案，不要修改文件，等我确认
3. 【执行】按确认的方案分步实现，每完成一个小功能就提交一次
4. 【验证】运行 [测试命令]，输出结果

现在先做第 1 步。
```

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

## 12. 日报脚本

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

## 13. 常见问题排查

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

## 14. 安全建议

- 所有任务初期加：**不要修改文件，只分析**
- 在 Git 仓库工作，修改前先 `git status`
- 不要开启 `GATEWAY_ALLOW_ALL_USERS=true`
- 消息平台只允许自己的白名单
- 不要把 API Key 发到聊天窗口或截图里

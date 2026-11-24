---
title: Gemini 使用指南
description: Google Gemini 使用指南，含 Antigravity CLI（原 Gemini CLI）迁移和超长上下文实战技巧
date: 2026-11-24
tags: [AI, Gemini]
order: 3
---

# Gemini 使用指南

> Google DeepMind 出品，深度整合 Google 搜索、Workspace 生态与原生多模态能力。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [gemini.google.com](https://gemini.google.com) | 免费版可用最新 Flash 系列，付费升级 Google AI Pro / Ultra |
| API | [Google AI Studio](https://aistudio.google.com) | 提供开发测试免费额度，支持统一 `google-genai` SDK |
| 集成 | Google Docs / Gmail | Workspace 与 Google AI 订阅用户可直接调用 |

## 模型选择（2026 年 11 月）

> ⚠️ **重要停服提醒**：旧版 **Gemini 2.0 Flash**（`gemini-2.0-flash` 及 Lite 变体）已于 **2026 年 6 月 1 日**正式关停，直接调用会报错；Gemini 2.5 系列也已进入弃用/自动路由阶段。新项目请使用最新一代稳定模型（最新模型 ID 以 [Gemini API 文档](https://ai.google.dev/gemini-api/docs/models) 为准）。

| 模型系列 | 定位 | 适合场景 |
|----------|------|---------|
| Gemini 4 系列 | 新一代旗舰 | 复杂推理、前沿多模态与 Agent 任务 |
| Gemini 3.8 Flash | 速度与质量均衡主力 | 日常对话、编程、高频多模态分析 |
| Gemini 3.5 Flash Lite | 超低延迟、低成本 | 批量分类、轻量高频任务 |

## 核心优势

### 超长上下文

Gemini 支持 **1M+ token** 超长上下文（约 75 万汉字），可以：
- 将整个代码仓库粘贴进去分析
- 一次性处理几小时的视频字幕或音频
- 阅读整本书并跨章节问答

### 原生多模态

同一个模型同时理解文本、图片、音频、视频和代码，无需切换模型。

> ⚠️ **SDK 变更**：旧版 `google-generativeai`（`import google.generativeai`）已正式停止维护（EOL），请统一安装新 SDK：`pip install -U google-genai`。

```python
from google import genai
from PIL import Image

# 自动读取环境变量 GEMINI_API_KEY，也可显式传入 genai.Client(api_key="...")
client = genai.Client()

img = Image.open("screenshot.png")
response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["描述图中的内容并提取所有文字", img],
)
print(response.text)
```

### Google 搜索联网

网页版内置实时搜索，回答时会标注信息来源，适合需要最新资讯的场景。

## API 快速上手

```python
from google import genai
from google.genai import types

client = genai.Client()  # 读取环境变量 GEMINI_API_KEY

chat = client.chats.create(
    model="gemini-3.8-flash",
    config=types.GenerateContentConfig(
        system_instruction="你是一位 Python 专家，回答简洁直接"
    ),
)

response = chat.send_message("解释 Python 的 GIL 是什么")
print(response.text)
```

## 终端 CLI：从 Gemini CLI 迁移到 Antigravity CLI

::: danger 重要变更（2026-06 已生效）
Google 已于 **2026 年 6 月 18 日**正式停止向个人用户提供旧版 **Gemini CLI**（`@google/gemini-cli`），由新一代 **Antigravity CLI**（命令 `agy`，Go 独立二进制）接替。个人用户请迁移至 `agy`；企业版授权及付费 Gemini API Key 用户仍可继续使用旧版。

完整安装、认证与迁移步骤见 [WSL 安装 AI CLI 工具](./wsl_ai_cli_教程#8-antigravity-cligoogle接替-gemini-cli)。
:::

Antigravity CLI 延续了 Gemini CLI 的核心能力——超长上下文、原生多模态、Google 搜索联网，并支持多 Agent 协作。

### 常用命令

```bash
# 启动交互式会话（首次运行触发 Google 账号 OAuth 登录）
agy

# 单次提问
agy "解释 Python GIL 对多线程的影响"

# 读取文件内容作为上下文
agy "总结这个项目的整体架构" < README.md

# 传入大量文件（发挥超长上下文优势）
cat src/**/*.py | agy "找出这些文件中重复的业务逻辑，给出重构建议"

# 查看全部命令与参数
agy --help
```

> 旧版 `gemini` 的 `--model`、`--json`、`--no-search` 等参数不一定原样保留，具体以 `agy --help` 实际输出为准。

### GEMINI.md 项目配置

类似 Claude 的 CLAUDE.md，在项目根目录创建 `GEMINI.md` 作为持久化上下文（迁移到 Antigravity CLI 后 `GEMINI.md` 仍然有效，也可改用通用的 `AGENTS.md`）：

```markdown
# 项目背景
这是一个嵌入式固件项目，目标平台 GD32VF103（RISC-V）。

# 代码规范
- C11 标准，不使用动态内存分配
- 函数名 snake_case，宏名 UPPER_CASE
- 所有寄存器访问必须加 volatile

# 关键约束
- Flash 限制 128KB，RAM 限制 32KB
- 不依赖 C 标准库（-nostdlib）
```

### MCP 工具支持

Antigravity CLI 沿用了 Gemini CLI 的 MCP（Model Context Protocol）支持，配置方式与 Claude Code 类似（迁移后配置文件移至 `~/.gemini/antigravity-cli/` 目录，且 MCP 服务器需把 `url` 字段改名为 `serverUrl`）：

```json
// ~/.gemini/settings.json（旧版 Gemini CLI）；Antigravity CLI 见 ~/.gemini/antigravity-cli/mcp_config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    }
  }
}
```

### 超长上下文实战

```bash
# 分析整个仓库（100 万 token 足够加载大型项目）
find . -name "*.c" -o -name "*.h" | xargs cat | \
  agy "分析这个嵌入式项目的驱动层架构，找出潜在的内存安全问题"

# 对比两个版本的差异
git diff v1.0..v2.0 | agy "总结这次版本更新的主要变化和风险点"

# 从文档生成代码
cat spec/*.md | agy "根据这份需求文档生成对应的 API 接口框架代码（Python FastAPI）"
```

## 免费额度与套餐参考（2026 年 11 月）

- **Google AI Studio API 免费层**：Flash / Flash Lite 系列仍提供免费测试配额（RPM / RPD 随模型调整），适合个人学习与原型开发，详见 [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)。
- **网页端个人订阅**：已从旧版 Gemini Advanced 升级为 **Google AI Plus**、**Google AI Pro（$19.99/月）** 和 **Google AI Ultra**，提供更高阶模型、Deep Think 深度思考及更大云存储。

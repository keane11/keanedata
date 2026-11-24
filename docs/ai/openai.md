---
title: OpenAI 使用指南
description: OpenAI GPT 系列使用指南，含 Codex CLI 审批模式配置和自动化工作流实战
date: 2026-11-24
tags: [AI, OpenAI]
order: 2
---

# OpenAI 使用指南

> GPT 系列模型，应用生态最为丰富，覆盖通用对话、深度推理、原生多模态与 Codex 终端编程。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [chatgpt.com](https://chatgpt.com) | Free / Go ($8) / Plus ($20) / Pro ($100–$500) 多档位 |
| API | platform.openai.com | 按 token 计费，需绑定信用卡/预充值 |
| 客户端 | 桌面 / 移动 App | 与网页版同步，支持实时语音与多模态 |

## 模型选择（2026 年 11 月）

> 旧版 GPT-4o / GPT-4o mini / o3 / o4-mini 已逐步退场或由新一代原生推理架构替代。

| 模型系列 | 定位 | 适合场景 |
|----------|------|---------|
| GPT-6 Astra（含 Pro 档） | 顶级深度推理与研究 | 复杂架构设计、长程规划、前沿科研与难题 |
| GPT-6 Sol | 主力通用与推理 | 日常编程、复杂分析、图文多模态 |
| GPT-6 Luna | 轻量高速、低成本 | 高频问答、批量处理、日常对话 |
| GPT-5-Codex / Codex 系列 | 终端编程专用 | Codex CLI 自主编码、多文件重构 |

## 核心使用技巧

### Few-shot 示例引导

在提示词中提供 2-3 个示例，模型会按样式输出：

```
将下列日期统一转为 YYYY-MM-DD 格式：

"January 5th, 2024"  → "2024-01-05"
"March 20th, 2023"   → "2023-03-20"
"December 1st, 2025" →
```

### 思维链（Chain of Thought）

让模型先推理再给答案，适合需要精确结果的场景：

```
请一步步思考后再给出最终答案：
一列火车从 A 到 B 需要 3 小时，平均速度 120km/h。
若速度提升 20%，需要几小时？
```

### 结构化输出（JSON Mode）

通过 API 调用时指定 `response_format`，保证返回合法 JSON：

```python
response = client.chat.completions.create(
    model="gpt-6-sol",  # 具体 model ID 以 platform.openai.com 最新文档为准
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": "你只返回 JSON，不说其他内容"},
        {"role": "user", "content": "提取文中的人名和日期"}
    ]
)
```

### 函数调用（Function Calling）

让模型决定何时调用工具，适合构建 AI Agent：

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "获取指定城市的天气",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string"}
            },
            "required": ["city"]
        }
    }
}]
```

## API 快速上手

```python
from openai import OpenAI

client = OpenAI(api_key="your-key")

response = client.chat.completions.create(
    model="gpt-6-sol",
    messages=[
        {"role": "system", "content": "你是一位 Python 专家"},
        {"role": "user", "content": "写一个读取 CSV 并计算平均值的脚本"}
    ]
)

print(response.choices[0].message.content)
```

## 图像理解（Vision）

```python
response = client.chat.completions.create(
    model="gpt-6-sol",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "描述图片中的内容"},
            {"type": "image_url", "image_url": {"url": "https://..."}}
        ]
    }]
)
```

## Codex CLI

Codex CLI 是 OpenAI 推出的终端编程 Agent，核心特色是通过 **`sandbox_mode`（沙箱权限）** 与 **`approval_policy`（审批策略）** 两个维度精细控制 AI 操作权限。安装方式见 [WSL 安装 AI CLI 工具](./wsl_ai_cli_教程)。

> ⚠️ **版本变更说明**：早期版本的 `--approval-mode suggest/auto-edit/full-auto` 和 `codex.yaml` 已弃用，新版统一改为 `--sandbox`、`--ask-for-approval` 与 `~/.codex/config.toml`（项目规范文件改用 `AGENTS.md`）。

### 常用命令

```bash
# 启动交互式会话（支持 ChatGPT 账号登录或 API Key）
codex

# 单次任务描述
codex "列出当前目录下所有大于 1MB 的文件，按大小排序"

# 非交互执行（适合脚本/CI）
codex exec "为 utils.py 补充单元测试并运行 pytest"

# 指定模型
codex --model gpt-5-codex "分析这段代码的时间复杂度，给出最优解"

# 指定沙箱模式（-s / --sandbox）
codex --sandbox read-only "审查当前项目的安全风险"
codex --sandbox workspace-write "为所有函数添加 Python 类型注解"

# 指定审批策略（-a / --ask-for-approval）
codex --ask-for-approval on-request "优化这个 SQL 查询"
codex -a never -s workspace-write "运行测试并自动修复所有失败用例"

# 内联覆盖配置项（-c / --config）
codex -c approval_policy=never -c sandbox_mode=workspace-write "整理依赖"

# 完全跳过沙箱与审批（仅限隔离容器/可信环境，慎用）
codex --yolo
```

### 沙箱与审批策略详解

| 维度 | 取值 | 行为说明 |
|------|------|---------|
| **`--sandbox` (`-s`)** | `read-only` | 只读，不能改文件也不能执行有副作用的命令 |
| | `workspace-write` | 仅允许在当前项目工作区内读写与运行命令（保护 `.git` 等敏感目录） |
| | `danger-full-access` | 关闭沙箱限制，拥有宿主机完整权限 |
| **`--ask-for-approval` (`-a`)** | `on-request` | 仅在越界操作（如联网、修改工作区外文件）时请求确认 |
| | `never` | 全程不弹窗确认，配合 `workspace-write` 适合自动化任务 |

### 配置文件（`~/.codex/config.toml`）

全局配置位于 `~/.codex/config.toml`（也支持项目级 `.codex/config.toml`），项目开发规范则写在根目录的 **`AGENTS.md`** 中：

```toml
# ~/.codex/config.toml
model = "gpt-5-codex"
model_reasoning_effort = "medium"

# 沙箱模式：read-only | workspace-write | danger-full-access
sandbox_mode = "workspace-write"

# 审批策略：on-request | never
approval_policy = "on-request"
```

### 实用工作流

```bash
# 自动修复测试失败（沙箱内免确认）
codex -s workspace-write -a never "运行 pytest，修复所有失败的测试"

# 只读模式做代码审查（安全不改文件）
codex -s read-only "对当前 git diff 做 code review，找出潜在 Bug 和安全隐患"

# 迁移适配
codex -s workspace-write -a on-request \
  "把所有 requests 库的调用改为 httpx 异步写法"

# 文档生成
codex -s workspace-write \
  "为 src/ 下所有没有 docstring 的公开函数生成文档字符串"
```

## 套餐与费用参考（2026 年 11 月）

### ChatGPT 个人订阅
- **Free**：$0/月，基础对话与轻量模型（有限额）
- **Go**：$8/月，更高消息额度、文件上传与生图额度
- **Plus**：$20/月，解锁高阶推理模型、深度研究、Codex 集成，无广告
- **Pro**：$100 / $200 / $500/月，重度开发者与研究者多档位，高额度并附带 API 信用额度

### OpenAI API 计费说明
- API 按每百万 Token 分别计费（区分**普通输入 / 缓存命中输入 / 输出**，Prompt Caching 可显著降低重复上下文成本）。
- 由于模型迭代与降价频繁，具体最新单价请直接查阅 [OpenAI Pricing 官方页](https://openai.com/api/pricing/)。

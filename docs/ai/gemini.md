---
title: Gemini 使用指南
description: Google Gemini 使用指南，含 Gemini CLI 安装配置和超长上下文实战技巧
date: 2026-05-13
tags: [AI, Gemini]
order: 3
---

# Gemini 使用指南

> Google DeepMind 出品，深度整合 Google 搜索和 Workspace 生态。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [gemini.google.com](https://gemini.google.com) | 免费版用 Gemini 2.0 Flash |
| API | Google AI Studio | 免费额度较高，适合开发测试 |
| 集成 | Google Docs / Gmail | Workspace 用户可直接调用 |

## 模型选择

| 模型 | 定位 | 适合场景 |
|------|------|---------|
| Gemini 2.5 Pro | 最强推理 | 复杂代码、长文档、多模态分析 |
| Gemini 2.0 Flash | 速度与质量均衡 | 日常对话、快速问答 |
| Gemini 2.0 Flash Lite | 超低延迟 | 高频轻量任务 |

## 核心优势

### 超长上下文

Gemini 2.5 Pro 支持 **1M token** 上下文（约 75 万字），可以：
- 将整个代码仓库粘贴进去分析
- 一次性处理几小时的视频字幕
- 阅读整本书并跨章节问答

### 原生多模态

同一个模型同时理解文本、图片、音频、视频和代码，无需切换模型。

```python
import google.generativeai as genai
from PIL import Image

genai.configure(api_key="your-key")
model = genai.GenerativeModel("gemini-2.0-flash")

img = Image.open("screenshot.png")
response = model.generate_content(["描述图中的内容并提取所有文字", img])
print(response.text)
```

### Google 搜索联网

网页版内置实时搜索，回答时会标注信息来源，适合需要最新资讯的场景。

## API 快速上手

```python
import google.generativeai as genai

genai.configure(api_key="your-key")

model = genai.GenerativeModel(
    model_name="gemini-2.5-pro",
    system_instruction="你是一位 Python 专家，回答简洁直接"
)

chat = model.start_chat()
response = chat.send_message("解释 Python 的 GIL 是什么")
print(response.text)
```

## Gemini CLI

Gemini CLI 是 Google 推出的终端 AI 助手，最大亮点是支持 100 万 token 上下文，适合大型代码库分析。安装方式见 [WSL 安装 AI CLI 工具](./wsl_ai_cli_教程)。

### 常用命令

```bash
# 启动交互式会话（首次运行触发 Google 账号 OAuth 登录）
gemini

# 单次提问
gemini "解释 Python GIL 对多线程的影响"

# 读取文件内容作为上下文
gemini "总结这个项目的整体架构" < README.md

# 传入大量文件（发挥超长上下文优势）
cat src/**/*.py | gemini "找出这些文件中重复的业务逻辑，给出重构建议"

# 指定模型
gemini --model gemini-2.5-pro   "对整个代码库做全面性能分析"
gemini --model gemini-2.5-flash "快速生成单元测试框架"

# 关闭联网搜索（仅使用输入的上下文）
gemini --no-search "解释这段正则表达式"

# JSON 输出（适合脚本处理）
gemini --json "列出这段代码的所有函数名及其功能描述"

# 调整输出长度
gemini --max-output-tokens 4096 "详细讲解这个算法的时间复杂度"
```

### 交互模式斜杠命令

| 命令 | 功能 |
|------|------|
| `/help` | 查看所有指令 |
| `/clear` | 清空当前对话 |
| `/model` | 切换模型 |
| `/tools` | 查看已启用的工具列表 |
| `/memory` | 管理 Gemini 的长期记忆 |
| `/quit` | 退出 |

### GEMINI.md 项目配置

类似 Claude 的 CLAUDE.md，在项目根目录创建 `GEMINI.md` 作为持久化上下文：

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

Gemini CLI 支持 MCP（Model Context Protocol），配置方式与 Claude Code 类似：

```json
// ~/.gemini/settings.json
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
  gemini "分析这个嵌入式项目的驱动层架构，找出潜在的内存安全问题"

# 对比两个版本的差异
git diff v1.0..v2.0 | gemini "总结这次版本更新的主要变化和风险点"

# 从文档生成代码
cat spec/*.md | gemini "根据这份需求文档生成对应的 API 接口框架代码（Python FastAPI）"
```

## 免费额度参考（2025年）

| 模型 | 免费 RPM | 免费 TPD |
|------|---------|---------|
| Gemini 2.5 Pro | 5 | 25,000 tokens |
| Gemini 2.0 Flash | 15 | 1,000,000 tokens |
| Gemini 2.0 Flash Lite | 30 | 1,500,000 tokens |

> RPM = 每分钟请求数，TPD = 每天 token 数。Flash Lite 免费额度最高，适合学习使用。

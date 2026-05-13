# Claude 使用指南

> Anthropic 出品的 AI 助手，在长文本处理、代码编写和逻辑推理方面表现出色。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [claude.ai](https://claude.ai) | 免费版每天有限额，Pro 版无限制 |
| API | Anthropic API | 按 token 计费，适合集成到应用 |
| CLI | Claude Code | 终端工具，专为编程场景设计 |

## 模型选择

| 模型 | 定位 | 适合场景 |
|------|------|---------|
| Claude Opus 4 | 最强推理 | 复杂分析、长文档、难题攻关 |
| Claude Sonnet 4.6 | 性价比首选 | 日常编程、写作、对话 |
| Claude Haiku 4.5 | 速度最快 | 简单任务、高频调用 |

## 核心使用技巧

### 系统提示词（System Prompt）

开头设定角色和约束，能显著提升输出质量和一致性。

```
你是一位资深 Python 工程师。
- 优先给出可直接运行的代码示例
- 解释只说关键点，不写废话前言
- 遇到多种实现方案时，先给推荐方案，再简述其他选项
```

### 长文档分析

Claude 支持超长上下文（Opus 支持 200K token），适合：
- 贴入整个代码文件让它 review
- 上传 PDF 论文逐段分析
- 多轮对话中始终记住前文

### 结构化输出

需要固定格式时，直接在提示词里给模板：

```
按以下 JSON 格式返回结果，不要额外说明：
{
  "summary": "...",
  "tags": ["...", "..."],
  "difficulty": "easy|medium|hard"
}
```

### 让 Claude 自我纠错

```
先完成任务，再以批评者身份检查自己的输出，
找出至少 2 个可以改进的地方并修正。
```

## Claude Code

Claude Code 是 Anthropic 官方 CLI 工具，在终端直接调用 Claude 协助编程。

### 安装与启动

```bash
npm install -g @anthropic-ai/claude-code
claude
```

### 常用场景

```bash
# 直接提问（不进入交互模式）
claude -p "解释这段代码的作用" < main.py

# 让它自主完成任务
claude "帮我写单元测试，覆盖 utils.py 里所有函数"

# 代码 Review
claude "review 这次的改动，重点看安全问题"
```

### 权限模式

| 模式 | 说明 |
|------|------|
| 默认 | 每次修改文件前询问确认 |
| `--dangerously-skip-permissions` | 自动执行所有操作（慎用） |

## API 快速上手

```python
import anthropic

client = anthropic.Anthropic(api_key="your-key")

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "用 Python 写一个二分查找"}
    ]
)

print(message.content[0].text)
```

## 免费额度参考

- **claude.ai 免费版**：每天约 20-30 条消息（Sonnet）
- **API**：新账号有 $5 免费额度，用完需充值
- **Claude Code**：需要 API Key 或 Claude.ai Pro 订阅

# OpenAI 使用指南

> GPT 系列模型，应用生态最为丰富，插件和第三方集成众多。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [chatgpt.com](https://chatgpt.com) | 免费版用 GPT-4o mini，Plus 版解锁全系列 |
| API | platform.openai.com | 按 token 计费，需绑定信用卡 |
| 客户端 | 桌面 / 移动 App | 与网页版同步，支持语音对话 |

## 模型选择

| 模型 | 定位 | 适合场景 |
|------|------|---------|
| GPT-4o | 多模态旗舰 | 图文理解、日常编程、快速问答 |
| o3 / o4-mini | 深度推理 | 数学竞赛、逻辑推理、复杂代码 |
| GPT-4o mini | 轻量快速 | 简单任务、高频批量处理 |

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
    model="gpt-4o",
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
    model="gpt-4o",
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
    model="gpt-4o",
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

Codex CLI 是 OpenAI 推出的终端编程助手，核心特色是精细的「审批模式」控制 AI 操作权限。安装方式见 [WSL 安装 AI CLI 工具](./wsl_ai_cli_教程)。

### 常用命令

```bash
# 启动交互式会话
codex

# 单次任务描述
codex "列出当前目录下所有大于 1MB 的文件，按大小排序"

# 将文件内容作为输入
codex "重构这个函数，减少嵌套层级，保持功能不变" < utils.py

# 指定模型（默认 o4-mini，o3 推理更强）
codex --model o3 "分析这段代码的时间复杂度，给出最优解"

# 指定审批模式（见下方说明）
codex --approval-mode suggest   "优化这个 SQL 查询"
codex --approval-mode auto-edit "为所有函数添加 Python 类型注解"
codex --approval-mode full-auto "运行测试并自动修复所有失败用例"

# 指定工作目录
codex --cwd /path/to/project "检查项目依赖有没有已知安全漏洞"

# 静默模式（减少交互提示）
codex --quiet "生成标准 README.md"
```

### 审批模式详解

| 模式 | 文件修改 | 命令执行 | 适用场景 |
|------|---------|---------|---------|
| `suggest`（默认） | 只给建议，不执行 | 不执行 | 学习、代码评审 |
| `auto-edit` | 自动修改文件 | 执行前需确认 | 日常开发，有安全兜底 |
| `full-auto` | 全自动 | 全自动 | CI、脚本、测试修复 |

### 配置文件（codex.yaml）

在项目根目录创建 `codex.yaml`：

```yaml
# 默认审批模式
approvalMode: auto-edit

# 默认模型
model: o4-mini

# 项目上下文（会附加到每次请求）
instructions: |
  这是一个 Python 3.11 项目，使用 FastAPI 框架。
  代码规范：类型注解全覆盖，black 格式化，ruff 检查。
  测试用 pytest，覆盖率要求 80% 以上。

# 沙箱策略（full-auto 时限制可执行的命令）
sandbox:
  allowedCommands:
    - pytest
    - ruff
    - black
    - git status
    - git diff
```

### 实用工作流

```bash
# 自动修复测试失败
codex --approval-mode full-auto "运行 pytest，修复所有失败的测试"

# 代码审查 + 修复
codex "对这次 git diff 做 code review，找出 Bug 并自动修复" <<< "$(git diff)"

# 迁移适配
codex --approval-mode auto-edit \
  "把所有 requests 库的调用改为 httpx 异步写法"

# 安全扫描
codex --approval-mode suggest \
  "扫描整个项目，列出所有可能的 SQL 注入、XSS、硬编码密钥问题"

# 文档生成
codex --approval-mode auto-edit \
  "为 src/ 下所有没有 docstring 的公开函数生成文档字符串"
```

## 费用参考（2025年）

| 模型 | 输入（每百万 token） | 输出（每百万 token） |
|------|---------------------|---------------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| o3 | $10.00 | $40.00 |

> 中文每个汉字约 1-2 个 token，1000 字约 ¥0.1-0.5（GPT-4o mini）。

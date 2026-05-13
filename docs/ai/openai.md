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

## 费用参考（2025年）

| 模型 | 输入（每百万 token） | 输出（每百万 token） |
|------|---------------------|---------------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| o3 | $10.00 | $40.00 |

> 中文每个汉字约 1-2 个 token，1000 字约 ¥0.1-0.5（GPT-4o mini）。

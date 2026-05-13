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

## 免费额度参考（2025年）

| 模型 | 免费 RPM | 免费 TPD |
|------|---------|---------|
| Gemini 2.5 Pro | 5 | 25,000 tokens |
| Gemini 2.0 Flash | 15 | 1,000,000 tokens |
| Gemini 2.0 Flash Lite | 30 | 1,500,000 tokens |

> RPM = 每分钟请求数，TPD = 每天 token 数。Flash Lite 免费额度最高，适合学习使用。

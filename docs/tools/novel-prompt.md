---
title: 网文 Prompt 生成器
description: 中文网文写作辅助工具：8 大题材预设，支持人物卡、世界观、大纲、章节扩写、润色检查五种 Prompt 一键生成，兼容起点/番茄/晋江平台风格。
date: 2026-05-18
---

# 网文 Prompt 生成器

选择题材和目标平台，填写核心设定，自动生成可直接粘贴到 DeepSeek / Kimi / Claude 的写作 Prompt。

<script setup>
import NovelPromptTool from '../.vitepress/theme/tools/NovelPromptTool.vue'
</script>

<NovelPromptTool />

::: tip 最佳使用流程
1. **人物卡** → 点"载入示例"获得该题材的范例，按自己思路修改 → 复制 Prompt 生成人物卡
2. **世界观** → 同样载入示例后修改 → 生成完整世界观文档
3. **大纲** → 把人物卡和世界观的核心内容粘贴进来 → 生成三幕大纲
4. **章节扩写** → 每次写新章节前填入节点描述 → 生成该章 Prompt（选好平台后自动附加风格补丁）
5. **润色检查** → 把 AI 生成的初稿粘贴进来 → 生成检查 Prompt，查 AI 味 + 逻辑漏洞

详细写作策略见 [AI 写中文网文完整指南](/productivity/ai-novel)。
:::

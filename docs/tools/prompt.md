---
title: Prompt 构建器
description: 结构化 Prompt 生成工具，提供代码助手/翻译/写作/数据分析四种模板，一键生成高质量提示词
date: 2026-05-13
---

# Prompt 构建器

选择预设模板或自定义填写各字段，自动组合生成结构化 Prompt，复制后直接粘贴到 Claude / GPT / Gemini 使用。

<script setup>
import PromptBuilder from '../.vitepress/theme/tools/PromptBuilder.vue'
</script>

<PromptBuilder />

::: tip 好的 Prompt 的四个要素
- **角色**：告诉 AI 它是谁，建立专业背景
- **任务**：清晰描述你要做什么
- **约束**：说明限制条件和不要做什么
- **格式**：指定输出结构，减少来回修改
:::

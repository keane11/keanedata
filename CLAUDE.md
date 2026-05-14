# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run docs:dev      # 启动本地开发服务器（热重载）
npm run docs:build    # 构建到 docs/.vitepress/dist/
npm run docs:preview  # 本地预览生产构建结果
npm run new <section> <slug>  # 创建新文章
# 可用分区：ai | notes | projects
# 示例：npm run new notes fastapi
```

本项目是静态内容站，没有 lint 或测试命令。

## 部署方式

推送到 `main` → GitHub Actions 构建 → 部署到 GitHub Pages（keaneai.top）。工作流使用 `fetch-depth: 0` 以确保 `lastUpdated` 时间戳正常工作。

**重要同步规则：** 博客管理后台（Admin Panel）通过 GitHub REST API 直接提交到远端，不经过本地 git 树。每次本地推送前必须先 `git pull --rebase origin main`，否则会覆盖后台的修改。`.git/hooks/pre-push` 钩子会在每次推送前自动完成这一步。

## 架构说明

### 内容结构

三个内容分区，均通过 `vitepress-sidebar` 自动生成侧边栏：
- `docs/ai/` — AI 平台指南（Claude、OpenAI、Gemini、Prompt 技巧）
- `docs/notes/` — 技术速查笔记（Python、Docker、Linux、Git、嵌入式）
- `docs/projects/` — 项目实战记录

每个内容 `.md` 文件应包含以下 frontmatter：
```yaml
---
title: 显示标题
description: 文章摘要（供搜索结果和 RecentPosts 组件使用）
date: YYYY-MM-DD
tags: [Tag1, Tag2]
order: 1          # 数字越小越靠前
---
```

侧边栏排序依据 `order` 字段（默认值 99）。`index.md` 被排除在侧边栏之外，作为各分区的首页。

### 主题扩展（`docs/.vitepress/theme/`）

`index.ts` 通过 VitePress 布局插槽注入三个自定义组件：
- `nav-bar-content-after` → `ThemePicker.vue` — 5 套配色主题，以 `data-theme` 写入 `<html>`，持久化到 `localStorage`
- `doc-before` → `ReadingTime.vue` — 预估阅读时间（字符数 ÷ 400），在 layout 页面上隐藏
- `home-features-after` → `RecentPosts.vue` — 仅在首页（`frontmatter.layout === 'home'`）展示最近 6 篇文章

`custom.css` 通过 CSS 变量（`--vp-c-brand-*`）驱动品牌色系，用 `[data-theme='green']` 等实现多主题覆盖，并通过 `@supports (animation-timeline: scroll())` 实现渐进增强的顶部阅读进度条。

### 构建期数据（`docs/data/posts.data.ts`）

`createContentLoader` 在构建时扫描 `ai/*.md`、`notes/*.md`、`projects/*.md`，筛选含 `date` 字段的页面，按日期降序排列后取前 6 条，导出为 `PostData[]`。`RecentPosts.vue` 在运行时导入该数据。新文章若未设置 `date` 字段，将不会出现在首页"最近更新"中。

### 在线工具（`docs/tools/`）

每个工具页面是一个 `.md` 文件，通过 `<script setup>` 引入并渲染 `docs/.vitepress/theme/tools/` 下的 Vue SFC：

| 页面 | 组件 | 核心 API |
|------|------|---------|
| `qrcode.md` | `QrCode.vue` | `qrcode` npm 包（Canvas + SVG 输出） |
| `hash.md` | `HashCalc.vue` | `crypto.subtle.digest` |
| `base64.md` | `Base64Tool.vue` | `FileReader`、`btoa/atob`、MIME 类型检测 |
| `json.md` | `JsonFormat.vue` | `JSON.parse/stringify`、键名排序 |
| `timestamp.md` | `TimestampTool.vue` | `Date`、自动识别秒/毫秒（`n > 1e12`） |
| `prompt.md` | `PromptBuilder.vue` | `localStorage` 存储自定义预设 |

新增工具的步骤：在 `theme/tools/` 创建 Vue 组件 → 在 `docs/tools/` 创建对应 `.md` 页面 → 在 `config.ts` 的"工具"下拉导航和 `/tools/` 侧边栏中各添加一条入口。

`/tools/` 侧边栏在 `config.ts` 中**手动维护**，与 `ai/notes/projects` 的自动生成方式不同。

### 博客管理后台（`docs/public/admin/index.html`）

一个无构建步骤的单文件 HTML 应用，作为静态资源部署。工作流程：
1. 用 AES-GCM + PBKDF2 加密 GitHub Personal Access Token，存入 `localStorage`
2. 通过 GitHub REST API（`/repos/{owner}/{repo}/contents/{path}`）列举、读取、写入文件
3. 工具栏输入框（`title`、`order`、`description`、`tags`、`date`）通过 `setFrontmatterField()` 函数修改 frontmatter
4. 基于当前文件 SHA 直接提交到 `main`（需要 SHA 以避免冲突）

后台绕过本地 git 树直接操作远端，因此本地与远端可能出现分叉，pre-push 钩子会自动处理这一情况。

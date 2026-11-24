# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run docs:dev      # 启动本地开发服务器（热重载）
npm run docs:build    # 构建到 docs/.vitepress/dist/
npm run docs:preview  # 本地预览生产构建结果
npm run new <section> <slug>  # 创建新文章
# 可用分区：ai | notes | projects | productivity
# 示例：npm run new notes fastapi
```

本项目是静态内容站，没有 lint 或测试命令。每次改完文档后运行 `npm run docs:build` 验证构建无报错即可。

## 部署方式

推送到 `main` → GitHub Actions（Node 22）构建 → 部署到 GitHub Pages（`www.keaneai.top`）。工作流使用 `fetch-depth: 0` 以确保 `lastUpdated` 时间戳正常工作。

另：`share.keaneai.top` 是独立运行在本地 WSL2 后台的 FastAPI 文件共享服务，通过 Cloudflare Named Tunnel 穿透，不在本静态站点构建范围内（仅在 `/tools/share` 提供入口说明）。

**重要同步规则：** 博客管理后台（Admin Panel）通过 GitHub REST API 直接提交到远端，不经过本地 git 树。每次本地推送前必须先 `git pull --rebase origin main`，否则会覆盖后台的修改。`.git/hooks/pre-push` 钩子会在每次推送前自动完成这一步。

## 架构说明

### 内容结构

四个主内容分区（侧边栏分组由 `docs/.vitepress/sidebar-groups.json` 手动配置并同步至 Admin Panel 管理）：
- `docs/ai/` — AI 平台指南（账号注册、Claude/OpenAI/Gemini/DeepSeek、AI CLI 部署、Agent 架构与 Prompt 方法论）
- `docs/notes/` — 技术速查笔记（Python、Docker、Linux、Git、嵌入式 C/FreeRTOS/RISC-V/蓝讯芯片）
- `docs/projects/` — 项目实战记录
- `docs/productivity/` — 生产力工具（ECS/VPS 节点部署、AI 网文/短剧、抖音橱窗、n8n 自动化）

其他页面与静态资源：
- `docs/tools/` — 浏览器端在线工具页与文件共享入口
- `docs/members/` — 学员专属路线图（不在导航/侧边栏暴露，通过 `noindex, nofollow` 避免搜索引擎收录）
- `docs/public/admin/index.html` — 纯前端单文件博客管理后台
- `docs/public/camp/index.html` — 静态落地页

每个内容 `.md` 文件应包含以下 frontmatter：
```yaml
---
title: 显示标题
description: 文章摘要（供搜索结果和 RecentPosts 组件使用）
date: YYYY-MM-DD
tags: [Tag1, Tag2]
order: 1          # 排序参考字段（侧边栏分组顺序以 sidebar-groups.json 为准）
---
```

**隐藏文章机制（`hidden: true`）：** `docs/.vitepress/config.ts` 中的 `collectHiddenFiles()` 会在构建期扫描所有带 `hidden: true` 的 `.md` 文件并加入 `srcExclude`，使 VitePress 彻底跳过这些文件（直接访问 URL 也会 404）。如果希望页面**不进导航/列表但允许通过直链访问**（如 `docs/members/index.md`），不要设置 `hidden: true`，改用 `meta robots: noindex, nofollow`。

新增文章后，需在 `docs/.vitepress/sidebar-groups.json` 对应分区的分组下添加条目（并视情况同步更新对应分区 `index.md`）。

### 主题扩展（`docs/.vitepress/theme/`）

`index.ts` 通过 VitePress 布局插槽注入四个自定义组件：
- `nav-bar-content-after` → `ThemePicker.vue` — 5 套配色主题，以 `data-theme` 写入 `<html>`，持久化到 `localStorage`
- `doc-before` → `ReadingTime.vue` — 预估阅读时间（字符数 ÷ 400），在 layout 页面上隐藏
- `home-features-after` → `RecentPosts.vue` — 仅在首页（`frontmatter.layout === 'home'`）展示最近 6 篇文章
- `layout-bottom` → `AdminEntry.vue` — 后台管理快捷入口

`custom.css` 通过 CSS 变量（`--vp-c-brand-*`）驱动品牌色系，用 `[data-theme='green']` 等实现多主题覆盖，并通过 `@supports (animation-timeline: scroll())` 实现渐进增强的顶部阅读进度条。

### 构建期数据（`docs/data/posts.data.ts`）

`createContentLoader` 在构建时扫描 `ai/*.md`、`notes/*.md`、`projects/*.md`、`productivity/*.md`，筛选含 `date` 字段且非 `index`/`home`/`hidden` 的页面，按日期降序排列后取前 6 条，导出为 `PostData[]`。`RecentPosts.vue` 在运行时导入该数据。新文章若未设置 `date` 字段，将不会出现在首页「最近更新」中。

### 在线工具（`docs/tools/`）

浏览器端工具页面通过 `<script setup>` 引入并渲染 `docs/.vitepress/theme/tools/` 下的 Vue SFC：

| 页面 | 组件 / 服务 | 核心实现 |
|------|------------|---------|
| `qrcode.md` | `QrCode.vue` | `qrcode` npm 包（Canvas + SVG 输出） |
| `hash.md` | `HashCalc.vue` | `crypto.subtle.digest` |
| `base64.md` | `Base64Tool.vue` | `FileReader`、`btoa/atob`、MIME 类型检测 |
| `json.md` | `JsonFormat.vue` | `JSON.parse/stringify`、键名排序 |
| `timestamp.md` | `TimestampTool.vue` | `Date`、自动识别秒/毫秒（`n > 1e12`） |
| `prompt.md` | `PromptBuilder.vue` | `localStorage` 存储自定义预设 |
| `novel-prompt.md` | `NovelPromptTool.vue` | 网文五步法 Prompt 模板生成器 |
| `share.md` | `share.keaneai.top` | 本地 WSL2 FastAPI + Cloudflare Tunnel 文件共享说明页 |

新增工具的步骤：在 `theme/tools/` 创建 Vue 组件 → 在 `docs/tools/` 创建对应 `.md` 页面 → 更新 `docs/tools/index.md` → 在 `docs/.vitepress/config.ts` 的「工具」下拉导航和 `/tools/` 侧边栏中各添加一条入口。

### 博客管理后台（`docs/public/admin/index.html`）

无构建步骤的单文件 HTML 应用，作为静态资源部署在 `/admin/`。工作流程：
1. 用 AES-GCM + PBKDF2（20 万次迭代）加密 GitHub Personal Access Token，存入 `localStorage`
2. 通过 GitHub REST API（`/repos/{owner}/{repo}/contents/{path}`）列举、读取、写入 4 个分区与 5 个概览页，以及管理 `docs/.vitepress/sidebar-groups.json` 分组
3. 工具栏输入框（`title`、`order`、`description`、`tags`、`date`、`hidden`）通过 frontmatter 操作函数读写元数据
4. 基于当前文件 SHA 直接提交到 `main`（需要 SHA 以避免冲突）

后台绕过本地 git 树直接操作远端，因此本地与远端可能出现分叉，`pre-push` 钩子会自动 `git pull --rebase origin main`。

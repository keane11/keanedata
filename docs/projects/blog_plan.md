---
title: keaneai.top 博客搭建方案
description: keaneai.top 博客架构说明：VitePress + GitHub Pages + GitHub Actions + Admin Panel 完整搭建方案
date: 2026-11-24
tags: [VitePress, 博客, 项目]
order: 4
---

# keaneai.top 个人博客搭建方案

> 状态：**已上线运行** — [www.keaneai.top](https://www.keaneai.top)  
> 更新日期：2026-11-24

---

## 架构概览

```
www.keaneai.top       →  GitHub Pages（VitePress 静态博客，免费）
share.keaneai.top     →  Cloudflare Named Tunnel → 本地 WSL2 FastAPI 文件共享服务
```

**总费用：零**（域名已有，GitHub Pages + GitHub Actions 免费，VitePress 免费）

---

## 技术选型

| 需求 | 方案 |
|------|------|
| 博客框架 | VitePress（Markdown 驱动，内置本地搜索、代码高亮、Sitemap） |
| 托管平台 | GitHub Pages（免费，支持自定义域名） |
| 自动部署 | GitHub Actions（push 到 `main` 分支自动构建发布，Node 22 LTS） |
| SSL 证书 | GitHub Pages 自动签发（免费） |
| 侧边栏分组 | `docs/.vitepress/sidebar-groups.json` 手动分组配置 |
| 后台管理 | 自建纯 HTML Admin Panel（`docs/public/admin/index.html`） |
| 内容管理 | GitHub REST API（通过 Admin Panel 直接读写仓库文件与侧边栏分组） |
| 隐私控制 | 构建期 `srcExclude` 彻底排除 `hidden: true` 文档 |

---

## 实际目录结构

```
keane-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml                  # GitHub Actions 自动部署（Node 22）
├── scripts/
│   └── new.mjs                         # npm run new <section> <slug> 新建文章脚本
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts                   # 站点配置（导航、侧边栏、hidden 排除、Sitemap）
│   │   ├── sidebar-groups.json         # 四大分区的侧边栏分组配置
│   │   └── theme/
│   │       ├── index.ts                # 自定义主题入口（插槽注入）
│   │       ├── custom.css              # 多主题配色变量 + 顶部阅读进度条
│   │       ├── ThemePicker.vue         # 5 套配色主题切换
│   │       ├── ReadingTime.vue         # 预估阅读时间
│   │       ├── RecentPosts.vue         # 首页最近 6 篇更新
│   │       ├── AdminEntry.vue          # 后台入口
│   │       └── tools/                  # 7 个浏览器端在线工具 Vue 组件
│   ├── data/
│   │   └── posts.data.ts               # 构建期文章索引加载器
│   ├── public/
│   │   ├── favicon.svg                 # 站点图标（SVG，蓝底白 K）
│   │   ├── admin/index.html            # 后台管理面板（单 HTML 文件）
│   │   └── camp/index.html             # 静态落地页
│   ├── index.md                        # 首页（VitePress home layout）
│   ├── ai/                             # AI 平台配置、CLI 部署、Agent 与 Prompt 方法论
│   │   ├── index.md
│   │   ├── ai-account-prerequisites.md # VPN · 接码 · 虚拟卡 · 礼品卡
│   │   ├── google-account-register.md  # Google 账号注册
│   │   ├── chatgpt-claude-gemini-register.md
│   │   ├── claude.md                   # Claude + Claude Code CLI
│   │   ├── openai.md                   # OpenAI + Codex CLI
│   │   ├── gemini.md                   # Gemini + Antigravity CLI（原 Gemini CLI）
│   │   ├── ai-coding-tools-compare.md  # AI 编程工具横评
│   │   ├── wsl_ai_cli_教程.md           # WSL 安装 AI CLI 工具
│   │   ├── cc_switch_*.md              # CC Switch 切换国产模型
│   │   ├── deepseek-tui-wsl.md         # CodeWhale / DeepSeek TUI 安装
│   │   ├── prompt.md                   # 提示词工程
│   │   ├── hermes.md                   # Hermes Agent 配置
│   │   ├── HARNESS_WorkFlow.md         # Harness Engineering 工作流
│   │   └── agent_architecture.md       # 产品选型 Agent 架构指南
│   ├── notes/                          # 编程与嵌入式速查笔记
│   │   ├── index.md
│   │   ├── python.md / docker.md / linux.md / git.md
│   │   ├── c_embedded.md / freertos.md / riscv.md
│   │   ├── cjson_porting_guide.md
│   │   └── bluetrum_chip_db.md         # 中科蓝讯芯片数据库
│   ├── productivity/                   # 生产力与副业实战
│   │   ├── index.md
│   │   ├── ecs-server.md               # 阿里云 ECS 搭建
│   │   ├── KVM-VPS-部署完整流程.md      # KVM VPS + 3X-UI 多用户节点
│   │   ├── ai-novel.md                 # AI 写中文网文
│   │   ├── ai-video.md                 # AI 短剧 / 视频生成
│   │   ├── douyin-showcase.md          # 抖音切片上架橱窗
│   │   └── tools-automation.md         # n8n / 副业自动化工具
│   ├── projects/                       # 项目实战记录
│   │   ├── index.md
│   │   ├── qr_file_design.md           # QR 共享文件夹设计方案
│   │   ├── bsp_i2c_slave_porting_guide.md
│   │   └── blog_plan.md                # 本文档
│   ├── tools/                          # 在线工具箱（7 个前端工具 + share 说明页）
│   └── members/                        # 学员路线图（noindex，直链访问）
├── package.json
└── package-lock.json
```

---

## 站点配置 config.ts（核心结构）

```ts
import { defineConfig } from 'vitepress'
import { readFileSync } from 'node:fs'

const sg = JSON.parse(readFileSync('docs/.vitepress/sidebar-groups.json', 'utf-8'))

export default defineConfig({
  title: 'Keane 的折腾手记',
  description: 'AI 工具 · 服务器实战 · 效率工具 · 内容变现',
  lang: 'zh-CN',
  lastUpdated: true,
  srcExclude: collectHiddenFiles(), // 构建期排除所有 hidden: true 的文档

  sitemap: {
    hostname: 'https://www.keaneai.top',
  },

  themeConfig: {
    logo: '/favicon.svg',

    nav: [
      { text: '首页',       link: '/' },
      { text: 'AI 平台',    link: '/ai/' },
      { text: '编程笔记',   link: '/notes/' },
      { text: '项目实战',   link: '/projects/' },
      { text: '生产力工具', link: '/productivity/' },
      { text: '工具',       link: '/tools/', items: [/* 7 个在线工具 + 文件共享 */] },
    ],

    sidebar: {
      '/ai/':           sg.ai,
      '/notes/':        sg.notes,
      '/projects/':     sg.projects,
      '/productivity/': sg.productivity,
      '/tools/':        [/* 开发工具 / AI 辅助 / 服务 */],
    },

    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/keane11' }],
    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2026 Keane',
    },
  },
})
```

四个内容分区的侧边栏分组由 `docs/.vitepress/sidebar-groups.json` 统一维护，并可在 Admin Panel 中可视化调整。

---

## GitHub Actions 自动部署

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy Blog

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run docs:build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

push 到 `main` 分支后，Actions 自动构建并部署，约 2–3 分钟生效。

---

## 后台管理面板

访问地址：`https://www.keaneai.top/admin/`

单文件纯前端实现（`docs/public/admin/index.html`），通过 GitHub REST API 读写仓库文件，无需额外后端服务。

### 功能列表

| 功能 | 说明 |
|------|------|
| 文章列表 | 管理 AI 平台 / 编程笔记 / 项目实战 / 生产力工具四个分区的所有 Markdown 文件 |
| 侧边栏分组管理 | 直接读写 `docs/.vitepress/sidebar-groups.json` 调整分组与展示顺序 |
| 页面配置 | 编辑首页及各分区概览页源码 |
| 元数据编辑 | 修改 frontmatter 的 `title`、`order`、`description`、`tags`、`date`、`hidden` |
| 隐藏控制 | 一键设置 `hidden: true`（构建期排除出站，彻底隐藏） |
| 分区调整 | 一键把文章从一个分区移动到另一个分区 |
| 文章上传与删除 | 支持拖拽上传本地 `.md` 文件，删除时自动同步索引 |
| Markdown 预览 | 实时渲染预览，内置代码高亮 |

### 认证方式

Admin Panel 使用 AES-GCM + PBKDF2 加密 GitHub Token，Token 密文存入 `localStorage`。每次打开面板需要输入本地解密密码（不是 GitHub 密码），解密后的 Token 用于调用 GitHub API。

```
GitHub Token → AES-GCM 加密（本地密码派生密钥）→ localStorage
打开面板 → 输入本地密码 → 解密 Token → 调用 GitHub API
```

GitHub Token 配置：
- 权限：仓库 **Contents（读写）**
- 有效期：按需，建议 90 天
- 存储：仅在本地 `localStorage`，不上传到任何服务器

---

## DNS 配置

登录阿里云控制台 → 域名 → 解析设置：

| 记录类型 | 主机记录 | 记录值 | 说明 |
|---------|---------|--------|------|
| CNAME | www | `keane11.github.io` | 博客 |
| A | @ | `185.199.108.153` | 根域名跳转 |
| A | @ | `185.199.109.153` | |
| A | @ | `185.199.110.153` | |
| A | @ | `185.199.111.153` | |

> `share.keaneai.top` 的 CNAME 走 Cloudflare Named Tunnel，指向本地 WSL2 后台运行的 FastAPI 文件共享服务，与静态博客独立、互不影响。

---

## Git 同步与自动推送

Admin Panel 通过 GitHub API 直接提交到远端 `main`，不经过本地 git 树。本地仓库在 `.git/hooks/pre-push` 中配置了自动 rebase 钩子，防止覆盖后台修改：

```bash
# 本地开发推送前先同步远端（pre-push 钩子也会自动执行）
git pull --rebase origin main && git push origin main
```

---

## 后续扩展方向

| 功能 | 方案 | 成本 |
|------|------|------|
| 评论系统 | giscus（基于 GitHub Discussions） | 免费 |
| 图片存储 | 阿里云 OSS / Cloudflare R2 | 免费或极低 |
| 访问统计 | Umami（自托管）或 Cloudflare Analytics | 免费 |
| 全文搜索 | VitePress 内置 local search（已启用） | 免费 |
| 嵌入式工具 | 增加在线寄存器/引脚计算与电路图查看器 | 视方案而定 |

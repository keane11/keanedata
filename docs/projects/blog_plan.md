---
title: keaneai个人博客搭建方案
---

# keaneai.top 个人博客搭建方案

> 状态：**已上线运行** — [www.keaneai.top](https://www.keaneai.top)  
> 更新日期：2026-05-13

---

## 架构概览

```
www.keaneai.top       →  GitHub Pages（VitePress 静态博客，免费）
share.keaneai.top     →  Cloudflare Named Tunnel → FastAPI 文件共享
```

**总费用：零**（域名已有，GitHub Pages + GitHub Actions 免费，VitePress 免费）

---

## 技术选型

| 需求 | 方案 |
|------|------|
| 博客框架 | VitePress（Markdown 驱动，内置搜索/代码高亮） |
| 托管平台 | GitHub Pages（免费，支持自定义域名） |
| 自动部署 | GitHub Actions（push 到 main 分支自动构建发布） |
| SSL 证书 | GitHub Pages 自动签发（免费） |
| 后台管理 | 自建纯 HTML Admin Panel（`/public/admin/index.html`） |
| 内容管理 | GitHub REST API（通过 Admin Panel 直接推送 Markdown） |

---

## 实际目录结构

```
keane-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions 自动部署
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts               # 站点配置（导航、侧边栏、favicon）
│   │   └── theme/
│   │       └── index.ts            # 自定义主题入口（引入 ElementPlus）
│   ├── public/
│   │   ├── favicon.svg             # 站点图标（SVG，蓝底白 K）
│   │   └── admin/
│   │       └── index.html          # 后台管理面板（单 HTML 文件）
│   ├── index.md                    # 首页（VitePress home layout）
│   ├── ai/
│   │   ├── index.md                # AI 平台概览
│   │   ├── claude.md               # Claude 使用指南 + Claude Code CLI
│   │   ├── openai.md               # OpenAI 使用指南 + Codex CLI
│   │   ├── gemini.md               # Gemini 使用指南 + Gemini CLI
│   │   ├── prompt.md               # 提示词工程
│   │   ├── hermes.md               # Hermes Agent 配置
│   │   ├── wsl_ai_cli_教程.md       # WSL 安装 AI CLI 工具
│   │   └── cc_switch_*.md          # Claude Code 切换国产模型
│   ├── notes/
│   │   ├── index.md                # 编程笔记概览
│   │   ├── python.md
│   │   ├── docker.md
│   │   ├── linux.md
│   │   ├── git.md
│   │   ├── c_embedded.md           # C 语言嵌入式开发
│   │   ├── freertos.md             # FreeRTOS
│   │   ├── riscv.md                # RISC-V 开发
│   │   └── bluetrum_chip_db.md     # 中科蓝讯芯片数据库
│   └── projects/
│       ├── index.md                # 项目实战概览
│       ├── qr-file-share.md        # QR 文件共享项目介绍
│       ├── qr_file_design.md       # QR 文件共享设计文档
│       ├── bsp_i2c_slave_porting_guide.md  # BSP I2C Slave 移植
│       └── blog_plan.md            # 本文档
├── package.json
└── package-lock.json
```

---

## 站点配置 config.ts

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Keane 的技术笔记',
  description: 'AI 平台配置 · 编程笔记 · 项目实战',
  lang: 'zh-CN',

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  ],

  themeConfig: {
    logo: '/favicon.svg',

    nav: [
      { text: '首页',       link: '/' },
      { text: 'AI 平台',    link: '/ai/' },
      { text: '编程笔记',   link: '/notes/' },
      { text: '项目实战',   link: '/projects/' },
      { text: '📁 文件共享', link: 'https://share.keaneai.top', target: '_blank' },
    ],

    sidebar: {
      '/ai/': [...],       // 自动生成，见下方说明
      '/notes/': [...],
      '/projects/': [...],
    },

    search: { provider: 'local' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/keane11' },
    ],

    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2026 Keane',
    },

    outline: { label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
  },
})
```

侧边栏通过 `order` 字段排序，由 Admin Panel 管理，详见后台管理章节。

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
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
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

push 到 main 分支后，Actions 自动构建并部署，约 2-3 分钟生效。

---

## 后台管理面板

访问地址：`https://www.keaneai.top/admin/`

单文件纯前端实现（`docs/public/admin/index.html`），通过 GitHub REST API 读写仓库文件，无需额外后端服务。

### 功能列表

| 功能 | 说明 |
|------|------|
| 文章列表 | 显示 AI/笔记/项目三个分区的所有 Markdown 文件 |
| 页面配置 | 编辑首页/各概览页的源码 |
| 标题编辑 | 修改文章 frontmatter 的 `title` 字段 |
| 排序管理 | 通过 `order` 字段控制侧边栏排列顺序 |
| 分区调整 | 一键把文章从一个分区移动到另一个分区 |
| 文章删除 | 删除文件并同步从 index.md 中移除条目 |
| 上传文件 | 新建文章（支持直接上传 .md 文件） |
| 索引同步 | 新增/删除/移动文章时自动更新对应 index.md |
| Markdown 预览 | 实时渲染预览，内置代码高亮 |

### 认证方式

Admin Panel 使用 AES-GCM + PBKDF2 加密 GitHub Token，Token 密文存入 `localStorage`。每次打开面板需要输入一个本地解密密码（不是 GitHub 密码），解密后的 Token 用于调用 GitHub API。

```
GitHub Token → AES-GCM 加密（本地密码派生密钥）→ localStorage
打开面板 → 输入本地密码 → 解密 Token → 调用 GitHub API
```

GitHub Token 配置：
- 权限：仓库 **Contents（读写）**
- 有效期：按需，建议 90 天
- 存储：仅在本地 localStorage，不上传到任何服务器

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

> `share.keaneai.top` 的 CNAME 走 Cloudflare Tunnel，与博客独立，互不影响。

---

## Git 自动推送配置

Admin Panel 通过 GitHub API 直接推送文件（无需本地 git）。本地开发时配置了 Token 在 Remote URL 中实现免密推送：

```bash
# 配置方式（Token 仅存在 .git/config，不提交到仓库）
git remote set-url origin https://<token>@github.com/keane11/keanedata.git

# 每次 commit 后直接 push，无需手动输入密码
git push origin main

# 如果远端有变更需先 rebase
git pull --rebase origin main && git push origin main
```

---

## 后续扩展方向

| 功能 | 方案 | 成本 |
|------|------|------|
| 评论系统 | giscus（基于 GitHub Discussions） | 免费 |
| 图片存储 | 阿里云 OSS | ~¥0.12/GB/月 |
| 访问统计 | umami（自托管）或 Cloudflare Analytics | 免费 |
| 全文搜索 | VitePress 内置 local search（现已启用）| 免费 |
| 嵌入式工具 | 增加在线代码运行、电路图渲染 | 视方案而定 |

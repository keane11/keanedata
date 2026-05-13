# keaneai.top 个人博客搭建方案

## 架构概览

```
www.keaneai.top       →  GitHub Pages（VitePress 博客，免费）
share.keaneai.top     →  Cloudflare Tunnel → FastAPI 文件共享（现有，保持不变）
```

**总费用：零**（域名已有，GitHub Pages 免费，VitePress 免费）

---

## 技术选型：VitePress + GitHub Pages

| 需求 | 方案 |
|------|------|
| 博客框架 | VitePress（Markdown 驱动，内置搜索/代码高亮） |
| 托管平台 | GitHub Pages（免费，支持自定义域名） |
| 自动部署 | GitHub Actions（push 到 main 分支自动构建） |
| SSL 证书 | GitHub Pages 自动签发（免费） |
| 文件共享 | 现有 share.keaneai.top 保持不变 |

---

## 目录结构

```
keaneai-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml          # 自动部署配置
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts           # 站点配置（导航、侧边栏）
│   │   └── theme/              # 自定义主题（可选）
│   ├── public/
│   │   └── favicon.ico
│   ├── index.md                # 首页
│   ├── ai/
│   │   ├── index.md            # AI 平台目录
│   │   ├── claude.md           # Claude 配置文档
│   │   ├── openai.md
│   │   └── ...
│   ├── notes/
│   │   ├── index.md            # 编程笔记目录
│   │   ├── python.md
│   │   ├── docker.md
│   │   └── ...
│   └── projects/
│       ├── index.md            # 项目实战目录
│       ├── qr-file-share.md    # 本项目文档
│       └── ...
└── package.json
```

---

## 第一步：本地初始化项目

```bash
# 新建项目目录
mkdir keaneai-blog && cd keaneai-blog

# 初始化 npm
npm init -y

# 安装 VitePress
npm install -D vitepress

# 初始化 VitePress（交互式）
npx vitepress init
```

初始化时的选项：
- Where should VitePress initialize the config? → `./docs`
- Site title → `Keane 的技术笔记`
- Site description → `AI配置 · 编程笔记 · 项目实战`
- Theme → `Default Theme`
- Use TypeScript → Yes

在 `package.json` 中加入脚本：

```json
{
  "scripts": {
    "docs:dev":   "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

本地预览：

```bash
npm run docs:dev
# 访问 http://localhost:5173
```

---

## 第二步：站点配置

**`docs/.vitepress/config.ts`**

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Keane 的技术笔记',
  description: 'AI 平台配置 · 编程笔记 · 项目实战',
  lang: 'zh-CN',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/favicon.ico',

    nav: [
      { text: '首页',     link: '/' },
      { text: 'AI 平台',  link: '/ai/' },
      { text: '编程笔记', link: '/notes/' },
      { text: '项目实战', link: '/projects/' },
      { text: '📁 文件共享', link: 'https://share.keaneai.top', target: '_blank' },
    ],

    sidebar: {
      '/ai/': [
        {
          text: 'AI 平台',
          items: [
            { text: '概览',   link: '/ai/' },
            { text: 'Claude', link: '/ai/claude' },
            { text: 'OpenAI', link: '/ai/openai' },
          ],
        },
      ],
      '/notes/': [
        {
          text: '编程笔记',
          items: [
            { text: '概览',   link: '/notes/' },
            { text: 'Python', link: '/notes/python' },
            { text: 'Docker', link: '/notes/docker' },
          ],
        },
      ],
      '/projects/': [
        {
          text: '项目实战',
          items: [
            { text: '概览',          link: '/projects/' },
            { text: 'QR 文件共享',   link: '/projects/qr-file-share' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/你的用户名' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2024 Keane',
    },

    outline: {
      label: '本页目录',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})
```

---

## 第三步：首页配置

**`docs/index.md`**

```markdown
---
layout: home

hero:
  name: "Keane 的技术笔记"
  text: "记录，是最好的沉淀"
  tagline: AI 平台配置 · 编程笔记 · 项目实战
  actions:
    - theme: brand
      text: 开始阅读
      link: /ai/
    - theme: alt
      text: 文件共享
      link: https://share.keaneai.top

features:
  - icon: 🤖
    title: AI 平台配置
    details: Claude、OpenAI 等 AI 平台的配置教程和使用技巧

  - icon: 📝
    title: 编程笔记
    details: Python、Docker、Linux 等日常开发笔记

  - icon: 🚀
    title: 项目实战
    details: 从零搭建的项目记录，包含完整的思路和踩坑经验

  - icon: 📁
    title: 文件共享
    details: 基于 QR 码的文件共享工具，扫码即达
    link: https://share.keaneai.top
    linkText: 立即使用
---
```

---

## 第四步：GitHub Actions 自动部署

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
          fetch-depth: 0  # 获取完整 git 历史（用于文章更新时间）

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

---

## 第五步：GitHub 仓库配置

1. 在 GitHub 创建新仓库，例如 `keaneai-blog`（可设为 Private）
2. 推送代码：
   ```bash
   git init
   git add .
   git commit -m "init blog"
   git remote add origin https://github.com/你的用户名/keaneai-blog.git
   git push -u origin main
   ```
3. 进入仓库 **Settings → Pages**：
   - Source 选 **GitHub Actions**
   - Custom domain 填入 `www.keaneai.top`
   - 勾选 **Enforce HTTPS**

---

## 第六步：阿里云 DNS 配置

登录阿里云控制台 → 域名 → 解析设置，添加以下记录：

| 记录类型 | 主机记录 | 记录值                     | 说明 |
|---------|---------|---------------------------|------|
| CNAME   | www     | `你的用户名.github.io`      | 博客 |
| A       | @       | `185.199.108.153`          | 根域名重定向 |
| A       | @       | `185.199.109.153`          | （同上，多填几个增加可用性） |
| A       | @       | `185.199.110.153`          | |
| A       | @       | `185.199.111.153`          | |

> `share.keaneai.top` 的 CNAME 记录不动，文件共享继续走 Cloudflare Tunnel。

---

## 第七步：写第一篇文章

**`docs/projects/qr-file-share.md`**

```markdown
# QR 文件共享项目

> 在线体验：[share.keaneai.top](https://share.keaneai.top)

## 项目简介

基于 FastAPI + SQLite 的轻量文件共享工具，生成二维码，扫码即可上传/下载文件。

## 技术栈

- 后端：FastAPI + SQLite + bcrypt
- 前端：Jinja2 SSR + 原生 JS
- 部署：WSL2 + Cloudflare Named Tunnel

...
```

---

## 后续扩展

| 功能 | 方案 | 成本 |
|------|------|------|
| 评论系统 | [giscus](https://giscus.app)（基于 GitHub Discussions） | 免费 |
| 图片存储 | 阿里云 OSS（图床） | ~¥0.12/GB/月 |
| 统计分析 | [umami](https://umami.is) 或 Google Analytics | 免费 |
| 升级为动态站 | 购买阿里云轻量服务器，迁移到 Nginx + FastAPI | ~¥50-80/月 |

---

## 快速检查清单

- [ ] Node.js 已安装（`node -v` 检查，建议 v18+）
- [ ] GitHub 账号已创建
- [ ] 本地 `npm run docs:dev` 预览正常
- [ ] GitHub Actions 部署成功（仓库 Actions 页面查看）
- [ ] 阿里云 DNS 记录已添加
- [ ] `www.keaneai.top` 可正常访问
- [ ] HTTPS 已启用

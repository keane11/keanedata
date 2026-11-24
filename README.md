# Keane 的折腾手记

个人技术博客与在线工具站，基于 **VitePress + GitHub Pages** 构建。

- 在线访问：[www.keaneai.top](https://www.keaneai.top)
- 文件共享：[share.keaneai.top](https://share.keaneai.top)（本地 WSL2 + Cloudflare Tunnel 独立服务）

## 目录结构

- `docs/ai/` — AI 平台注册订阅、CLI 工具部署与 Agent / Prompt 方法论
- `docs/notes/` — Python、Docker、Linux、Git 与嵌入式（C / FreeRTOS / RISC-V / 蓝讯芯片）速查笔记
- `docs/productivity/` — ECS / KVM VPS 部署、AI 内容创作与 n8n 自动化实战
- `docs/projects/` — 个人项目实战与架构设计文档
- `docs/tools/` — 浏览器端离线小工具（QR 码、Hash、Base64、JSON、时间戳、Prompt / 网文生成器等）
- `docs/public/admin/` — 纯前端 GitHub API 博客管理后台

## 本地开发

```bash
npm install
npm run docs:dev          # 启动本地开发服务器
npm run docs:build        # 构建静态产物到 docs/.vitepress/dist/
npm run docs:preview      # 本地预览生产构建结果
npm run new <section> <slug>  # 创建新文章（ai | notes | projects | productivity）
```

> 推送到 `main` 分支将通过 GitHub Actions 自动部署到 GitHub Pages。推送前请先执行 `git pull --rebase origin main` 以同步后台管理面板的远端提交。

---
title: 文件共享工具
description: 基于 QR 码的文件共享服务，支持三级权限管控、密码保护和自动过期，一键生成分享链接
date: 2026-05-13
---

# 文件共享工具

> 在线访问：[share.keaneai.top](https://share.keaneai.top){target="_blank"}

一个自建的轻量文件共享服务，扫码即可访问，无需账号注册。

## 功能特性

| 功能 | 说明 |
|------|------|
| QR 码生成 | 每个分享自动生成二维码，手机扫描即可下载 |
| 三级权限 | 只读（浏览）/ 上传者（可传文件）/ 完全控制（管理） |
| 密码保护 | 可选为分享设置访问密码 |
| 自动过期 | 设置过期时间，到期自动失效，无需手动清理 |
| 批量上传 | 支持一次拖拽上传多个文件 |
| 文件预览 | 图片、文本、PDF 在线预览 |

## 使用流程

1. 访问 [share.keaneai.top](https://share.keaneai.top){target="_blank"}
2. 使用管理员账号登录（私有服务，需要邀请）
3. 点击"新建分享"，填写名称、选择权限和过期时间
4. 上传文件，复制链接或扫描二维码分享给对方
5. 接收方打开链接即可下载，无需登录

## 权限说明

```
只读（Readonly）   — 可以浏览和下载文件
上传者（Uploader） — 可以浏览、下载，还可以上传新文件
完全控制（Full）   — 可以浏览、上传、删除文件，管理分享设置
```

## 技术架构

```
share.keaneai.top
  └── Cloudflare Named Tunnel（HTTPS 终止 + 边缘缓存）
        └── WSL2 Ubuntu（本地服务器，7×24 小时运行）
              └── FastAPI + SQLite（Python 后端）
```

- **后端**：FastAPI，SQLite 存储元数据，本地磁盘存储文件
- **部署**：WSL2 环境运行，Cloudflare Tunnel 穿透到公网，无需公网 IP
- **安全**：CSRF 双提交 Cookie 防护，itsdangerous 签名令牌，密码哈希存储

## 相关文档

- [QR 文件共享项目介绍](/projects/qr-file-share) — 项目功能与部署说明
- [QR 共享文件夹设计方案](/projects/qr_file_design) — 详细技术设计文档

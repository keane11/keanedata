---
title: QR 文件共享项目
description: 基于 FastAPI + SQLite 的 QR 码文件共享工具，三级权限、密码保护、自动过期、Cloudflare 隧道部署
date: 2026-05-13
tags: [FastAPI, 项目, Python]
order: 1
---

# QR 文件共享项目

> 在线体验：[share.keaneai.top](https://share.keaneai.top)

## 项目简介

基于 FastAPI + SQLite 的轻量文件共享工具，生成二维码，扫码即可上传/下载文件。无需注册，生成房间码即可使用。

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | FastAPI + SQLite + bcrypt |
| 前端 | Jinja2 SSR + 原生 JS |
| 部署 | WSL2 + Cloudflare Named Tunnel |

## 核心功能

- 创建房间，生成专属 QR 码
- 扫码后直接上传/下载文件
- 可选密码保护
- 文件自动过期清理

## 部署架构

```
用户手机扫码
    ↓
Cloudflare（CDN + SSL）
    ↓
Cloudflare Named Tunnel
    ↓
WSL2 本机 FastAPI 服务
    ↓
SQLite + 本地文件存储
```

## 踩坑记录

### WSL2 网络问题

WSL2 每次重启 IP 会变，Cloudflare Tunnel 直接连服务名（`localhost`）即可，无需写死 IP。

### 大文件上传超时

Cloudflare 免费版有 100MB 单次请求限制，超出会返回 524。解决方案：前端分片上传，后端合并。

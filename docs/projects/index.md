---
title: index
---

# 项目实战概览

从零搭建的项目记录，包含完整的设计思路、技术选型、源码拆解和踩坑经验。

## Web 与效率系统

- [keaneai.top 个人博客搭建方案](./blog_plan) — VitePress + GitHub Pages + Admin Panel 完整部署方案
- [QR 共享文件夹设计方案](./qr_file_design) — UI 交互、目录结构与接口设计文档
- [轻量级研发项目管理系统实战（PMSys）](./lightweight_pmsys_practice) — FastAPI + SQLite + 零构建 Vue 3 SPA + DeepSeek 周报助手全栈实践

## 嵌入式与硬核工具

- [BSP I2C Slave 移植手册](./bsp_i2c_slave_porting_guide) — GPIO 模拟 I2C 从机驱动，含完整源码与 AB896X 接入指南
- [纯 C 零依赖音频波形/频谱编辑器（PCMPlayer）](./pcm_audio_editor) — 单文件 ~1180 行纯 C + Win32 GDI + Media Foundation 实现 Audition 风格音频工具
- [Windows 私有 SCSI 固件升级协议静态逆向实战](./usb_scsi_upgrade_protocol_analysis) — 基于 `IOCTL_SCSI_PASS_THROUGH_DIRECT` 的传输协议静态取证与可靠性审计

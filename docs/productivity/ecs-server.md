---
title: ECS 云服务器搭建及公网 IP 配置
description: 阿里云 ECS 实例购买、安全组配置、公网 IP 绑定、域名解析到 Nginx 反向代理的完整实战教程。
date: 2026-05-18
tags: [ECS, 云服务器, 运维, Nginx]
order: 1
---

# ECS 云服务器搭建及公网 IP 配置

> 简介：从零开始在阿里云购买 ECS、绑定弹性公网 IP、配置 Nginx 反向代理，适合需要自建服务、部署 Bot 或搭建个人站点的场景。

## 为什么需要自己的服务器

| 场景 | 说明 |
|------|------|
| 部署 AI Bot / API 服务 | 24 小时稳定运行，外网可访问 |
| 反向代理 / 内网穿透 | 替代 Cloudflare Tunnel，延迟更低 |
| 个人网站 / 博客托管 | 完全自主，不受平台限制 |
| 数据中转 / 爬虫任务 | 独立 IP，不影响本地网络 |

## 选择云服务商

| 厂商 | 优势 | 入门价格参考 |
|------|------|------------|
| 阿里云 ECS | 国内生态最成熟，工单响应快 | ¥99/年（2核2G，新用户） |
| 腾讯云 CVM | 与微信/企微生态结合好 | ¥99/年（新用户） |
| 华为云 ECS | 政企客户多，稳定性强 | ¥88/年（新用户） |
| AWS EC2 | 全球节点，国际业务首选 | 按需 ~$0.012/小时（t3.micro） |

> 新用户通常有大幅折扣，建议先用 1 年轻量套餐验证需求再升配。

## 购买 ECS 实例（以阿里云为例）

### 1. 选择规格

进入阿里云控制台 → **云服务器 ECS** → **创建实例**：

- **地域**：选华东（上海）或华北（北京），延迟低
- **规格**：入门推荐 `ecs.t6-c1m2.large`（2 vCPU / 2 GiB）
- **镜像**：Ubuntu 22.04 LTS（推荐）或 CentOS 7
- **系统盘**：40 GiB 高效云盘足够入门
- **带宽**：按固定带宽 1 Mbps 即可（后续可升）

### 2. 设置登录凭证

推荐使用 **密钥对** 而非密码登录：

```bash
# 本地生成密钥对（已有可跳过）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 查看公钥，复制到阿里云控制台
cat ~/.ssh/id_ed25519.pub
```

在创建实例页面选择"导入已有密钥对"，粘贴公钥内容。

### 3. 配置安全组

安全组相当于云端防火墙，**默认只开放 22（SSH）**，根据用途手动添加入方向规则：

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH 远程登录 |
| 80 | TCP | HTTP 网站访问 |
| 443 | TCP | HTTPS 加密访问 |
| 8080 | TCP | 应用服务（按需） |
| 3306 | TCP | MySQL（仅限内网 IP） |

> 不要对外开放数据库端口（3306/5432），仅允许服务器内网 IP（`172.xx.xx.xx/24`）访问。

## 绑定公网 IP（弹性公网 IP）

实例创建后默认分配一个公网 IP，但关机后可能变化。推荐使用**弹性公网 IP（EIP）**：

```
控制台 → 弹性公网IP → 申请EIP → 绑定到实例
```

EIP 按量计费约 **¥0.02/小时 + 流量费**，若长期使用建议转为包年包月。

绑定后，该 IP 即使重启也不会变化，可用于域名解析。

## SSH 登录服务器

```bash
# 首次登录，默认用户名 root（Ubuntu）或 ecs-user（部分镜像）
ssh -i ~/.ssh/id_ed25519 root@<你的公网IP>

# 建议立即创建非 root 用户
adduser keane
usermod -aG sudo keane

# 复制 SSH 公钥到新用户
mkdir -p /home/keane/.ssh
cp ~/.ssh/authorized_keys /home/keane/.ssh/
chown -R keane:keane /home/keane/.ssh
```

## 基础环境配置

### 更新系统

```bash
apt update && apt upgrade -y
apt install -y curl wget git vim ufw
```

### 配置 UFW 防火墙

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 安装 Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
# 测试：浏览器访问 http://<公网IP>，看到 Nginx 欢迎页即成功
```

## 域名解析

在域名注册商（阿里云、Cloudflare 等）添加 DNS 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | @ | `<公网IP>` |
| A | www | `<公网IP>` |
| A | api | `<公网IP>`（子域名按需添加） |

DNS 生效通常需要 5–30 分钟，可用 `nslookup yourdomain.com` 验证。

## Nginx 反向代理 + SSL

### 申请免费 SSL 证书

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
# 按提示输入邮箱，同意条款，自动配置 HTTPS 并续期
```

### 反向代理配置示例

将域名流量转发到本地 8080 端口的应用：

```nginx
# /etc/nginx/sites-available/myapp
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # certbot 自动添加的 SSL 配置
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 常见用途速查

| 用途 | 推荐工具 | 关键命令 |
|------|---------|---------|
| 运行 Python 服务 | `uvicorn` / `gunicorn` | `uvicorn main:app --host 0.0.0.0 --port 8080` |
| 进程守护 | `systemd` / `pm2` | `systemctl enable myapp` |
| Docker 部署 | Docker + Compose | `docker compose up -d` |
| 内网穿透备选 | Cloudflare Tunnel | `cloudflared tunnel run` |
| 监控告警 | `htop` + `netdata` | `apt install netdata` |

---
title: ECS 云服务器搭建及公网 IP 配置
description: 阿里云 ECS 实例购买、安全组配置、公网 IP 绑定、域名解析到 Nginx 反向代理的完整实战教程。
date: 2026-05-18
tags: [ECS, 云服务器, 运维, Nginx]
order: 1
---

# ECS 云服务器搭建及公网 IP 配置

> 简介：从零开始在阿里云购买 ECS、绑定弹性公网 IP、配置 Nginx 反向代理，适合需要自建服务、部署 Bot 或搭建个人站点的场景。

---

## 1. 方案对比：轻量服务器 vs ECS

很多人上来就买 ECS，其实轻量服务器（轻量应用服务器）对个人用户更合适。

| 对比维度 | 轻量应用服务器 | ECS |
|---------|-------------|-----|
| 入门价格 | ¥99/年（2核2G 5M带宽） | ¥360+/年（相同配置） |
| 带宽模式 | 固定带宽（5M不限流量） | 按带宽/流量计费 |
| 控制台 | 简化，适合新手 | 完整，功能多 |
| 弹性扩容 | 不支持在线升配 | 支持 |
| 适合场景 | 个人站点/Bot/小工具/n8n | 生产级服务/多子系统/高并发 |
| 备案支持 | 支持 | 支持 |

**选型建议**：
- 刚起步、预算有限 → **轻量服务器**（¥99/年，够用 80% 场景）
- 跑 Docker 多服务、需要按需扩容 → **ECS**（入门 `ecs.t6-c1m2.large`）
- 追求低成本试错 → 先买轻量，后期数据迁移到 ECS 不超过 2 小时

---

## 2. 为什么需要自己的服务器

| 场景 | 说明 |
|------|------|
| 部署 AI Bot / API 服务 | 24 小时稳定运行，外网可访问 |
| 反向代理 / 内网穿透 | 替代 Cloudflare Tunnel，延迟更低 |
| 个人网站 / 博客托管 | 完全自主，不受平台限制 |
| 数据中转 / 爬虫任务 | 独立 IP，不影响本地网络 |

## 3. 选择云服务商

| 厂商 | 优势 | 入门价格参考 |
|------|------|------------|
| 阿里云 ECS | 国内生态最成熟，工单响应快 | ¥99/年（2核2G，新用户） |
| 腾讯云 CVM | 与微信/企微生态结合好 | ¥99/年（新用户） |
| 华为云 ECS | 政企客户多，稳定性强 | ¥88/年（新用户） |
| AWS EC2 | 全球节点，国际业务首选 | 按需 ~$0.012/小时（t3.micro） |

> 新用户通常有大幅折扣，建议先用 1 年轻量套餐验证需求再升配。

---

## 4. 国内备案要求

**核心规则**：国内服务器（北京、上海、广东等大陆节点）**开放 80/443 端口必须备案**，否则端口被封。

| 情况 | 备案要求 | 耗时 |
|------|---------|------|
| 大陆节点（阿里云/腾讯云）提供 HTTP/S 服务 | **必须备案** | 15–30 天 |
| 香港/澳门节点 | 无需备案（但延迟略高） | 即时可用 |
| 海外节点（新加坡/美国） | 无需备案 | 即时可用 |
| 大陆节点仅跑后端 API（不对外 80/443） | 可暂时不备案，用非标端口 | — |

**备案所需材料**（阿里云 ICP 备案）：

```
1. 网站主办者证件（身份证/营业执照）
2. 域名证书（在域名注册商下载）
3. 服务器 IP 信息（控制台获取）
4. 网站备案信息表（阿里云备案控制台在线填写）
5. 电话核验（备案期间保持手机畅通）
```

**备案路径**：阿里云控制台 → ICP 备案 → 新增网站 → 按提示上传材料

> 个人网站建议先用香港节点上线，备案通过后迁移大陆节点，可省去等待期。

---

## 5. 购买 ECS 实例（以阿里云为例）

### 5.1 选择规格

进入阿里云控制台 → **云服务器 ECS** → **创建实例**：

- **地域**：选华东（上海）或华北（北京），延迟低
- **规格**：入门推荐 `ecs.t6-c1m2.large`（2 vCPU / 2 GiB）
- **镜像**：Ubuntu 22.04 LTS（推荐）或 CentOS 7
- **系统盘**：40 GiB 高效云盘足够入门
- **带宽**：按固定带宽 1 Mbps 即可（后续可升）

### 5.2 设置登录凭证

推荐使用 **密钥对** 而非密码登录：

```bash
# 本地生成密钥对（已有可跳过）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 查看公钥，复制到阿里云控制台
cat ~/.ssh/id_ed25519.pub
```

在创建实例页面选择"导入已有密钥对"，粘贴公钥内容。

### 5.3 配置安全组

安全组相当于云端防火墙，**默认只开放 22（SSH）**，根据用途手动添加入方向规则：

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH 远程登录 |
| 80 | TCP | HTTP 网站访问 |
| 443 | TCP | HTTPS 加密访问 |
| 8080 | TCP | 应用服务（按需） |
| 3306 | TCP | MySQL（仅限内网 IP） |

> 不要对外开放数据库端口（3306/5432），仅允许服务器内网 IP（`172.xx.xx.xx/24`）访问。

---

## 6. 绑定公网 IP（弹性公网 IP）

实例创建后默认分配一个公网 IP，但关机后可能变化。推荐使用**弹性公网 IP（EIP）**：

```
控制台 → 弹性公网IP → 申请EIP → 绑定到实例
```

EIP 按量计费约 **¥0.02/小时 + 流量费**，若长期使用建议转为包年包月。

---

## 7. SSH 登录与安全加固

### 7.1 首次登录

```bash
# 首次登录，默认用户名 root（Ubuntu）或 ecs-user（部分镜像）
ssh -i ~/.ssh/id_ed25519 root@<你的公网IP>

# 立即创建非 root 用户
adduser keane
usermod -aG sudo keane

# 复制 SSH 公钥到新用户
mkdir -p /home/keane/.ssh
cp ~/.ssh/authorized_keys /home/keane/.ssh/
chown -R keane:keane /home/keane/.ssh
```

### 7.2 SSH 安全加固（必做）

默认配置的服务器每天会被扫描数千次，以下 3 步可阻断 99% 的暴力破解：

```bash
# 编辑 SSH 配置
vim /etc/ssh/sshd_config
```

修改以下字段：

```
Port 2222              # 改掉默认 22，降低被扫描概率
PermitRootLogin no     # 禁止 root 直接登录
PasswordAuthentication no  # 禁止密码登录，只允许密钥
MaxAuthTries 3
```

```bash
# 重启 SSH
systemctl restart sshd

# 阿里云安全组也要放行新端口 2222，再关闭 22
```

### 7.3 安装 fail2ban（自动封禁暴力破解 IP）

```bash
apt install -y fail2ban

# 创建本地配置（不修改默认配置，避免被更新覆盖）
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port    = 2222
EOF

systemctl enable fail2ban
systemctl start fail2ban

# 查看封禁列表
fail2ban-client status sshd
```

### 7.4 UFW 防火墙白名单

```bash
ufw allow 2222/tcp   # SSH（已改端口）
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny  22/tcp     # 关闭旧端口
ufw enable
ufw status verbose
```

---

## 8. 基础环境配置

```bash
apt update && apt upgrade -y
apt install -y curl wget git vim ufw htop
```

---

## 9. 域名解析

在域名注册商（阿里云、Cloudflare 等）添加 DNS 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | @ | `<公网IP>` |
| A | www | `<公网IP>` |
| A | api | `<公网IP>`（子域名按需添加） |

DNS 生效通常需要 5–30 分钟，用 `nslookup yourdomain.com` 验证。

---

## 10. Nginx 反向代理 + SSL

### 10.1 安装 Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
# 测试：浏览器访问 http://<公网IP>，看到 Nginx 欢迎页即成功
```

### 10.2 申请免费 SSL 证书

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
# 按提示输入邮箱，同意条款，自动配置 HTTPS 并续期
```

### 10.3 反向代理配置示例

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

    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

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

---

## 11. 实战：部署 FastAPI 服务全流程

从零到可访问的 HTTPS API 接口，全程 30 分钟。

### 11.1 项目结构

```
/opt/myapi/
├── main.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### 11.2 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 11.3 docker-compose.yml

```yaml
services:
  api:
    build: .
    restart: always
    ports:
      - "127.0.0.1:8080:8080"   # 只绑定本机，不对外暴露，Nginx 反代
    environment:
      - ENV=production
    volumes:
      - ./data:/app/data
```

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# 启动服务
cd /opt/myapi
docker compose up -d
docker compose logs -f    # 查看实时日志
```

### 11.4 systemd 守护（不用 Docker 时）

```ini
# /etc/systemd/system/myapi.service
[Unit]
Description=My FastAPI Service
After=network.target

[Service]
User=keane
WorkingDirectory=/opt/myapi
ExecStart=/home/keane/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable myapi
systemctl start myapi
systemctl status myapi
```

### 11.5 certbot 自动续签验证

```bash
# 测试续签（dry run，不真正续签）
certbot renew --dry-run

# 查看定时任务（certbot 安装时自动创建）
systemctl list-timers | grep certbot
```

### 11.6 部署后验证清单

```bash
# 1. 检查端口是否监听
ss -tlnp | grep 8080

# 2. 本机 curl 测试
curl http://127.0.0.1:8080/health

# 3. 通过域名 HTTPS 访问
curl https://yourdomain.com/health

# 4. 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 5. 查看服务日志
journalctl -u myapi -n 50 --no-pager
# 或
docker compose logs --tail=50
```

---

## 12. 监控与备份

### 12.1 阿里云快照定时备份

```
控制台 → 云服务器 ECS → 存储与快照 → 快照策略
→ 新建策略：
  - 执行时间：每天 03:00（低峰期）
  - 保留份数：7 份（滚动覆盖）
  - 关联磁盘：系统盘
→ 关联到实例
```

> 快照约 ¥0.12/GB/月，40G 系统盘每月 ¥4.8，强烈建议开启。

### 12.2 netdata 一键监控

```bash
# 一键安装（约 2 分钟）
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# 默认监听 19999 端口，只在内网可访问
# 本地 ssh 端口转发访问
ssh -L 19999:localhost:19999 keane@<公网IP> -p 2222
# 浏览器打开 http://localhost:19999
```

### 12.3 钉钉/飞书 Webhook 告警脚本

```bash
#!/bin/bash
# /opt/scripts/alert.sh
# 用法：./alert.sh "服务 myapi 挂了"

WEBHOOK="https://oapi.dingtalk.com/robot/send?access_token=你的token"
MSG=$1

curl -s -X POST "$WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{
    \"msgtype\": \"text\",
    \"text\": {\"content\": \"[ECS 告警] $MSG\n时间: $(date '+%Y-%m-%d %H:%M:%S')\"}
  }"
```

```bash
# 配合 crontab 监控服务存活
# crontab -e 添加：
*/5 * * * * systemctl is-active --quiet myapi || /opt/scripts/alert.sh "myapi 服务已停止"
```

---

## 13. 故障排查清单

### 13.1 SSH 连不上（8 种原因）

| 症状 | 可能原因 | 排查命令 |
|------|---------|---------|
| Connection refused | SSH 端口未开放或服务未启动 | `telnet <IP> 2222`；检查安全组 |
| Connection timeout | 安全组/防火墙封了端口 | 阿里云控制台 → 安全组 → 检查入方向 |
| Permission denied | 密钥不匹配或禁了密码 | 检查 `~/.ssh/authorized_keys` 权限（应为 600） |
| Host key changed | 服务器重装过，本地有旧指纹 | `ssh-keygen -R <IP>` 后重连 |
| Too many auth failures | fail2ban 封了你的 IP | 控制台 VNC 登录 → `fail2ban-client set sshd unbanip <你的IP>` |
| ssh: connect to host port 22 | 忘记改端口了 | `ssh -p 2222 ...` |
| Broken pipe | 网络不稳定 | SSH 配置加 `ServerAliveInterval 60` |
| No route to host | 公网 IP 未绑定或 EIP 未付费 | 控制台确认 EIP 绑定状态 |

### 13.2 502/504 五种诊断

```bash
# 1. 检查后端服务是否运行
systemctl status myapi
docker compose ps

# 2. 检查端口是否监听
ss -tlnp | grep 8080

# 3. 本机 curl 测试
curl -v http://127.0.0.1:8080/

# 4. 检查 Nginx 配置
nginx -t
tail -50 /var/log/nginx/error.log

# 5. 检查 proxy_pass 地址是否正确（常见错误：写成了外网 IP）
grep proxy_pass /etc/nginx/sites-enabled/*
```

### 13.3 磁盘满 / 内存爆 / OOM 应急

```bash
# 磁盘满：找大文件
du -sh /* 2>/dev/null | sort -rh | head -20
journalctl --vacuum-size=200M   # 清理系统日志
docker system prune -f          # 清理 Docker 无用镜像

# 内存爆：找吃内存进程
free -h
ps aux --sort=-%mem | head -15

# OOM 查看历史记录
dmesg | grep -i "oom\|killed"
journalctl -k | grep -i oom
```

### 13.4 IP 被封（常见于爬虫/垃圾邮件）

```bash
# 检测 IP 是否在黑名单
# 访问 https://mxtoolbox.com/blacklists.aspx 输入公网 IP

# 临时换 IP：释放 EIP，重新申请一个
# 控制台 → 弹性公网IP → 解绑 → 释放 → 申请新 EIP
```

---

## 14. 省钱技巧

| 方法 | 节省幅度 | 说明 |
|------|---------|------|
| 学生认证 | 最高 60% | 阿里云/腾讯云学生认证，¥9.5/月起 |
| 新用户首购 | 1–3 折 | 换手机号/邮箱注册新账号可重复享用（小号） |
| 抢占式实例 | 节省 70–90% | 随时可能被回收，适合可中断的批处理任务 |
| 包年 vs 按量 | 包年便宜 40% | 稳定使用就买包年；开发测试用按量 |
| 共享带宽包 | 多服务器共享 | 有多台服务器时，共享包比各自固定带宽省 |
| 及时释放 EIP | — | 不用时解绑 EIP（绑定时按带宽计费，解绑后按 IP 保留计费约 ¥0.02/h） |

---

## 15. 常见用途速查

| 用途 | 推荐工具 | 关键命令 |
|------|---------|---------|
| 运行 Python 服务 | `uvicorn` / `gunicorn` | `uvicorn main:app --host 0.0.0.0 --port 8080` |
| 进程守护 | `systemd` / `pm2` | `systemctl enable myapp` |
| Docker 部署 | Docker + Compose | `docker compose up -d` |
| 内网穿透备选 | Cloudflare Tunnel | `cloudflared tunnel run` |
| 监控告警 | `htop` + `netdata` | `apt install netdata` |
| 自动化工作流 | n8n | `docker compose up -d`（见下文） |

---

## 16. 延伸阅读

- [副业 & 自动化生产力工具](./tools-automation) — 在这台服务器上部署 n8n，把重复工作全部自动化

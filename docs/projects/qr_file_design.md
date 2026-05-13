---
title: QR 共享文件夹设计方案
---

# QR 共享文件夹 — 设计方案

> 版本: v1.5  
> 日期: 2026-05-13  
> 状态: **已上线** — [share.keaneai.top](https://share.keaneai.top)

---

## 1. 需求概述

### 1.1 用户故事

- **创建者**：我创建一个共享文件夹，设密码、权限和有效期，得到一个二维码。把二维码发给别人。
- **访问者**：微信或浏览器扫码 → 输入密码 → 按权限浏览/上传/下载/删除文件。过期自动失效。

### 1.2 核心约束

| 约束 | 实现状态 |
|------|---------|
| 微信扫码 + 浏览器扫码均可访问 | ✅ |
| 纯 Web 页面，无需安装 App | ✅ |
| 密码保护 + 有效期限制 | ✅ |
| 三级权限控制（只读/可上传/完全） | ✅ |
| 文件上传、浏览、下载、删除 | ✅ |
| 过期自动清理 | ✅ |

---

## 2. 系统架构

### 2.1 实际部署架构

```
用户手机/PC
    │
    ▼
Cloudflare CDN + SSL（自动证书）
    │
    ▼
Cloudflare Named Tunnel（cloudflared 进程）
    │  零端口暴露，无需公网 IP
    ▼
WSL2 Ubuntu（Windows 本机）
    │
    ▼
uvicorn → FastAPI（端口 8080）
    │
    ├─→ SQLite  data/shares.db
    └─→ 文件系统  uploads/{share_id}/
```

**选择 Cloudflare Tunnel 而非 Nginx 的原因**：
- 家庭网络无固定公网 IP，无需购买服务器
- Cloudflare 免费提供 SSL 证书和 CDN
- cloudflared 进程出站连接，防火墙零配置

### 2.2 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 后端框架 | FastAPI | ≥0.110 | REST API + 模板渲染 |
| ASGI 服务器 | Uvicorn | ≥0.29 | 生产级服务运行 |
| 模板引擎 | Jinja2 | ≥3.1 | 服务端渲染页面 |
| 数据库 | SQLite | 3.x（WAL 模式） | 分享元数据存储 |
| 密码哈希 | bcrypt | ≥4.1 | 密码安全存储 |
| Session 签名 | itsdangerous | ≥2.2 | 签名 session cookie token |
| 限流缓存 | cachetools | ≥5.3 | 登录速率限制（进程内 TTL） |
| 后台任务 | APScheduler | ≥3.10 | 过期分享自动清理 |
| 二维码 | qrcode[pil] | ≥7.4 | On-the-fly 生成二维码图片 |
| 隧道 | Cloudflare Tunnel | latest | HTTPS 穿透，无需公网 IP |
| 自启动 | Windows 任务计划 | — | 登录时自动启动服务 |

### 2.3 目录结构

```
qr-file-share/
├── app.py                  # FastAPI 主入口，路由 + 业务逻辑
├── config.py               # 全局配置（从 .env 读取）
├── models.py               # SQLite 数据层（Schema + CRUD）
├── auth.py                 # 认证鉴权（Admin Key / Session / CSRF / 限流）
├── qr_gen.py               # 二维码 on-the-fly 生成
├── tasks.py                # APScheduler 过期清理任务
├── templates/
│   ├── base.html           # 母版（移动端布局）
│   ├── create.html         # 创建分享页（含权限选择）
│   ├── manage.html         # 管理页（列表/删除/改密/延期）
│   ├── login.html          # 密码验证页
│   ├── browse.html         # 文件浏览/上传/下载/删除页
│   └── expired.html        # 过期提示页
├── static/
│   └── style.css           # 移动端优化样式
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env                    # 实际配置（不提交 Git）
├── .env.example            # 配置模板
├── autostart.ps1           # Windows 任务计划注册脚本
├── restart.sh              # 服务重启脚本（WSL 内运行）
├── cloudflared             # cloudflared 可执行文件
├── data/
│   └── shares.db           # SQLite 数据库
└── uploads/
    └── {share_id}/
        └── {uuid}.ext      # 用户上传的文件
```

---

## 3. 数据模型

### 3.1 表结构

```sql
-- 分享表
CREATE TABLE shares (
    id            TEXT PRIMARY KEY,     -- 8 位 base62 短码，如 "a1B2c3D4"
    name          TEXT NOT NULL,        -- 分享名称
    password_hash TEXT NOT NULL,        -- bcrypt 哈希
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP NOT NULL,   -- 过期时间
    is_active     INTEGER DEFAULT 1,    -- 1=有效，0=已清理
    quota_bytes   INTEGER NOT NULL,     -- 单分享总配额（默认 2GB）
    used_bytes    INTEGER DEFAULT 0,    -- 已用字节（原子维护）
    permissions   INTEGER DEFAULT 7     -- 权限位掩码，见下方说明
);
CREATE INDEX idx_shares_expires ON shares(expires_at, is_active);

-- 文件表
CREATE TABLE files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id    TEXT NOT NULL,
    filename    TEXT NOT NULL,          -- 原始文件名（UTF-8，最长 255）
    stored_name TEXT NOT NULL,          -- 存储文件名（UUID + 扩展名）
    size_bytes  INTEGER NOT NULL,
    mime_type   TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
);
CREATE INDEX idx_files_share ON files(share_id);

-- 访问日志表
CREATE TABLE access_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id    TEXT NOT NULL,
    action      TEXT NOT NULL,          -- login / login_failed / upload / download / delete / admin_upload
    filename    TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_log_share_time ON access_log(share_id, accessed_at DESC);
```

### 3.2 权限位掩码

```python
PERM_DOWNLOAD = 1   # bit0: 查看文件列表 + 下载
PERM_UPLOAD   = 2   # bit1: 上传新文件
PERM_DELETE   = 4   # bit2: 删除文件

PERM_READONLY  = 1  # 0b001 — 仅查看/下载
PERM_UPLOADER  = 3  # 0b011 — 下载 + 上传
PERM_FULL      = 7  # 0b111 — 完全控制（下载 + 上传 + 删除）
```

创建分享时选择权限级别，访问者登录后只能执行被授权的操作。

### 3.3 短码生成

```python
ALPHABET = string.ascii_letters + string.digits  # 62 字符
SHORT_CODE_LEN = 8                                # 62^8 ≈ 2.18 × 10¹⁴

def gen_share_id() -> str:
    for _ in range(5):  # 冲突重试最多 5 次
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        # 在 INSERT 中通过主键冲突触发重试
        try:
            # INSERT ...
            return code
        except sqlite3.IntegrityError:
            continue
```

用 `secrets.choice`（CSPRNG）确保不可预测，配合登录速率限制使暴力枚举不可行。

---

## 4. API 设计

### 4.1 路由表

#### 管理端（需 `X-Admin-Key` 请求头）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/shares` | 创建分享（返回 share_id + qr_url） |
| `GET` | `/api/shares` | 列出所有分享 |
| `DELETE` | `/api/shares/{id}` | 删除分享（连同文件） |
| `PATCH` | `/api/shares/{id}/expires` | 更新分享有效期 |
| `PATCH` | `/api/shares/{id}/password` | 重置分享密码 |
| `GET` | `/api/shares/{id}/files` | 列出分享内文件（管理员视角） |
| `GET` | `/api/shares/{id}/files/{fid}/download` | 管理员下载文件 |
| `POST` | `/api/shares/{id}/upload` | 管理员向分享上传文件（创建时预置文件） |

#### 访问端（需 session cookie）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/` | 首页（创建入口） | 公开 |
| `GET` | `/manage` | 管理页 | 公开（Admin Key 在前端输入） |
| `GET` | `/share/{id}` | 访问入口（自动分流） | 公开 |
| `POST` | `/share/{id}/login` | 提交密码验证 | 公开（有速率限制） |
| `POST` | `/share/{id}/logout` | 退出登录 | 公开 |
| `GET` | `/share/{id}/qr.png` | 获取二维码 PNG | 公开 |
| `GET` | `/share/{id}/files` | 列出文件（JSON） | session |
| `POST` | `/share/{id}/upload` | 上传文件 | session + CSRF |
| `GET` | `/share/{id}/download/{fid}` | 下载文件 | session |
| `DELETE` | `/share/{id}/files/{fid}` | 删除文件 | session + CSRF |

### 4.2 创建分享请求示例

```json
POST /api/shares
X-Admin-Key: your-admin-key

{
  "name": "项目资料 v2",
  "password": "abc123",
  "expires_in_hours": 48,
  "quota_mb": 1024,
  "permissions": 3
}

→ 201 Created
{
  "share_id": "a1B2c3D4",
  "share_url": "https://share.keaneai.top/share/a1B2c3D4",
  "qr_url": "/share/a1B2c3D4/qr.png",
  "expires_at": "2026-05-15T10:00:00",
  "permissions": 3
}
```

---

## 5. 页面流程

### 5.1 访问流程

```
GET /share/{id}
      │
      ├─ 分享不存在 → 404
      ├─ 分享已过期 → 渲染过期页（expired.html）
      │
      └─ 检查 session_{id} cookie
            ├─ 无效/不存在 → 渲染密码页（login.html） + 写入 CSRF cookie
            └─ 有效        → 渲染文件页（browse.html） + 刷新 CSRF cookie

POST /share/{id}/login  ←  password（表单提交）
      │
      ├─ 速率限制检查（5次/min，失败5次锁15分钟）
      ├─ bcrypt 验证密码
      ├─ 成功：Set-Cookie session_{id} + csrf_{id}
      └─ 302 → GET /share/{id}
```

### 5.2 权限控制

```
browse.html 根据 share.permissions 渲染：
  can_upload = bool(permissions & PERM_UPLOAD)  →  显示/隐藏上传按钮
  can_delete = bool(permissions & PERM_DELETE)  →  显示/隐藏删除按钮

服务端写操作（upload / delete）再次验证 permissions，双重保险。
```

---

## 6. 安全设计

### 6.1 双链路认证

```
管理员侧：X-Admin-Key 请求头 → secrets.compare_digest(key, ADMIN_KEY)
访问者侧：session_{share_id} cookie（itsdangerous 签名）
```

两条链路完全独立，互不影响。

### 6.2 Session Cookie 设计

每个分享使用独立命名的 cookie，防止不同分享间的 session 串用：

| Cookie | 内容 | 属性 |
|--------|------|------|
| `session_{share_id}` | itsdangerous 签名 token（含 share_id + 签发时间） | `HttpOnly; Secure; SameSite=Lax; Path=/share/{id}` |
| `csrf_{share_id}` | 32 字节随机 hex | `Secure; SameSite=Strict; Path=/share/{id}`（非 HttpOnly） |

Session 有效期：`min(分享剩余有效时间, SESSION_MAX_HOURS)`

### 6.3 CSRF 防护（双重提交 cookie）

所有写操作（上传/删除/退出）：

1. 服务端渲染页面时向浏览器写入 `csrf_{share_id}` cookie（非 HttpOnly）
2. 前端 JS 读取该 cookie，附加到 `X-CSRF-Token` 请求头
3. 服务端用 `secrets.compare_digest` 比较 header 与 cookie

跨站脚本无法读取 same-site cookie，自动防护。

### 6.4 登录速率限制

按 `(share_id, client_ip)` 维度，使用进程内 `cachetools.TTLCache`：

- 5 次/分钟失败 → 锁定 15 分钟
- 锁定期间返回 `429 Too Many Requests`

配置项：`LOGIN_RATE_LIMIT_PER_MINUTE`、`LOGIN_LOCKOUT_MINUTES`

### 6.5 文件安全

| 措施 | 实现 |
|------|------|
| 存储命名 | UUID + 原始扩展名，不暴露文件名 |
| 路径隔离 | 每个 share_id 独立目录，存储路径仅由 UUID 拼接 |
| 文件名净化 | 去除控制字符、路径分隔符，长度限 255 |
| 后缀黑名单 | 拒绝 exe/bat/cmd/sh/ps1/msi/app/dmg/deb/rpm/jar/scr/com/vbs |
| 单文件大小限制 | `MAX_FILE_SIZE_MB`（默认 100MB）预检 Content-Length + 写盘时累计字节数 |
| 单分享配额 | `quota_bytes` 字段，`UPDATE ... WHERE used_bytes + new ≤ quota_bytes` 原子保证 |
| 全局磁盘水位 | `DISK_HIGH_WATERMARK`（默认 80%），超限拒绝所有上传 |
| 中文文件名 | 下载响应头用 RFC 5987：`filename*=UTF-8''<percent-encoded>` |

---

## 7. 部署方案（当前生产配置）

### 7.1 环境变量（.env）

```env
# ── 必填 ────────────────────────────────────────────
ADMIN_KEY=<≥16位随机字符串>
# python -c "import secrets; print(secrets.token_urlsafe(32))"

SECRET_KEY=<≥32位随机字符串>
# python -c "import secrets; print(secrets.token_urlsafe(48))"

BASE_URL=https://share.keaneai.top   # 用于生成二维码中的链接

# ── 上传限制 ────────────────────────────────────────
MAX_FILE_SIZE_MB=100
DEFAULT_SHARE_QUOTA_MB=2048          # 2GB
DISK_HIGH_WATERMARK=0.80
BLOCKED_EXTENSIONS=exe,bat,cmd,sh,ps1,msi,app,dmg,deb,rpm,jar,scr,com,vbs

# ── Session ─────────────────────────────────────────
SESSION_MAX_HOURS=24

# ── 登录限流 ────────────────────────────────────────
LOGIN_RATE_LIMIT_PER_MINUTE=5
LOGIN_LOCKOUT_MINUTES=15

# ── 后台清理 ────────────────────────────────────────
CLEANUP_INTERVAL_MINUTES=60

# ── 存储路径 ────────────────────────────────────────
DB_PATH=data/shares.db
UPLOAD_DIR=uploads
```

### 7.2 服务启动（WSL2 裸运行）

```bash
# 激活虚拟环境
cd /mnt/d/Hermes/projects/qr-file-share
source .venv/bin/activate

# 启动 uvicorn
nohup uvicorn app:app --host 0.0.0.0 --port 8080 > uvicorn.log 2>&1 &

# 启动 cloudflared Named Tunnel
nohup ./cloudflared tunnel run > cloudflared.log 2>&1 &
```

### 7.3 开机自动启动

**`restart.sh`**（WSL2 内执行）：

```bash
#!/usr/bin/env bash
# 停止旧进程
pkill -f "uvicorn app:app" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# 启动 uvicorn
nohup uvicorn app:app --host 0.0.0.0 --port 8080 > uvicorn.log 2>&1 &

# 启动 cloudflared
if [ -f "$HOME/.cloudflared/config.yml" ]; then
  nohup ./cloudflared tunnel run > cloudflared.log 2>&1 &
else
  # 回退到临时隧道，自动更新 .env 中的 BASE_URL
  nohup ./cloudflared tunnel --url http://localhost:8080 > cloudflared.log 2>&1 &
fi
```

**`autostart.ps1`**（PowerShell 以管理员身份执行一次，注册 Windows 任务计划）：

```powershell
$action = New-ScheduledTaskAction `
    -Execute "wsl.exe" `
    -Argument "-e bash /mnt/d/Hermes/projects/qr-file-share/restart.sh"

$trigger = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask `
    -TaskName "QRFileShare-Autostart" `
    -Action $action -Trigger $trigger `
    -RunLevel Highest -Force
```

注册后，每次 Windows 登录时自动在 WSL2 中启动 uvicorn + cloudflared。

### 7.4 Docker 部署（可选）

```yaml
# docker-compose.yml
services:
  qr-share:
    build: .
    expose: ["8080"]
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    env_file: .env
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}
    depends_on: [qr-share]
    restart: unless-stopped
```

---

## 8. 后台清理任务

应用启动时由 APScheduler 注册，每 `CLEANUP_INTERVAL_MINUTES`（默认 60 分钟）执行：

```python
def cleanup_expired_shares() -> int:
    expired = list_expired_share_ids(utcnow())  # SELECT WHERE expires_at < now
    for share_id in expired:
        shutil.rmtree(UPLOAD_DIR / share_id, ignore_errors=True)
        delete_share(share_id)  # CASCADE 删除 files 表记录
    return len(expired)
```

**幂等性**：某次失败的清理，下次运行会重试，不会遗漏。

---

## 9. 微信浏览器兼容

| 问题 | 处理方式 |
|------|---------|
| Android 微信拦截 `<a download>` | UA 检测到 `MicroMessenger` 时显示"右上角 ··· → 在浏览器中打开"引导浮层 |
| iOS 微信 `<input type="file">` 只能选图片 | 提示"如需上传文档，请在 Safari/Chrome 中打开" |
| HTML 缓存激进 | 响应头 `Cache-Control: no-store`；静态资源加哈希后缀 |

---

## 10. 实现状态

| Phase | 功能 | 状态 |
|-------|------|------|
| Phase 1 | SQLite Schema + 短码生成 | ✅ |
| Phase 1 | 创建分享 API + QR on-the-fly | ✅ |
| Phase 1 | bcrypt 密码验证 + session cookie | ✅ |
| Phase 1 | CSRF 双重提交 cookie | ✅ |
| Phase 1 | 登录速率限制 | ✅ |
| Phase 1 | 流式上传 + 配额预检 | ✅ |
| Phase 1 | 下载 + RFC 5987 文件名 | ✅ |
| Phase 1 | 过期检测 + 过期页 | ✅ |
| Phase 2 | 移动端 UI | ✅ |
| Phase 2 | 管理页面（列表/删除/改密/延期） | ✅ |
| Phase 2 | 访问日志 | ✅ |
| Phase 2 | 三级权限系统（只读/上传/完全） | ✅ |
| Phase 2 | 管理员预置文件（admin upload） | ✅ |
| Phase 3 | Docker 镜像 + compose | ✅ |
| Phase 3 | Cloudflare Tunnel 部署 | ✅ |
| Phase 3 | APScheduler 过期清理 | ✅ |
| Phase 3 | 磁盘水位监测 | ✅ |
| Phase 3 | Windows 任务计划自启动 | ✅ |
| 待定 | 上传进度条 | 🔲 |
| 待定 | 图片在线预览 | 🔲 |
| 待定 | 批量上传 / 断点续传 | 🔲 |

---

## 11. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-12 | 初版设计 |
| v1.1 | 2026-05-12 | 修正认证流程：拆分公开/受保护路由；按 share_id 隔离 session cookie；CSRF 改双重提交 cookie；明确速率限制 |
| v1.2 | 2026-05-12 | 补充：短码冲突重试；流式上传 + 配额 + 磁盘水位；StreamingResponse + RFC 5987；微信兼容；APScheduler；Nginx 流式代理 + HSTS |
| v1.3 | 2026-05-12 | 梳理待确认项，转为决策记录 |
| v1.4 | 2026-05-12 | 全部决策落定：Cloudflare Tunnel、文件黑名单、2GB 配额默认值 |
| v1.5 | 2026-05-13 | 同步实际实现状态：新增三级权限系统、管理员预置文件上传、PATCH 更新接口；更新部署架构为 WSL2 + Named Tunnel；新增 Windows 任务计划自启动方案；补全所有配置项；标注已上线 |

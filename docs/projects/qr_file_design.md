---
title: QR 共享文件夹设计方案
---

# QR 共享文件夹 — 设计方案

> 版本: v1.0  
> 日期: 2026-05-12  
> 状态: 设计确认中

---

## 1. 需求概述

### 1.1 用户故事

- **创建者**: 我创建一个共享文件夹，设密码和有效期，得到一个二维码。把二维码发给别人。
- **访问者**: 微信或浏览器扫码 → 输入密码 → 浏览/上传/下载文件。过期自动失效。

### 1.2 核心约束

| 约束 | 说明 |
|---|---|
| 访问入口 | 微信扫码 + 浏览器扫码均可 |
| 访问方式 | 纯 Web 页面，无需安装 App |
| 权限控制 | 密码保护 + 有效期限制 |
| 部署方式 | 纯云端，Docker 一键部署 |
| 文件操作 | 上传、浏览、下载 |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   创建者     │     │   Nginx      │     │  FastAPI     │
│  (浏览器)    │────▶│  (反代+SSL)  │────▶│  (端口8080)  │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
┌─────────────┐                                │
│   访问者     │     ┌──────────────┐     ┌─────▼───────┐
│ (微信/浏览器)│────▶│   二维码       │     │  文件存储    │
└─────────────┘     │  (qrcode库)   │     │  uploads/    │
                    └──────────────┘     └─────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │   SQLite     │
                                        │   data/      │
                                        └──────────────┘
```

### 2.2 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 后端框架 | FastAPI | ≥0.110 | REST API + 模板渲染 |
| ASGI 服务器 | Uvicorn | ≥0.29 | 生产级服务运行 |
| 模板引擎 | Jinja2 | ≥3.1 | 服务端渲染页面 |
| 数据库 | SQLite | 3.x | 分享元数据存储 |
| 密码哈希 | bcrypt | ≥4.1 | 密码安全存储 |
| Session 签名 | itsdangerous | ≥2.2 | 签名 session cookie token |
| 限流缓存 | cachetools | ≥5.3 | 登录速率限制（进程内 TTL） |
| 异步文件 IO | aiofiles | ≥23.2 | 流式上传写盘 |
| 后台任务 | APScheduler | ≥3.10 | 过期分享清理 |
| 二维码 | qrcode[pil] | ≥7.4 | 生成二维码图片 |
| 反向代理 | Nginx | ≥1.25 | 域名绑定 + SSL |
| 容器化 | Docker | ≥24 | 一键部署 |

### 2.3 目录结构

```
qr-file-share/
├── DESIGN.md                 # 本文档
├── README.md                 # 部署说明
├── requirements.txt          # Python 依赖
├── Dockerfile                # Docker 镜像
├── docker-compose.yml        # 开发环境
├── app.py                    # FastAPI 主入口
├── config.py                 # 全局配置
├── models.py                 # 数据模型
├── auth.py                   # 密码验证 + session + CSRF
├── qr_gen.py                 # 二维码生成（on-the-fly）
├── tasks.py                  # APScheduler 后台清理任务
├── templates/
│   ├── base.html             # 母版（移动端布局）
│   ├── create.html           # 创建分享页
│   ├── manage.html           # 管理我的分享
│   ├── login.html            # 密码验证页
│   ├── browse.html           # 文件浏览/上传/下载
│   └── expired.html          # 过期提示页
├── static/
│   └── style.css             # 移动端优化的样式
├── data/                     # SQLite 数据库（挂载卷）
│   └── shares.db
└── uploads/                  # 用户文件存储（挂载卷）
    └── {share_id}/
        ├── <uuid>.jpg
        └── <uuid>.pdf
```

---

## 3. 数据模型

### 3.1 表结构

```sql
-- 分享表
CREATE TABLE shares (
    id            TEXT PRIMARY KEY,   -- 8 位短码，如 "a1B2c3D4"
    name          TEXT NOT NULL,      -- 分享名称
    password_hash TEXT NOT NULL,      -- bcrypt 哈希
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP NOT NULL, -- 过期时间
    is_active     INTEGER DEFAULT 1,  -- 0=已禁用/已清理, 1=有效
    quota_bytes   INTEGER DEFAULT 2147483648,  -- 单分享总配额（默认 2GB）
    used_bytes    INTEGER DEFAULT 0   -- 已用字节数（上传/删除时维护）
);
CREATE INDEX idx_shares_expires ON shares(expires_at, is_active);  -- 供清理任务扫描

-- 文件表
CREATE TABLE files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id    TEXT NOT NULL,        -- 所属分享
    filename    TEXT NOT NULL,        -- 原始文件名（UTF-8）
    stored_name TEXT NOT NULL,        -- 存储文件名 (UUID)
    size_bytes  INTEGER NOT NULL,
    mime_type   TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
);
CREATE INDEX idx_files_share ON files(share_id);

-- 访问日志表 (可选)
CREATE TABLE access_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id   TEXT NOT NULL,
    action     TEXT NOT NULL,         -- login / upload / download / delete
    filename   TEXT,                  -- 操作的文件名
    ip_address TEXT,
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_log_share_time ON access_log(share_id, accessed_at DESC);
```

### 3.2 数据流

```
创建分享:
  POST /api/shares → gen_share_id() → bcrypt(密码) → INSERT shares
                    → mkdir uploads/{share_id}
                    → 二维码 on-the-fly 生成（不缓存到磁盘）
                    → 返回 share_url + qr_url

访问分享:
  GET /share/{share_id} → 检查过期 → 未登录→密码页
                         → 已登录→文件页

上传文件:
  POST /share/{share_id}/upload → 验证 session + CSRF
                                 → 检查 used_bytes + 新文件 ≤ quota_bytes
                                 → 流式写入 uploads/{share_id}/UUID.扩展名
                                 → INSERT files + UPDATE shares.used_bytes
                                 → 返回文件列表

下载文件:
  GET /share/{share_id}/download/{file_id} → 验证 session
                                            → StreamingResponse 分块返回
```

### 3.3 短码生成策略

```python
ALPHABET = string.ascii_letters + string.digits  # 62 字符
SHORT_CODE_LEN = 8                                # 62^8 ≈ 2.18 × 10^14

def gen_share_id(conn, max_retries=5) -> str:
    for _ in range(max_retries):
        code = "".join(secrets.choice(ALPHABET) for _ in range(SHORT_CODE_LEN))
        try:
            # 调用方在同一事务内 INSERT，主键冲突即重试
            return code
        except sqlite3.IntegrityError:
            continue
    raise RuntimeError("Failed to generate unique share_id")
```

- 用 `secrets.choice` 而非 `random`，CSPRNG 抗预测
- 8 位长度兼顾"易抄写"与"难枚举"；配合 §6.1.4 速率限制，遍历不可行

---

## 4. API 设计

### 4.1 路由表

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| `GET` | `/` | 首页（创建入口） | 无 |
| `POST` | `/api/shares` | 创建新分享 | `X-Admin-Key`¹ |
| `GET` | `/api/shares` | 列出所有分享 | `X-Admin-Key` |
| `DELETE` | `/api/shares/{id}` | 删除分享 | `X-Admin-Key` |
| `GET` | `/share/{share_id}` | 访问分享入口（自动分流） | 公开² |
| `POST` | `/share/{share_id}/login` | 提交密码验证 | 公开（带速率限制） |
| `POST` | `/share/{share_id}/logout` | 清除该分享的 session | 公开 |
| `GET` | `/share/{share_id}/files` | 列出文件 (JSON) | session cookie |
| `POST` | `/share/{share_id}/upload` | 上传文件 | session cookie + CSRF token |
| `GET` | `/share/{share_id}/download/{file_id}` | 下载文件 | session cookie |
| `DELETE` | `/share/{share_id}/files/{file_id}` | 删除文件 | session cookie + CSRF token |
| `GET` | `/share/{share_id}/qr.png` | 获取二维码图片 | 公开³ |

> ¹ 创建者密码通过请求头 `X-Admin-Key` 传递（环境变量 `ADMIN_KEY`），单 Key 模式下"我的分享"=所有分享  
> ² `GET /share/{share_id}` 自身公开：根据 cookie 内部分流到密码页 / 文件页 / 过期页  
> ³ 二维码仅含链接、不含密码，公开访问无风险

### 4.2 请求/响应示例

**创建分享**
```
POST /api/shares
X-Admin-Key: admin-secret-key

{
  "name": "项目资料",
  "password": "abc123",
  "expires_in_hours": 24
}

→ 201 Created
{
  "share_id": "a1B2c3D4",
  "qr_url": "/share/a1B2c3D4/qr.png",
  "share_url": "https://example.com/share/a1B2c3D4",
  "expires_at": "2026-05-13T18:00:00Z"
}
```

**验证密码**
```
POST /share/a1B2c3D4/login
Content-Type: application/x-www-form-urlencoded

password=abc123

→ 302 → /share/a1B2c3D4  (重定向到文件页)
或
→ 200 + 错误提示
```

---

## 5. 页面设计

### 5.1 页面流程图

```
[扫码] → GET /share/{id}
              │
       ┌──────▼─────────────┐
       │  服务端检查:         │
       │  1. 分享存在?        │── 否 → 404
       │  2. 已过期?          │── 是 → 渲染过期页
       │  3. cookie session_{id} 有效? │
       └──┬──────────────┬───┘
     未/失效 │            │ 有效
       ┌────▼──────┐   ┌─▼────────────┐
       │ 渲染密码页  │   │  渲染文件浏览页 │
       │ + CSRF token│  │ + CSRF token  │
       └───┬────────┘   └───────────────┘
           │
   POST /share/{id}/login (password + csrf_token)
           │
      bcrypt 验证 + 速率限制
           │
   Set-Cookie: session_{id}=<signed_token>;
               HttpOnly; Secure; SameSite=Strict;
               Max-Age=min(剩余有效期, 24h)
   Set-Cookie: csrf_{id}=<random>;
               Secure; SameSite=Strict  (非 HttpOnly, 供 JS 读)
           │
   302 → GET /share/{id}
```

### 5.2 页面清单

| 页面 | 路径 | 功能 |
|---|---|---|
| 首页 | `/` | 创建者入口，新建分享 |
| 管理页 | `/manage` | 列出已创建的分享，删除/查看 |
| 密码页 | `/share/{id}` | 未登录时显示密码输入框 |
| 文件页 | `/share/{id}` | 已登录显示文件列表 + 上传/下载/删除 |
| 过期页 | `/share/{id}` | 分享已过期提示 |

### 5.3 移动端 UI 设计

- 触控友好的大按钮（最小 44x44px）
- 文件列表使用卡片式布局
- 上传进度条显示
- 微信内置浏览器兼容：
  - 下载使用 `<a download>` 属性
  - 备选：长按链接保存
- 响应式：320px ~ 768px 均适配

---

## 6. 安全设计

### 6.1 认证机制

系统有两条独立认证链路，互不影响。

#### 6.1.1 创建者侧（管理面）

```
管理员 Key (X-Admin-Key 请求头) → 与环境变量 ADMIN_KEY 常量时间比较
                                  → 通过则放行 /api/shares/* 全部操作
```

- 单 Key 模式，无登录 session，每个管理 API 请求都需带头
- 管理页 `/manage` 首次访问时让用户在浏览器输入 Key，前端 JS 把 Key 写入 `localStorage` 并附加到 `X-Admin-Key`
- 用 `secrets.compare_digest()` 比较，防计时攻击

#### 6.1.2 访问者侧（分享面）

**Session 设计**：每个分享独立 cookie，命名空间隔离，互不串扰。

| 字段 | 内容 | 属性 |
|---|---|---|
| `session_{share_id}` | 签名 token（见下） | `HttpOnly; Secure; SameSite=Strict; Path=/share/{id}` |
| `csrf_{share_id}` | 32 字节随机 hex | `Secure; SameSite=Strict; Path=/share/{id}`（**非** HttpOnly） |

**Token 内容**（使用 `itsdangerous.URLSafeTimedSerializer`，密钥 = `SECRET_KEY`）：

```python
token = serializer.dumps({
    "sid": share_id,          # 防 cookie 错配
    "iat": int(time.time()),  # 签发时间
})
# 验证时检查:
#   1. 签名有效（itsdangerous 自动）
#   2. payload.sid == 当前 URL 的 share_id
#   3. 分享未过期 (DB 查 expires_at)
#   4. cookie max-age 未超
```

**有效期**：`Max-Age = min(expires_at - now, 24h)`。分享过期时 cookie 自动失效。

**为什么不用全局 SessionMiddleware**：starlette 的 `SessionMiddleware` 共享同一 cookie，登录分享 A 后访问分享 B 会复用同一 session，必须按 share_id 命名 cookie 才能隔离。

#### 6.1.3 CSRF 防护（双重提交 cookie 模式）

修正前文"仅靠 cookie 校验"的错误。所有 **写操作**（upload/delete/logout）：

1. 服务端渲染页面时把 `csrf_{share_id}` cookie 写入浏览器（非 HttpOnly，JS 可读）
2. 前端 JS 读取该 cookie，附加到请求头 `X-CSRF-Token`
3. 服务端比较请求头 `X-CSRF-Token` 与 cookie `csrf_{share_id}` 是否相等（常量时间）
4. 跨站请求拿不到 cookie 也读不到 token，自动被拒

login 接口本身**不需要** CSRF（POST 密码失败本就是攻击者的目的，无新增风险），但需配速率限制。

#### 6.1.4 登录速率限制

防止 8 位短码 + 弱密码被暴力枚举：

- 按 `(share_id, client_ip)` 维度限流：**5 次/分钟，连续失败 5 次锁定 15 分钟**
- 使用进程内 `cachetools.TTLCache`（单实例够用；多实例部署改 Redis）
- 锁定期间返回 `429 Too Many Requests`，不泄露密码是否正确

### 6.2 文件安全

| 措施 | 说明 |
|---|---|
| 存储命名 | 文件以 UUID 命名，不暴露原始文件名 |
| 路径隔离 | 每个 share_id 独立目录，不可跨越访问 |
| 路径穿越防护 | 文件名经 `werkzeug.utils.secure_filename()` + 去除控制字符；存储路径仅由 UUID 拼接，不使用用户输入 |
| 文件大小限制 | 单文件默认 `MAX_FILE_SIZE_MB=100`（与 Nginx `client_max_body_size` 对齐），可在 `.env` 配置 |
| 单分享配额 | `shares.quota_bytes` 默认 2GB，创建时可覆盖，上传前预检查 `used_bytes + new_size ≤ quota_bytes` |
| 全局磁盘水位 | 启动时 + 定时任务监测 `uploads/` 总占用，超过 `DISK_HIGH_WATERMARK`（默认 80%）拒绝新上传 |
| 可执行文件黑名单 | 拒绝 `.exe .bat .cmd .sh .ps1 .msi .app .dmg .deb .rpm .jar .scr .com .vbs` 等高危后缀；其他类型不限制 |
| MIME 校验 | 下载时基于 `mime_type` 字段设置 `Content-Type`，未知类型回退 `application/octet-stream` |
| 中文文件名 | 下载响应头使用 RFC 5987 编码：`Content-Disposition: attachment; filename*=UTF-8''<percent-encoded>` |

### 6.3 其他安全措施

- SQLite 使用参数化查询防注入
- CSRF: 双重提交 cookie 模式，详见 6.1.3
- 登录速率限制: 详见 6.1.4
- 二维码不含密码，仅含链接
- 强制 HTTPS：Nginx 配 HSTS + 80→443 跳转；`Secure` cookie 在 HTTP 下浏览器拒绝下发
- 常量时间比较：`ADMIN_KEY` 与 CSRF token 均用 `secrets.compare_digest()`

### 6.4 文件传输

#### 6.4.1 上传：流式 + 配额预检

FastAPI 默认 `UploadFile` 会先 spool 到临时文件，再读入内存可能爆掉小内存机器。改为手动分块：

```python
@app.post("/share/{share_id}/upload")
async def upload(share_id: str, request: Request, ...):
    # 1. 从 Content-Length 头预检查（不可信但能挡明显超限）
    declared = int(request.headers.get("content-length", 0))
    if declared > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    share = get_share(share_id)
    if share.used_bytes + declared > share.quota_bytes:
        raise HTTPException(413, "Share quota exceeded")

    # 2. 流式落盘，边写边累计字节数（防止 Content-Length 撒谎）
    dest = UPLOAD_DIR / share_id / f"{uuid4()}{ext}"
    written = 0
    async with aiofiles.open(dest, "wb") as f:
        async for chunk in request.stream():        # 64KB 块
            written += len(chunk)
            if written > MAX_FILE_SIZE:
                await f.close(); dest.unlink()
                raise HTTPException(413, "File too large")
            await f.write(chunk)

    # 3. 事务内更新 files + shares.used_bytes
    ...
```

**分片/断点续传**：MVP 不实现，移动端弱网下采用以下兜底：
- 前端 `<input multiple>` 允许多文件一次提交，单文件失败不影响其他
- 显示上传进度条（`XMLHttpRequest.upload.onprogress`），失败时提示重试
- Phase 2 再评估 [tus.io](https://tus.io) 协议接入

#### 6.4.2 下载：StreamingResponse

```python
return StreamingResponse(
    iter_file_chunks(path, chunk_size=64 * 1024),
    media_type=file.mime_type or "application/octet-stream",
    headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.filename)}",
        "Content-Length": str(file.size_bytes),
    },
)
```

大文件下载内存占用恒定（~64KB），不依赖文件大小。

### 6.5 微信浏览器兼容

微信内置 WebView（X5/WKWebView）有几个坑：

| 问题 | 应对 |
|---|---|
| 部分 Android 微信版本拦截 `<a download>` 直链下载 | UA 检测到 `MicroMessenger` 时显示"请点击右上角 ··· → 在浏览器中打开"引导浮层 |
| iOS 微信 `<input type="file">` 只能选图片/视频，无法选任意文档 | 文案提示"如需上传文档，请在 Safari/Chrome 中打开本页面" |
| 缓存激进，HTML 更新可能不生效 | HTML 响应头加 `Cache-Control: no-store`；静态资源加 hash 后缀 |
| 不支持某些新 CSS（如 `:has()`） | 样式做 graceful degradation，避免依赖前沿特性 |

---

## 7. 部署方案

### 7.1 Docker 部署

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

VOLUME ["/app/data", "/app/uploads"]
EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 7.2 环境变量

```env
ADMIN_KEY=your-admin-secret-key-change-me
SECRET_KEY=random-session-secret-key      # itsdangerous 签名密钥，≥32 字节随机
BASE_URL=https://share.example.com
MAX_FILE_SIZE_MB=100                      # 单文件上限，需与 Nginx client_max_body_size 一致
DEFAULT_SHARE_QUOTA_MB=2048               # 单分享总配额默认值（2GB）
BLOCKED_EXTENSIONS=exe,bat,cmd,sh,ps1,msi,app,dmg,deb,rpm,jar,scr,com,vbs
DISK_HIGH_WATERMARK=0.80                  # uploads/ 占磁盘比例上限
SESSION_MAX_HOURS=24                      # session cookie 最大寿命
DB_PATH=/app/data/shares.db
UPLOAD_DIR=/app/uploads
CLEANUP_INTERVAL_MINUTES=60               # 过期清理任务运行间隔
```

### 7.3 docker-compose.yml

```yaml
version: "3.9"
services:
  qr-share:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    environment:
      - ADMIN_KEY=${ADMIN_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - BASE_URL=${BASE_URL}
    restart: unless-stopped
```

### 7.4 Nginx 反代配置（可选）

```nginx
server {
    listen 443 ssl;
    server_name share.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    client_max_body_size 100M;  # 必须 ≥ MAX_FILE_SIZE_MB

    # HSTS：强制浏览器后续走 HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 大文件上传/下载相关
        proxy_request_buffering off;       # 不缓冲请求体，直接转给 FastAPI 流式处理
        proxy_buffering off;                # 下载也禁用缓冲，降低首字节延迟
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

# 80 端口强制跳转 443
server {
    listen 80;
    server_name share.example.com;
    return 301 https://$host$request_uri;
}
```

### 7.5 无域名部署：Cloudflare Tunnel（推荐）

如果暂时不买域名，**不要裸 IP + HTTP 暴露**（Secure cookie 失效、密码明文传输）。推荐用 Cloudflare Tunnel 白嫖 HTTPS：

**优势**
- 零成本、零端口转发、自动签发并续期 HTTPS 证书
- 服务可跑在家庭网络/NAS/无公网 IP 机器上
- 替代 §7.4 的 Nginx 反代角色（也可保留 Nginx 仅做 8080→Tunnel）

**部署步骤**
```bash
# 1. 安装 cloudflared
#    macOS:   brew install cloudflared
#    Linux:   下载 https://github.com/cloudflare/cloudflared/releases

# 2. 临时模式（每次重启域名变化，适合 demo）
cloudflared tunnel --url http://localhost:8080
# →  得到 https://random-words-1234.trycloudflare.com

# 3. 持久模式（推荐，需有 Cloudflare 账号 + 域名）
cloudflared tunnel login                          # 浏览器授权
cloudflared tunnel create qr-share                # 创建 tunnel
cloudflared tunnel route dns qr-share share.yourdomain.com
cloudflared tunnel run qr-share                   # 启动
```

**配置变更**
```env
BASE_URL=https://share.yourdomain.com   # 或 trycloudflare 临时域名
# Nginx 可省略，Tunnel 直接打 127.0.0.1:8080
```

**与 docker-compose 集成**：把 `cloudflared` 作为 sidecar 容器加入 `docker-compose.yml`：

```yaml
services:
  qr-share:
    # ... 同前
    expose: ["8080"]   # 改 expose 不再暴露端口到宿主

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}
    depends_on: [qr-share]
    restart: unless-stopped
```

**域名选择**
- 没有 CF 账号下的域名：直接用 `*.trycloudflare.com` 临时域名（每次重启变）
- 想要固定域名：在 Cloudflare Registrar 注册 `.xyz`/`.online` 等，约 ¥10/年，无需国内备案
- 国内访问偶尔不稳，主要面向境外/移动数据网络时无感

### 7.6 后台清理任务

应用启动时由 `tasks.py` 注册 APScheduler 任务，每 `CLEANUP_INTERVAL_MINUTES`（默认 60）跑一次：

```python
def cleanup_expired_shares():
    now = datetime.utcnow()
    with db() as conn:
        rows = conn.execute(
            "SELECT id FROM shares WHERE expires_at < ? AND is_active = 1",
            (now,)
        ).fetchall()

    for (share_id,) in rows:
        # 1. 删除文件目录（rmtree 容错：目录可能已不存在）
        shutil.rmtree(UPLOAD_DIR / share_id, ignore_errors=True)
        # 2. 标记 is_active=0，files 表通过 ON DELETE CASCADE 清理
        with db() as conn:
            conn.execute("DELETE FROM shares WHERE id = ?", (share_id,))
            conn.commit()
        logger.info("cleaned expired share: %s", share_id)
```

**为何不用 OS cron**：APScheduler 进程内运行，与应用共享数据库连接和配置，部署只一个容器；容器重启后自动恢复调度。

**幂等性**：清理失败（如文件被占用）下次运行重试；`is_active=0` 状态让查询过期访问者立即拿到过期页，不依赖清理完成。

---

## 8. 开发计划

### Phase 1: 核心 MVP（Day 1-2）

- [x] 项目骨架搭建
- [ ] 数据库模块 (SQLite + 建表 + 索引)
- [ ] 短码生成 + 冲突重试
- [ ] 创建分享 API + 二维码 on-the-fly 生成
- [ ] 密码验证 + 按 share_id 隔离的 session cookie
- [ ] CSRF 双重提交 cookie
- [ ] 登录速率限制
- [ ] 文件浏览页面
- [ ] 流式上传 + 配额预检
- [ ] StreamingResponse 下载 + RFC 5987 文件名
- [ ] 到期检测 + 过期页

### Phase 2: 增强（Day 3）

- [ ] 美观的移动端 UI
- [ ] 批量上传（多选 + 单文件失败重试）
- [ ] 上传进度条
- [ ] 微信浏览器引导浮层
- [ ] 图片在线预览（`<img>` 直链 + lightbox；PDF/视频不做预览，直接下载）
- [ ] 管理页面
- [ ] 访问日志

### Phase 3: 生产就绪（Day 4）

- [ ] Docker 镜像 + compose
- [ ] Nginx 配置模板（HSTS + 流式代理）
- [ ] Cloudflare Tunnel sidecar 集成
- [ ] APScheduler 过期清理任务
- [ ] 磁盘水位监测
- [ ] README 部署文档

---

## 9. 决策记录

所有原"待确认项"均已确认，按设计落实。

| 议题 | 决策 | 落点 |
|---|---|---|
| 管理 Key 模式 | 单 Key（`ADMIN_KEY` 环境变量） | §6.1.1 |
| 域名/HTTPS | 不买域名，使用 Cloudflare Tunnel 白嫖 HTTPS；临时用 `*.trycloudflare.com`，固定用 ¥10/年 `.xyz` 域名 | §7.5 |
| 微信接入形态 | 纯 H5，微信 WebView 做 UA 引导浮层 | §6.5 |
| 大文件支持 | 单文件 100MB，流式上传，不做分片/续传 | §6.4.1 |
| 短码生成 | 8 位 base62 + CSPRNG + 冲突重试 | §3.3 |
| 二维码缓存 | 不缓存，on-the-fly 生成 | §3.2 |
| 文件预览范围 | 仅图片在线预览，PDF/视频直接下载 | Phase 2 |
| 文件类型限制 | 不做白名单；维护可执行文件黑名单（exe/bat/sh/...） | §6.2 |
| 单分享默认配额 | 2GB，创建时可覆盖 | §3.1 |
| 删除策略 | 硬删除 + CASCADE，审计信息由 access_log 承载 | §7.6 |
| 通知机制 | 不做；上传方需告知由创建者主动查看 `/manage` | — |
| 上传进度 | 用 `XMLHttpRequest.upload.onprogress` 实现 | Phase 2 |

---

## 10. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-05-12 | 初版设计 |
| v1.1 | 2026-05-12 | 修正认证流程：拆分公开/受保护路由；按 share_id 隔离 session cookie（itsdangerous 签名）；CSRF 改为双重提交 cookie；明确登录速率限制 |
| v1.2 | 2026-05-12 | 补充：短码冲突重试；流式上传 + 单分享配额 + 全局磁盘水位；StreamingResponse 下载 + RFC 5987 中文名；微信浏览器兼容；APScheduler 过期清理；Nginx 流式代理 + HSTS；统一 100MB 文件大小限制；二维码改 on-the-fly 不缓存 |
| v1.3 | 2026-05-12 | 梳理 §9：把已在设计中落实的议题移入"已决策"，补充 6 项真正需要用户拍板的待确认项（域名、预览范围、类型白名单、配额默认值、软/硬删除、通知） |
| v1.4 | 2026-05-12 | 全部待确认项落定：默认配额改 2GB；新增可执行文件黑名单；新增 §7.5 Cloudflare Tunnel 无域名部署（cloudflared sidecar）；Phase 2 文件预览缩窄为仅图片；§9 转为决策记录表 |

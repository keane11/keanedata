---
title: Docker 笔记
description: Docker 常用命令速查：Dockerfile 最佳实践、Compose 编排、镜像管理
date: 2026-05-14
tags: [Docker, 运维]
order: 2
---

# Docker 笔记

## 常用命令速查

### 镜像管理

```bash
# 构建
docker build -t myapp:latest .
docker build -t myapp:1.0 --no-cache .          # 强制不用缓存
docker build --target builder -t myapp:build .   # 指定多阶段目标

# 查看 / 删除
docker images
docker image ls --filter dangling=true           # 悬空镜像（<none>）
docker rmi myapp:latest
docker image prune -f                            # 删除所有悬空镜像

# 推送 / 拉取
docker tag myapp:latest registry.example.com/myapp:latest
docker push registry.example.com/myapp:latest
docker pull nginx:alpine
```

### 容器管理

```bash
# 运行
docker run -d \
  -p 8080:80 \
  --name myapp \
  --restart unless-stopped \
  -e ENV=production \
  -v $(pwd)/data:/app/data \
  myapp:latest

docker run --rm -it ubuntu:22.04 bash            # 临时交互容器，退出自动删除

# 查看
docker ps -a                                     # 所有容器
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker stats                                     # 实时资源占用
docker inspect myapp                             # 详细配置（JSON）

# 操作
docker logs myapp -f --tail 100                  # 追踪最后 100 行日志
docker exec -it myapp bash                       # 进入运行中的容器
docker exec myapp cat /etc/hosts                 # 不进入容器执行命令
docker cp myapp:/app/config.json ./              # 从容器复制文件

# 停止 / 删除
docker stop myapp
docker rm myapp
docker stop $(docker ps -q) && docker rm $(docker ps -aq)  # 停止并删除所有
```

### 清理

```bash
docker system prune -f           # 删除停止的容器、悬空镜像、未使用网络
docker system prune -af          # 同上，还删除未使用的镜像
docker system df                 # 查看 Docker 占用磁盘
docker volume prune -f           # 删除未使用的卷
```

---

## Dockerfile 最佳实践

### Python 应用示例

```dockerfile
# 多阶段构建：builder 安装依赖，runtime 只保留产物
FROM python:3.12-slim AS builder

WORKDIR /build

# 先复制依赖文件，利用层缓存（依赖不变就不重建）
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── runtime ──────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# 从 builder 拷贝已安装的依赖
COPY --from=builder /install /usr/local

# 复制应用代码（放在依赖之后，改代码不重建依赖层）
COPY . .

# 非 root 用户运行（安全）
RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# 优先使用数组形式（不经过 shell，信号能正确传递）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Node.js 应用示例

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

### 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

### .dockerignore

```dockerignore
.git
.venv
__pycache__
*.pyc
node_modules
.env
.env.*
*.log
dist/
.DS_Store
```

---

## Docker Compose

### 完整示例（Web + DB + Cache）

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:secret@db:5432/mydb
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: '0.5'

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  cache:
    image: redis:7-alpine
    command: redis-server --save 60 1 --maxmemory 128mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
```

### 常用 Compose 命令

```bash
docker compose up -d              # 后台启动
docker compose up -d --build      # 强制重新构建后启动
docker compose pull && docker compose up -d   # 拉取最新镜像后启动

docker compose logs -f app        # 追踪 app 服务日志
docker compose ps                 # 查看服务状态
docker compose exec app bash      # 进入 app 容器

docker compose down               # 停止并删除容器
docker compose down -v            # 同上，还删除 volume（谨慎！）
docker compose restart app        # 重启指定服务

# 查看配置（展开变量后的最终配置）
docker compose config
```

### 环境变量管理

```bash
# .env 文件（compose 自动加载）
POSTGRES_PASSWORD=secret
APP_PORT=8000

# compose.yml 中引用
ports:
  - "${APP_PORT}:8000"
```

---

## 网络

```bash
# 查看网络
docker network ls
docker network inspect bridge

# 创建自定义网络（容器间用服务名互通）
docker network create mynet
docker run -d --network mynet --name db postgres:16
docker run -d --network mynet --name app myapp  # app 可通过 db:5432 访问数据库

# 容器加入多个网络
docker network connect mynet2 myapp
```

---

## 数据卷

```bash
# 命名卷（Docker 管理，推荐用于数据库）
docker volume create pgdata
docker run -v pgdata:/var/lib/postgresql/data postgres

# 绑定挂载（宿主机路径，适合开发热重载）
docker run -v $(pwd):/app myapp

# 只读挂载
docker run -v $(pwd)/config:/app/config:ro myapp

# 查看 / 删除
docker volume ls
docker volume inspect pgdata
docker volume rm pgdata
```

---

## 调试技巧

```bash
# 查看容器内的进程
docker top myapp

# 查看容器详细信息（IP、挂载点、环境变量等）
docker inspect myapp | jq '.[0].NetworkSettings.IPAddress'

# 进入已退出的容器调试
docker run --rm -it --entrypoint sh myapp:latest

# 查看镜像各层大小
docker history myapp:latest

# 用临时容器测试网络连通性
docker run --rm --network mynet nicolaka/netshoot curl http://app:8000/health

# 导出 / 导入镜像（离线传输）
docker save myapp:latest | gzip > myapp.tar.gz
docker load < myapp.tar.gz
```

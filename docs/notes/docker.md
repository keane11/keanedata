# Docker 笔记

## 常用命令速查

```bash
# 镜像
docker build -t myapp:latest .
docker images
docker rmi myapp:latest

# 容器
docker run -d -p 8080:80 --name myapp myapp:latest
docker ps -a
docker logs myapp -f
docker exec -it myapp bash
docker stop myapp && docker rm myapp

# 清理
docker system prune -f
```

## Dockerfile 最佳实践

```dockerfile
# 使用精简基础镜像
FROM python:3.12-slim

WORKDIR /app

# 先复制依赖文件，利用构建缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 非 root 用户运行
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose 示例

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    environment:
      - ENV=production
```

```bash
docker compose up -d
docker compose logs -f
docker compose down
```

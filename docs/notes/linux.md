# Linux 笔记

## 文件与目录

```bash
# 查看
ls -lah                    # 详细列表，显示隐藏文件，人类可读大小
tree -L 2                  # 树形结构，只展开 2 层
find . -name "*.log" -mtime -7   # 找 7 天内修改的 .log 文件

# 操作
cp -r src/ dst/            # 递归复制目录
mv old.txt new.txt         # 重命名 / 移动
rm -rf dir/                # 删除目录（慎用）
ln -s /real/path link      # 创建软链接

# 权限
chmod 755 script.sh        # rwxr-xr-x
chmod +x script.sh         # 添加可执行权限
chown user:group file      # 修改所有者
```

## 文本处理

```bash
# 查看文件
cat file.txt               # 输出全部
less file.txt              # 分页查看（q 退出）
tail -f app.log            # 实时追踪日志
head -n 20 file.txt        # 前 20 行

# grep 搜索
grep -r "keyword" ./src    # 递归搜索
grep -n "error" app.log    # 显示行号
grep -v "debug" app.log    # 排除包含 debug 的行
grep -i "warning" app.log  # 忽略大小写

# awk / sed
awk '{print $1, $3}' file          # 打印第 1、3 列
sed 's/old/new/g' file.txt         # 替换字符串
sed -i 's/localhost/0.0.0.0/g' config.ini  # 原地替换文件
```

## 进程管理

```bash
ps aux | grep python       # 查找进程
top                        # 实时资源监控
htop                       # 更好看的 top（需安装）

kill -9 PID                # 强制终止进程
pkill -f "python app.py"   # 按名称终止

# 后台运行
nohup python app.py &      # 关闭终端后继续运行
jobs                       # 查看后台任务
```

## 网络

```bash
curl -I https://example.com          # 查看响应头
curl -X POST -H "Content-Type: application/json" \
     -d '{"key":"value"}' https://api.example.com

wget -O file.zip https://example.com/file.zip  # 下载文件

ss -tlnp                   # 查看监听端口（替代 netstat）
lsof -i :8080              # 查看占用 8080 端口的进程
```

## 系统信息

```bash
df -h                      # 磁盘使用情况
du -sh ./dir               # 目录大小
free -h                    # 内存使用情况
uname -a                   # 系统信息
cat /etc/os-release        # 发行版信息
uptime                     # 运行时间和负载
```

## Systemd 服务管理

```bash
systemctl status nginx     # 查看服务状态
systemctl start nginx      # 启动
systemctl stop nginx       # 停止
systemctl restart nginx    # 重启
systemctl enable nginx     # 开机自启
systemctl disable nginx    # 禁用自启

journalctl -u nginx -f     # 实时查看服务日志
journalctl -u nginx --since "1 hour ago"  # 最近 1 小时日志
```

## 常用快捷键（Bash）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 终止当前命令 |
| `Ctrl+Z` | 挂起到后台 |
| `Ctrl+R` | 搜索历史命令 |
| `Ctrl+L` | 清屏 |
| `!!` | 重复上一条命令 |
| `!$` | 上一条命令的最后一个参数 |
| `Alt+.` | 插入上一条命令的最后参数 |

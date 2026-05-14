---
title: Linux 笔记
description: Linux 系统管理速查：文件操作、进程管理、网络诊断、Systemd 服务配置
date: 2026-05-14
tags: [Linux]
order: 3
---

# Linux 笔记

## 文件与目录

```bash
# 查看
ls -lah                              # 详细列表，显示隐藏文件，人类可读大小
tree -L 2 --dirsfirst                # 树形结构，仅展 2 层，目录优先
ls -lt | head -10                    # 按修改时间排序，显示最新 10 个

# 操作
cp -r src/ dst/                      # 递归复制
cp -a src/ dst/                      # 保留权限和时间戳
mv old.txt new.txt
rm -rf dir/                          # 删除目录（慎用！）
ln -s /real/path link                # 创建软链接

# 权限
chmod 755 script.sh                  # rwxr-xr-x
chmod +x script.sh
chown -R user:group dir/             # 递归修改所有者
stat file.txt                        # 查看文件详细属性（权限/时间/inode）
```

### find 高级用法

```bash
find . -name "*.log" -mtime -7       # 7天内修改的 .log
find . -name "*.py" -size +1M        # 大于 1MB 的 Python 文件
find . -type f -empty                # 空文件
find . -perm /u+x -type f            # 有执行权限的文件
find . -name "*.tmp" -delete         # 找到并直接删除

# 找到文件后批量处理
find . -name "*.py" -exec wc -l {} +           # 统计所有 Python 文件行数
find . -name "*.log" | xargs rm -f            # 删除找到的文件
find . -name "*.txt" | xargs grep -l "error"  # 含 "error" 的文本文件
```

---

## 文本处理

```bash
# 查看文件
cat file.txt
less file.txt                        # 分页查看（q 退出，/ 搜索）
tail -f app.log                      # 实时追踪日志
tail -n 100 app.log                  # 最后 100 行
head -n 20 file.txt

# grep
grep -r "keyword" ./src             # 递归搜索
grep -rn "error" . --include="*.py" # 显示行号，只搜 Python 文件
grep -v "debug" app.log             # 排除匹配行
grep -i "warning" app.log           # 忽略大小写
grep -E "err|warn|crit" app.log     # 正则，多关键词
grep -A 3 -B 2 "Exception" app.log  # 匹配行的前 2 行和后 3 行（上下文）
grep -c "error" app.log             # 只显示匹配数量
```

### awk / sed

```bash
# awk：按列处理
awk '{print $1, $NF}' file           # 第一列和最后一列
awk -F: '{print $1}' /etc/passwd     # 自定义分隔符
awk '$3 > 100 {print $1}' file       # 条件过滤
awk '{sum += $1} END {print sum}' file  # 求和

# sed：流式编辑
sed 's/old/new/g' file.txt           # 替换（输出，不修改原文件）
sed -i 's/localhost/0.0.0.0/g' config.ini   # 原地修改
sed -n '5,10p' file.txt              # 输出第 5-10 行
sed '/^#/d' config.txt               # 删除注释行
sed 's/[[:space:]]*$//' file.txt     # 删除行尾空白
```

### 排序与统计

```bash
sort -k2 -n file.txt                 # 按第二列数字排序
sort -u file.txt                     # 排序并去重
sort file.txt | uniq -c | sort -rn   # 统计词频并按频次降序
cut -d: -f1 /etc/passwd              # 切割提取字段
wc -l file.txt                       # 行数统计
```

---

## 压缩与归档

```bash
# tar
tar -czf backup.tar.gz dir/          # 压缩归档（gzip）
tar -xzf backup.tar.gz               # 解压
tar -xzf backup.tar.gz -C /target/  # 解压到指定目录
tar -tzf backup.tar.gz | head        # 查看内容不解压

# zip / unzip
zip -r archive.zip dir/
unzip archive.zip -d /target/
unzip -l archive.zip                 # 查看内容

# 其他
gzip file.txt                        # 压缩（生成 file.txt.gz，原文件消失）
gzip -dk file.txt.gz                 # 解压并保留原文件
```

---

## 进程管理

```bash
# 查看
ps aux | grep python                 # 按名称筛选
ps -ef --forest                     # 显示进程树
pgrep -af "python app"               # 更简洁的搜索
top / htop                           # 实时监控

# 终止
kill PID                             # 发送 SIGTERM（优雅退出）
kill -9 PID                          # 发送 SIGKILL（强制终止）
pkill -f "python app.py"             # 按名称批量终止
killall nginx                        # 终止同名所有进程

# 后台运行
nohup python app.py > app.log 2>&1 &    # 后台运行，日志写文件
jobs                                 # 查看当前 shell 的后台任务
fg %1                                # 把任务 1 拉回前台
bg %1                                # 让任务 1 在后台继续

# 定时任务
crontab -e                           # 编辑当前用户的 cron
crontab -l                           # 查看已有任务
```

**cron 表达式格式：**

```
# 分 时 日 月 星期  命令
  0  2  *  *  *    /usr/bin/backup.sh      # 每天 02:00
  */5 *  *  *  *   python check.py         # 每 5 分钟
  0  9  *  *  1    send_report.sh          # 每周一 09:00
```

---

## 网络

```bash
# HTTP 请求
curl -I https://example.com                    # 只看响应头
curl -v https://example.com 2>&1 | head -30    # 详细握手过程
curl -X POST https://api.example.com/data \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"value"}' | jq

wget -O file.zip https://example.com/file.zip  # 下载文件
wget -r -np https://example.com/docs/          # 递归下载

# 端口与连接
ss -tlnp                             # 查看监听端口
ss -anp | grep :8080                 # 查看 8080 端口连接
lsof -i :8080                        # 占用 8080 的进程
netstat -tulnp                       # 同 ss（老系统）

# 连通性测试
ping -c 4 8.8.8.8
traceroute google.com
nc -zv hostname 8080                 # 测试端口是否可达
telnet hostname 80

# DNS 查询
nslookup domain.com
dig domain.com A
dig @8.8.8.8 domain.com
```

### SSH

```bash
ssh user@host -p 2222                # 指定端口登录
ssh -i ~/.ssh/key.pem user@host      # 指定私钥
ssh -L 8080:localhost:80 user@host   # 本地端口转发
ssh -N -f -L 5432:db-host:5432 bastion  # 后台隧道，访问内网数据库

# 免密登录配置
ssh-keygen -t ed25519 -C "your@email.com"
ssh-copy-id user@host                # 复制公钥到服务器

# ~/.ssh/config 多主机管理
Host dev
    HostName 192.168.1.10
    User ubuntu
    Port 22
    IdentityFile ~/.ssh/dev_key
# 之后直接 ssh dev
```

---

## 系统信息与监控

```bash
# 磁盘
df -h                                # 各分区使用情况
du -sh ./dir                         # 目录大小
du -h --max-depth=1 . | sort -rh     # 当前目录各子目录大小排序
lsblk                                # 块设备列表

# 内存
free -h
vmstat 1 5                           # 每 1 秒采样 5 次内存/IO/CPU

# CPU
uptime                               # 负载均值
lscpu                                # CPU 型号和核数
mpstat -P ALL 1                      # 各核 CPU 使用率

# 系统信息
uname -a
cat /etc/os-release
cat /proc/version
hostname -I                          # 查看 IP 地址
```

---

## Systemd 服务管理

### 常用命令

```bash
systemctl status nginx
systemctl start / stop / restart / reload nginx
systemctl enable / disable nginx      # 开机自启

journalctl -u nginx -f                # 实时日志
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx --since "2026-05-14" --until "2026-05-15"
journalctl -p err -u nginx            # 只看 error 级别
journalctl --disk-usage               # 日志占用磁盘
```

### 编写自定义 Service

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My FastAPI App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload          # 重新加载配置（修改 service 文件后必须执行）
sudo systemctl enable --now myapp     # 启用并立即启动
```

---

## 用户与权限

```bash
# 用户管理
useradd -m -s /bin/bash username      # 创建用户并创建家目录
passwd username                       # 设置密码
usermod -aG sudo username             # 加入 sudo 组
userdel -r username                   # 删除用户及家目录
id username                           # 查看用户 ID 和所属组
groups username

# sudo 免密配置
# /etc/sudoers.d/deploy
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart myapp
```

---

## 快捷键（Bash / Zsh）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 终止当前命令 |
| `Ctrl+Z` | 挂起到后台 |
| `Ctrl+R` | 反向搜索历史命令 |
| `Ctrl+L` | 清屏（等价于 clear） |
| `Ctrl+A` / `Ctrl+E` | 移到行首 / 行尾 |
| `Ctrl+W` | 删除光标前的一个单词 |
| `Alt+.` | 插入上一条命令的最后一个参数 |
| `!!` | 重复上一条命令 |
| `!$` | 上一条命令的最后参数 |
| `!string` | 执行最近一条以 string 开头的命令 |

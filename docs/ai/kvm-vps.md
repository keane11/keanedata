---
title: KVM VPS搭建使用流程
date: 2026-05-28
order: 99
---

# KVM VPS 部署完整流程文档

> 一台美国 KVM VPS 从选购、初始化到部署 VPN(WireGuard + Xray)及 AI Agent 环境的完整记录。
> 适用于个人用途:**固定干净的美国出口 IP + 跑调用云端 API 的 AI Agent**。

---

## 目录

1. [需求与目标](#一需求与目标)
2. [服务器选购](#二服务器选购)
3. [SSH 登录](#三ssh-登录)
4. [系统初始化](#四系统初始化)
5. [安全加固](#五安全加固)
6. [部署 WireGuard(方案一)](#六部署-wireguard方案一)
7. [部署 Xray VLESS+Reality(方案二)](#七部署-xray-vlessreality方案二)
8. [常见故障排查](#八常见故障排查)
9. [端口优化(改 443)](#九端口优化改-443)
10. [部署 AI Agent 环境](#十部署-ai-agent-环境)
11. [常用命令速查](#十一常用命令速查)
12. [安全注意事项](#十二安全注意事项)

---

## 一、需求与目标

| 需求 | 说明 |
|------|------|
| 固定美国出口 IP | 独享、不跳变、不和别人共享,避免 AI 平台因 IP 频繁切换封号 |
| 个人隐私/加密流量 | 自建可控,无第三方记录 |
| 跑 AI Agent | 在 VPS 本地运行调用 Claude/GPT/DeepSeek 等云端 API 的 Agent |

**关键认知:**
- ECS/VPS 是**机房 IP**,不是住宅 IP。若必须住宅 IP 需另想办法;本方案目标是固定干净的机房 IP,已足够解决封号问题。
- Agent 在 VPS 本地跑,出站请求**天然走 VPS 的美国 IP**,与客户端用什么 VPN 协议无关。

---

## 二、服务器选购

### 最终选择:RackNerd KVM VPS

| 配置项 | 参数 |
|--------|------|
| CPU | 3 核 |
| 内存 | 4 GB |
| 硬盘 | 60 GB SSD (RAID-10) |
| 流量 | 7000 GB/月 |
| 带宽 | 1 Gbps |
| IP | 1 个独立 IPv4 |
| 机房 | 洛杉矶 DC03(西海岸,国内延迟低) |
| 系统 | Ubuntu 22.04 64位 |
| 价格 | **$59.99/年**(续费同价不涨) |

### 选购要点

- **配置别买高**:纯 VPN 用 1 核 1G 足够;要跑 Agent + Docker,2-4G 内存更稳妥。
- **机房选西海岸**:洛杉矶 / 圣何塞 / 西雅图,国内延迟最低(实测约 178ms)。避开中部(芝加哥)。
- **必须 KVM 虚拟化**(不要 OpenVZ):KVM 有独立内核,才能装 WireGuard、跑 Docker。
- **选 Linux 不要 Windows VPS**:WireGuard/Docker/Agent 都是 Linux 生态,Windows 还多占 2-3G 内存且更贵。
- **付款**:支持支付宝/银联,国内用户用支付宝最方便。
- **优惠码**:`xxOFFDEDI` 类带 `DEDI` 的码只对专用服务器有效,对 VPS 无效。特价 VPS 本身已是最低价。

### 下单前实测延迟(可选)

用商家给的测试 IP,在本地 ping 确认线路:

```bash
ping 107.174.51.158    # 洛杉矶 DC03
ping 192.3.253.2       # 西雅图
ping 198.23.228.15     # 芝加哥
```

国内到西海岸 150-200ms、低丢包为正常。

---

## 三、SSH 登录

下单付款后,邮件会包含:**服务器 IP、root 密码、SolusVM 面板地址**。

### 登录命令

```bash
ssh root@你的服务器IP
```

- 首次连接提示 `Are you sure you want to continue connecting` → 输入 `yes` 回车。
- 提示 `password:` → 输入 root 密码(**输入时不显示任何字符,属正常**,建议右键粘贴)。
- 看到 `root@主机名:~#` 即登录成功。

### 防止 SSH 闲置断线(可选)

```bash
ssh -o ServerAliveInterval=60 root@你的服务器IP
```

每 60 秒发心跳包,避免闲置被断开(`Connection closed by remote host` 多为闲置超时,重连即可,服务器无恙)。

---

## 四、系统初始化

```bash
# 更新系统
apt update && apt upgrade -y

# 设置时区
timedatectl set-timezone America/Los_Angeles

# 加 2G swap(跑 Agent 防止内存爆掉进程被杀)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 确认 swap 生效(应看到 Swap 行有数值)
free -h
```

### 更新时遇到的交互弹窗(蓝紫色框)

| 弹窗 | 处理 |
|------|------|
| `Pending kernel upgrade`(新内核可用) | 按 **回车** 选 `<Ok>` |
| `Which services should be restarted?` | 直接选 `<Ok>`(用默认勾选,**不要选 Cancel**) |
| 配置文件 keep/install | 选 **keep**(保留当前) 或回车 |

### 更新后重启(让新内核生效)

```bash
reboot
```

等 1-2 分钟后重连(重启期间出现 `Connection closed`/`timed out` 属正常,多试几次):

```bash
ssh root@你的服务器IP
uname -r        # 确认新内核已生效
```

### 清理旧内核(可选)

```bash
apt autoremove -y
```

---

## 五、安全加固

> 公网服务器会被全网自动扫描爆破,安全加固是必须项。

### 5.1 修改 root 密码

```bash
passwd
```

输两次新密码。**务必用强密码**(12 位以上,大小写+数字+符号)。可用易记句变形,如 `Wo-Mai-Le-VPS-2026!`。

### 5.2 配置防火墙 ufw

> ⚠️ **顺序极重要**:必须先放行 SSH(22)再 `enable`,否则会把自己锁在外面。

```bash
# 装防火墙
apt install ufw -y

# 先放行 SSH(必须!)
ufw allow 22/tcp

# 放行 WireGuard
ufw allow 51820/udp

# 开启(提示 y/n 输 y;因已放行22,不会真的断连)
ufw enable

# 查看规则
ufw status
```

期望输出:

```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
51820/udp                  ALLOW       Anywhere
```

> **每新增一个对外服务,都要记得放行对应端口**(这是后面 Xray 连不上的根因)。

### 5.3 防暴力破解 fail2ban(推荐)

```bash
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban
```

默认配置即可用,自动封禁多次失败的 IP。

### 5.4 SSH 密钥登录(可选,最安全)

在**本地电脑** PowerShell:

```powershell
# 生成密钥
ssh-keygen -t ed25519

# 上传公钥到服务器
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@你的服务器IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

之后免密登录。

---

## 六、部署 WireGuard(方案一)

> WireGuard 速度最快,但协议特征明显,国内部分网络可能干扰。作为**备用方案**保留。

### 安装

```bash
apt install wireguard -y

wget https://git.io/wireguard -O wireguard-install.sh
chmod +x wireguard-install.sh
bash wireguard-install.sh
```

### 脚本交互(大部分回车默认)

| 提问 | 填写 |
|------|------|
| Public IPv4 | 自动检测,回车 |
| Public interface | 通常 eth0,回车 |
| Interface name | wg0,回车 |
| Server port | 51820,回车(与防火墙一致) |
| Client name | 自定义,如 `rknvpn` |
| DNS resolver | 选 `3`(1.1.1.1)或 `2`(Google) |

### 取出客户端配置

配置文件生成在 `/root/客户端名.conf`(如 `/root/rknvpn.conf`)。

```bash
# 手机扫码
apt install qrencode -y
qrencode -t ansiutf8 < /root/rknvpn.conf

# 电脑用,复制内容
cat /root/rknvpn.conf
```

### 客户端连接

- **手机**:装 **WireGuard 官方 App** → 扫二维码。
- **电脑**:[wireguard.com/install](https://www.wireguard.com/install/) 下载 → 导入 `.conf` 或新建空隧道粘贴内容。

> WireGuard **没有 URL/链接**,只用配置文件;且只能用 WireGuard App 连,不能导入 Shadowrocket。

### 验证

连上后访问 `ip.sb` 或 `curl ip.sb`,显示 VPS 美国 IP 即成功。

---

## 七、部署 Xray VLESS+Reality(方案二)

> **抗封锁能力最强**(伪装成正常 HTTPS),Shadowrocket / v2rayN / Clash 全平台支持。多设备首选。

### 安装(233boy 一键脚本)

```bash
bash <(wget -qO- https://github.com/233boy/Xray/raw/main/install.sh)
```

按提示选 **VLESS+Reality**,其余默认。脚本完成后生成 `vless://` 链接 + 二维码。

### 放行端口(关键!)

脚本会分配一个端口(如 31025),**必须放行**否则连不上:

```bash
ufw allow 你的端口/tcp
ufw status
```

### 各设备客户端

| 平台 | 客户端 | 导入方式 |
|------|--------|----------|
| iPhone/iPad | **Shadowrocket** | 复制 vless 链接,App 自动识别剪贴板 / 扫码 |
| 安卓 | v2rayNG / Clash Meta | 右上 + → 从剪贴板导入 / 扫码 |
| Windows | v2rayN / Clash Verge | 从剪贴板导入 |
| Mac | ClashX / Shadowrocket(Mac版) | 从剪贴板导入 |

> 同一个 vless 链接,所有设备通用。

### 验证

客户端连上后访问 `ip.sb`,显示 VPS 美国 IP 即成功。

> WireGuard 与 Xray **可共存**(不同端口互不干扰),互为备用。

---

## 八、常见故障排查

### 8.1 客户端"已连接"但上不了网

按顺序排查:

```bash
# 1. 端口是否放行(最常见原因!)
ufw status
ufw allow 你的端口/tcp        # 没放行就补上

# 2. Xray 服务是否运行
systemctl status xray         # 应为 active (running)

# 3. 端口是否在监听
ss -tlnp | grep 你的端口       # 应有 LISTEN

# 4. 看日志报错
journalctl -u xray -n 30 --no-pager
```

**客户端侧检查**:
- Shadowrocket → 设置 → 全局路由 → 选 **"代理"**(不是"直连")。
- 节点前面有勾,顶部开关打开。
- 改过配置后,删旧节点重新导入新链接。

### 8.2 SSH 断开 `Connection closed by remote host`

- 多为**闲置超时**,直接重连即可,服务器无恙。
- 改 Xray 端口**不影响 SSH**(SSH 走 22,与 Xray 端口无关)。
- 重连不上 → 等 1-2 分钟;仍不行 → RackNerd 面板用 **VNC/Console** 进系统。

### 8.3 延迟测试不准(显示 0ms 或异常高)

- **0ms / 极低**:说明 VPN 没关干净,ping 包没真正出国。**完全关闭所有代理**后再测。
- **Shadowrocket 测速偏高(如 376ms)**:那是"完整代理往返"(你→VPS→测试站+握手),不是线路延迟。
- **真实线路延迟**以 **断开 VPN 后 ping VPS IP** 为准:

```bash
ping 你的服务器IP
```

国内→洛杉矶 150-200ms、0 丢包为正常(本机实测 178ms / 0% 丢包,线路良好)。

---

## 九、端口优化(改 443)

> Reality 用非 443 端口可能被 GFW 盯上(脚本日志会警告)。改 443 伪装成正常 HTTPS,高峰期更稳。**非必须,现状能用可不改。**

### 步骤

```bash
# 1. 进 233boy 管理菜单
v2ray            # 或 xray

# 2. 选"更改配置" → 找到"端口" → 输入 443
#    (菜单编号因版本而异,不确定就看菜单提示)

# 3. 放行 443
ufw allow 443/tcp
ufw status
```

### 更新客户端

改端口后**旧链接作废**:
1. 客户端删掉旧节点。
2. 导入脚本新生成的 443 链接。
3. 连接测试 `ip.sb`。

> 改完连不上,99% 是忘了 `ufw allow 443/tcp`。

---

## 十、部署 AI Agent 环境

> Agent 在 VPS 本地跑,出站调 API 走 VPS 美国 IP,与客户端 VPN 协议无关。

### 10.1 装 Node.js(用 nvm)

```bash
# 装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 装 Node LTS
nvm install --lts
nvm use --lts

# 验证
node -v
npm -v
```

> 本机在美国,访问 GitHub raw 无障碍。

### 10.2 装 Docker(如需容器化运行)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

### 10.3 全局安装 Agent 工具

```bash
npm install -g @anthropic-ai/claude-code     # Claude Code
npm install -g @openai/codex                  # Codex CLI
# 其他工具按各自官方 npm 包名安装
```

### 10.4 配置 API Key(环境变量)

```bash
nano ~/.bashrc

# 文件末尾加入(替换为真实 key):
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
export OPENAI_API_KEY="sk-xxxxx"
export DEEPSEEK_API_KEY="sk-xxxxx"

# 保存退出(Ctrl+O 回车,Ctrl+X),使生效
source ~/.bashrc
echo $ANTHROPIC_API_KEY     # 验证
```

### 10.5 后台常驻运行(tmux)

```bash
apt install tmux -y

tmux new -s agent          # 新建会话
# 在里面运行 Agent...
# Ctrl+B 再按 D 脱离会话(Agent 继续后台跑)

tmux attach -t agent       # 重新接管会话
```

---

## 十一、常用命令速查

### 系统/资源

```bash
free -h                    # 内存/swap
df -h                      # 磁盘
top                        # 实时资源(q 退出)
uname -r                   # 内核版本
```

### 防火墙

```bash
ufw status                 # 查看规则
ufw allow 端口/tcp          # 放行端口
ufw delete allow 端口/tcp   # 删除规则
```

### Xray(233boy)

```bash
v2ray                      # 管理菜单
systemctl status xray      # 服务状态
systemctl restart xray     # 重启
journalctl -u xray -n 30 --no-pager   # 日志
ss -tlnp | grep 端口        # 端口监听
```

### WireGuard

```bash
wg show                    # 连接状态
wg-quick up wg0            # 启动
wg-quick down wg0          # 停止
qrencode -t ansiutf8 < /root/rknvpn.conf   # 重新显示二维码
```

### 验证出口 IP

```bash
curl ip.sb                 # 当前出口 IP
```

---

## 十二、安全注意事项

1. **API Key 不外泄**:只放环境变量,不硬编码、不提交 GitHub。`.env`、`.bashrc` 加入 `.gitignore`。
2. **VLESS/SS 链接含密钥**:链接里的 `uuid`、`pbk` 是私密信息,**不要公开发出**。若已泄露,用 `v2ray` 菜单**重新生成 UUID 和密钥**,换新链接。
3. **本文档不要写入密码/密钥/完整链接**:仅记录流程,敏感信息单独安全保管。
4. **API 用量监控**:Agent 高频调 API 可能产生费用,在各平台后台设**消费上限**。
5. **数据备份**:重要 Agent 代码用 Git 同步,配置文件本地留份;别把唯一数据只放 VPS。
6. **强密码 + fail2ban + 密钥登录**:三管齐下,公网服务器基本安全。

---

## 部署进度清单

- [x] 服务器选购(RackNerd 3核4G / 洛杉矶 / Ubuntu 22.04)
- [x] SSH 登录
- [x] 系统初始化(更新 / 时区 / swap 4G / 重启)
- [x] 改 root 密码
- [x] 防火墙 ufw(22 / 51820)
- [x] WireGuard 部署(备用)
- [x] Xray VLESS+Reality 部署(Shadowrocket,线路 178ms / 0 丢包)
- [ ] 端口优化改 443(可选)
- [ ] Node.js + AI Agent 环境

---

*文档整理:个人 KVM VPS 部署流程备忘。后续在新机器上可直接照此重做。*


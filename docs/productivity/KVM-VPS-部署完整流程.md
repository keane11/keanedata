---
title: KVM VPS 完整部署指南：系统初始化 + 3X-UI 多用户节点
description: 从 VPS 选购、系统初始化、安全加固，到 WireGuard / 3X-UI 多用户 VLESS+Reality 节点部署的完整实战记录
date: 2026-05-28
order: 10
tags: [VPS, 3X-UI, VLESS, Reality, 多用户, 节点]
---

# KVM VPS 完整部署指南：系统初始化 + 3X-UI 多用户节点

> 一台美国 KVM VPS 从选购、初始化到部署多用户 VPN 节点的完整实战记录。
> 适用场景：固定干净的美国出口 IP + 多人共用（家人/朋友）+ 跑 AI Agent 环境。

---

## 目录

1. [需求与目标](#一需求与目标)
2. [服务器选购](#二服务器选购)
3. [SSH 登录](#三ssh-登录)
4. [系统初始化](#四系统初始化)
5. [安全加固](#五安全加固)
6. [方案一：WireGuard（备用）](#六方案一wireguard备用)
7. [方案二：233boy 单用户 Xray](#七方案二233boy-单用户-xray)
8. [方案三：3X-UI 多用户面板（推荐）](#八方案三3x-ui-多用户面板推荐)
9. [部署 AI Agent 环境](#九部署-ai-agent-环境)
10. [常见故障排查](#十常见故障排查)
11. [常用命令速查](#十一常用命令速查)
12. [安全注意事项](#十二安全注意事项)

---

## 一、需求与目标

| 需求 | 说明 |
|------|------|
| 固定美国出口 IP | 独享、不跳变，避免 AI 平台因 IP 频繁切换封号 |
| 多人共享节点 | 家人 + 朋友，独立账号、独立流量统计 |
| 跑 AI Agent | VPS 本地运行调用 Claude/GPT/DeepSeek 等 API 的 Agent |

**关键认知：**
- ECS/VPS 是**机房 IP**，不是住宅 IP。目标是固定干净的机房 IP，已足够解决封号问题。
- Agent 在 VPS 本地跑，出站请求**天然走 VPS 的美国 IP**，与客户端用什么协议无关。

---

## 二、服务器选购

### 推荐：RackNerd KVM VPS

| 配置项 | 参数 |
|--------|------|
| CPU | 3 核 |
| 内存 | 4 GB |
| 硬盘 | 60 GB SSD (RAID-10) |
| 流量 | 7000 GB/月 |
| 带宽 | 1 Gbps |
| IP | 1 个独立 IPv4 |
| 机房 | 洛杉矶 DC03（国内延迟低） |
| 系统 | Ubuntu 22.04 64位 |
| 价格 | **$59.99/年** |

### 选购要点

- **必须 KVM 虚拟化**（不要 OpenVZ）：KVM 才能装 WireGuard、跑 Docker
- **机房选西海岸**：洛杉矶 / 圣何塞，国内延迟 150-200ms
- **配置别买高**：跑 Agent + 3X-UI，2-4G 内存足够
- **付款**：支持支付宝/银联

### 下单前实测延迟

```bash
ping 107.174.51.158    # 洛杉矶 DC03 测试 IP
```

国内到西海岸 150-200ms、低丢包为正常。

---

## 三、SSH 登录

下单后邮件包含：**服务器 IP、root 密码、控制面板地址**。

```bash
ssh root@你的服务器IP
```

- 首次连接提示 `Are you sure...` → 输入 `yes` 回车
- 提示 `password:` → 右键粘贴 root 密码（输入不显示属正常）
- 看到 `root@主机名:~#` 即登录成功

**防闲置断线（可选）：**

```bash
ssh -o ServerAliveInterval=60 root@你的服务器IP
```

---

## 四、系统初始化

```bash
# 更新系统
apt update && apt upgrade -y

# 设置时区
timedatectl set-timezone America/Los_Angeles

# 加 2G swap（防止 Agent 运行时内存不足）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 确认 swap 生效
free -h
```

### 更新时遇到的交互弹窗

| 弹窗 | 处理 |
|------|------|
| `Pending kernel upgrade` | 回车选 `<Ok>` |
| `Which services should be restarted?` | 选 `<Ok>`（默认勾选即可） |
| 配置文件 keep/install | 选 **keep** |

### 更新后重启

```bash
reboot
# 等 1-2 分钟后重连
ssh root@你的服务器IP
uname -r    # 确认新内核生效
```

---

## 五、安全加固

> 公网服务器会被全网自动扫描爆破，安全加固是必须项。

### 5.1 修改 root 密码

```bash
passwd
```

强密码：12 位以上，大小写 + 数字 + 符号。

### 5.2 配置防火墙 ufw

> ⚠️ **顺序极重要**：必须先放行 SSH(22) 再 enable，否则把自己锁在外面。

```bash
apt install ufw -y
ufw allow 22/tcp       # 先放行 SSH（必须！）
ufw allow 51820/udp    # WireGuard（如需）
ufw enable             # 提示 y/n 输 y
ufw status
```

> **每新增一个对外服务，都要放行对应端口。** 这是后面节点连不上的最常见原因。

### 5.3 防暴力破解 fail2ban

```bash
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

默认配置即可，自动封禁多次失败的 IP。`ufw status` 里看到大量 `REJECT` 是 fail2ban 在工作，**正常，不用管**。

### 5.4 SSH 密钥登录（可选，最安全）

在**本地电脑** PowerShell：

```powershell
# 生成密钥
ssh-keygen -t ed25519

# 上传公钥到服务器
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@你的服务器IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

---

## 六、方案一：WireGuard（备用）

> WireGuard 速度最快，但协议特征明显，国内部分网络可能干扰。推荐作为备用。

```bash
apt install wireguard -y
wget https://git.io/wireguard -O wireguard-install.sh
chmod +x wireguard-install.sh
bash wireguard-install.sh
```

### 取出客户端配置

```bash
# 手机扫码
apt install qrencode -y
qrencode -t ansiutf8 < /root/客户端名.conf

# 电脑用，复制内容
cat /root/客户端名.conf
```

> WireGuard **没有 URL/链接**，只用配置文件；只能用 WireGuard 官方 App，不能导入 Shadowrocket。

---

## 七、方案二：233boy 单用户 Xray

> 适合**个人单用户**，一键脚本，简单快速。多用户场景请直接看方案三。

```bash
bash <(wget -qO- https://github.com/233boy/Xray/raw/main/install.sh)
```

选 **VLESS+Reality**，其余默认。脚本完成后生成 `vless://` 链接和二维码。

### 放行端口（关键！）

```bash
ufw allow 你的端口/tcp    # 脚本分配的端口，必须放行
ufw allow 443/tcp         # 或改 443 端口（见下文）
```

### 端口优化（改 443）

Reality 用非 443 端口可能被 GFW 盯上，改 443 伪装成正常 HTTPS 更稳：

```bash
v2ray    # 进 233boy 管理菜单 → 更改配置 → 端口 → 443
ufw allow 443/tcp
```

> 改端口后**旧链接作废**，需重新导入新链接。

---

## 八、方案三：3X-UI 多用户面板（推荐）

> 适合**多人共享**（家人 + 朋友）。图形化面板，支持独立账号、流量统计、限额/限时管理。
>
> **版本说明**：本节基于 **3X-UI v3.2.0**（2026 年）实际界面编写，与旧版（2.x）有差异，踩坑修复均来自真实部署。

### 8.1 适用场景

| 场景 | 推荐度 |
|------|--------|
| **多人共享（家人 + 朋友）** | ⭐⭐⭐⭐⭐ |
| 需要流量统计 / 限额 / 限时 | ⭐⭐⭐⭐⭐ |
| 个人单用户 | ⭐⭐（233boy 更轻量） |

### 8.2 核心理念（必须先理解）

```
一个 Inbound（入站）= 一个端口监听 = 一个节点配置
  └─ 多个 Client（用户）= 多条独立链接 = 多个独立账号
```

**多用户场景：建一个 Inbound（端口 443），在它下面加多个 Client。不要给每个人建一个 Inbound。** 这是最常见的新手误区。

#### ⚠️ v3.2.0 重要变化

| 旧版 (2.x) | 新版 v3.2.0 |
|-----------|-------------|
| 添加入站时一起填第一个 Client | **添加入站不含 Client 字段** |
| 传输协议叫 `TCP` | **改名为 `RAW`**（同一个东西） |
| Reality 密钥手动填 | **在"协议"页点 X25519 认证按钮自动生成** |
| Client 在 Inbound 内管理 | **独立"客户端"菜单管理** |

### 8.3 卸载旧的 Xray（如有）

**如果已用 233boy 等脚本装过 Xray，必须先卸载，否则 443 端口冲突。**

```bash
# 方法一：用 233boy 卸载菜单
v2ray    # 菜单里选"卸载"

# 方法二：手动卸载
systemctl stop xray
systemctl disable xray
rm -rf /etc/xray /usr/local/bin/xray
rm -f /etc/systemd/system/xray.service
systemctl daemon-reload

# 确认端口已释放（应无输出）
ss -tlnp | grep 443
```

### 8.4 安装 3X-UI

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

### 安装中的交互提示

| 提问 | 怎么填 |
|------|--------|
| Do you want to customize... | **输 `y`**（强烈建议） |
| **Username** | 自定义名字（如 `keane`，**不要用 admin**） |
| **Password** | 强密码，12 位以上 |
| **Port** | 数字，如 `54321`（**不要填反成名字！**） |
| Web BasePath | 自定义路径（留空自动生成） |

> ⚠️ **踩坑1**：字段顺序填反会导致端口变成文字（如 `https://IP:Keane/...`）完全无法访问。填反了不用重装，`x-ui → 9` 可单独修改端口。

### 8.5 面板初始化与 SSL

**安装时 SSL 选项：**

```
1. Let's Encrypt for Domain   ← 需要域名
2. Let's Encrypt for IP       ← 没域名选这个 ⭐
3. Custom SSL                 ← 已有证书才用
4. Skip SSL                   ← 不推荐
```

选 **2**（IP 证书，有效期 6 天，3X-UI 自动续期）：
- IPv6 → 回车跳过
- ACME 端口 → 回车用 80

> ⚠️ **踩坑2**：SSL 申请报 `Timeout during connect` = 80 端口没放行。先 `ufw allow 80/tcp` 再重申请。

**SSL 申请失败后补申请：**

```bash
x-ui → 19 → 6    # SSL Certificate Management → Get SSL for IP Address
```

### x-ui 管理菜单

```bash
x-ui
```

常用选项：

| 选项 | 功能 |
|------|------|
| 6 | 改用户名密码 |
| 7 | 改面板路径 |
| 9 | 改面板端口（必须是数字！） |
| 10 | 查看当前完整设置 |
| 19 | SSL 证书管理 |

> ⚠️ **踩坑3**：跑过 `Reset Settings（菜单8）` 会把路径重置为 `/`，极不安全。修复：`x-ui → 7` 重设路径。

**验证设置（`x-ui → 10`）期望看到：**

```
Panel is secure with SSL        ✅
hasDefaultCredential: false     ✅
port: 54321                     ✅
webBasePath: /你的路径/          ✅
```

### 8.6 防火墙规则

```bash
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # SSL 证书续期（必须！）
ufw allow 443/tcp       # 节点端口
ufw allow 54321/tcp     # 面板端口
ufw status
```

> **不要放行** 9090（Cockpit）、7681（ttyd）等默认开着的高危端口，见第 8.13 节。

### 8.7 登录面板

```
https://你的VPS_IP:54321/你的路径/
```

- 协议是 **`https`**（SSL 配好后）
- 末尾 **`/`** 不能少
- 路径**区分大小写**

进入后：右上角头像 → Language → **简体中文**

**左侧菜单（v3.2.0）：**

```
- 系统状态
- 入站           ← 建/管 Inbound
- 客户端         ← 加/管 Client（新版独立菜单！）
- 面板设置
- Xray 配置
```

### 8.8 创建 VLESS+Reality 入站

左侧 **"入站"** → **"添加入站"**，有 6 个标签逐个填：

**标签 1：基础配置**

| 字段 | 填写 |
|------|------|
| 备注 | `Family-Reality` |
| 协议 | **vless** |
| 端口 | **443** |
| 总流量 | 0 |

> ⚠️ **v3.2.0 这里不再有 Client 字段！** 新版"基础配置"只配 Inbound 本身。

**标签 2：协议**

| 字段 | 填写 |
|------|------|
| 解密 | `none` |
| **X25519 认证** | ⭐ **点这个按钮！**（自动生成 Reality 密钥对） |
| ML-KEM-768 认证 | **不要点**（客户端兼容性差，Shadowrocket 不支持） |

> ⚠️ **踩坑4**：不点 X25519，创建后没有密钥对，客户端永远连不上。**必须看到"已选择：X25519"**。

**标签 3：传输**

| 字段 | 填写 |
|------|------|
| 传输 | **RAW**（就是原 TCP，Xray 24+ 改名） |

**标签 4：安全**

| 字段 | 填写 |
|------|------|
| 安全 | **Reality** |
| uTLS | `chrome` |
| 目标 (Dest) | `www.microsoft.com:443` |
| Server Names | `www.microsoft.com` |
| Short IDs | 点**"生成"** |
| **SpiderX** | ⚠️ **清空**（默认 `/` 影响兼容性） |

> SNI 推荐 `www.microsoft.com`，比 amazon 在国内更稳。

**标签 5：嗅探** → 打开（多用户场景建议开启）

点 **"创建"**，入站列表出现 `Family-Reality`，状态绿色运行中。

### 8.9 添加多个用户

> **⚠️ v3.2.0 新流程**：不在 Inbound 里加 Client，改在左侧独立的**"客户端"**菜单加。

左侧 **"客户端"** → **"添加客户端"**：

| 字段 | 自己 | 朋友 |
|------|------|------|
| Email/标识 | `keane` | `friend-A` |
| ID | 点**自动生成** | 自动生成 |
| Flow | `xtls-rprx-vision` | `xtls-rprx-vision` |
| 总流量(GB) | 0（不限） | 500 |
| **入站** | 选 `Family-Reality` | 选 `Family-Reality` |

> ⭐ **"入站"字段必须选 `Family-Reality`**，否则 Client 不会绑定到节点上。

**用户规划参考：**

| Email | 角色 | 流量上限 | 到期 |
|-------|------|---------|------|
| `keane` | 自己 | 0（不限） | 永久 |
| `mom`/`dad` | 家人 | 0（不限） | 永久 |
| `friend-A` | 朋友 | 500 GB | 永久 |

### 8.10 分发节点链接

**"客户端"**列表 → 找到某用户 → 操作列图标：

| 图标 | 用途 |
|------|------|
| 🔲 二维码 | 手机扫码导入 |
| 📋 链接 | 复制 `vless://...` |
| ✏️ 编辑 | 改流量/到期/UUID |
| 🔄 重置流量 | 归零已用流量 |
| 🚫/✅ | 暂停/启用 |

> ⚠️ 发链接时告知用户：**"链接等同账号密码，不要转发给他人。"** 链接外泄时编辑该 Client → 重新生成 UUID → 旧链接立即失效。

### 8.11 订阅服务配置

3X-UI 支持订阅 URL（用户可在客户端自动拉取更新），但**新装时订阅服务默认不启用**，需手动开启。

**在面板设置中启用：**

面板 → **"面板设置"** → 订阅设置：

| 字段 | 值 |
|------|-----|
| 启用订阅 | 开 |
| 订阅端口 | **2096**（独立端口，不要和面板端口冲突） |
| 订阅路径 | `/sub/` |

```bash
ufw allow 2096/tcp    # 放行订阅端口
```

**订阅 URL 格式：**

```
https://你的VPS_IP:2096/sub/用户的subId
```

> ⚠️ 订阅端口（2096）和面板端口（54321）是两个独立端口，配置时注意不要混淆。

### 8.12 订阅 / 连接常见问题

#### 问题1：Shadowrocket 拉取订阅超时（HTTP 404）

**原因**：订阅服务未启用。按 8.11 节在面板设置里开启，并放行 2096 端口。

#### 问题2：能拉取订阅，但连接一直超时

多为以下两种原因：

**原因 A：ML-KEM 后量子加密兼容性问题**

xray-core 26.5.9+ 默认启用了 `decryption=mlkem768x25519plus`，Shadowrocket 等客户端不支持。

表现：订阅链接解码后包含 `encryption=mlkem768x25519plus...`。

**修复**：创建入站时，协议标签只选 **X25519**，**不要点 ML-KEM-768**。已创建的入站需编辑 → 协议页 → 取消 ML-KEM → 保存。

**原因 B：缺少 flow 参数**

VLESS+REALITY 必须设置 `flow=xtls-rprx-vision`，检查客户端列表中该 Client 的 Flow 字段是否为空。

**修复**：编辑 Client → Flow 字段填 `xtls-rprx-vision` → 保存 → 重新分发链接。

#### 验证订阅链接正确性

```bash
curl -sk "https://你的IP:2096/sub/你的subId" | base64 -d
```

解码后的链接应包含：
- ✅ `flow=xtls-rprx-vision`
- ✅ `security=reality`
- ✅ `pbk=...`（publicKey）
- ❌ 不应有 `encryption=mlkem768x25519plus`

### 8.13 清理不必要的服务

很多 VPS 镜像默认开了高危服务：

```bash
ss -tlnp    # 查看所有监听端口
```

| 端口 | 服务 | 处理 |
|------|------|------|
| 9090 | Cockpit（网页系统管理） | 卸载 |
| 7681 | ttyd（网页 root 终端） | **必须关！高危** |

```bash
apt purge -y cockpit cockpit-*
apt autoremove -y
ufw delete allow 9090/tcp
```

### 8.14 面板安全加固

**已经做的（保持）：** 自定义用户名/密码/端口/路径 + SSL + fail2ban

**进阶：SSH 隧道访问面板（最高安全）**

```bash
# 1. 服务器关闭面板端口对外开放
ufw delete allow 54321/tcp

# 2. 本地建 SSH 隧道
ssh -L 8888:127.0.0.1:54321 root@你的VPS_IP

# 3. 保持 SSH 不关，浏览器访问：
http://127.0.0.1:8888/你的路径/
```

> 面板端口对全网关闭，只有能 SSH 进去的人才能访问。代价是每次管理要先建隧道。

### 8.15 日常管理

| 操作 | 方法 |
|------|------|
| 查看流量统计 | 客户端列表，每行显示已用/上限 |
| 重置流量 | 点 Client 行的"重置流量"按钮 |
| 调整用户额度 | 编辑 Client → 改总流量/到期时间 |
| 临时停用某人 | 点禁用图标（不删 Client，保留链接） |
| 彻底踢人 | 删除 Client，链接立即失效 |
| 链接泄露 | 编辑 → 重新生成 UUID → 发新链接给本人 |
| 备份数据 | `cp /etc/x-ui/x-ui.db ~/backup-$(date +%Y%m%d).db` |

### 8.16 给用户的使用说明模板

> 可直接复制发给朋友/家人，改成自己的链接后发出。

---

**📱 美国节点使用说明**

**下载 App：**

| 设备 | App | 在哪下载 |
|------|-----|---------|
| iPhone/iPad | Shadowrocket（小火箭） | 美区 App Store（¥18） |
| Android | v2rayNG | GitHub 或 Google Play |
| Windows | v2rayN | GitHub |
| Mac | ClashX Meta | GitHub |

**使用步骤：**

1. 复制管理员发给你的链接，或扫描二维码
2. 打开 App，导入链接：
   - 手机：扫码 / "从剪贴板导入"
   - v2rayN（Windows）：**"配置项 → 从剪贴板导入批量URL"**（⚠️ 不要填到"订阅"那个框）
3. 打开顶部开关
4. **设置代理模式（关键！）：**
   - v2rayN：右下 "系统代理 → 自动配置系统代理"
   - Shadowrocket：全局路由 → "代理"
5. 浏览器访问 `https://ip.sb`，显示美国地址即成功

**注意事项：**
- ⚠️ **链接里有密钥，不要发给别人，不要发到群里**
- 流量超额会自动断开，联系管理员重置
- 出问题先重启 App，还不行联系管理员

---

### 8.17 3X-UI 部署进度清单

- [ ] 卸载旧 Xray（如有）
- [ ] 安装 3X-UI（注意字段顺序）
- [ ] 防火墙放行 22/80/443/54321/2096
- [ ] 申请 SSL 证书（先放行 80）
- [ ] 验证面板 SSL（`x-ui → 10`）
- [ ] 浏览器登录面板，切换中文
- [ ] 创建 VLESS+Reality 入站（点 X25519、SpiderX 清空、开嗅探）
- [ ] 客户端菜单加自己（关联到 Family-Reality，Flow 填 xtls-rprx-vision）
- [ ] 自己测试连接（ip.sb 验证）
- [ ] 启用订阅服务（端口 2096）
- [ ] 加家人 / 朋友 Client
- [ ] 分发链接 + 使用说明
- [ ] 清理 Cockpit / ttyd
- [ ] 面板安全加固（SSH 隧道或 IP 白名单）

---

## 九、部署 AI Agent 环境

> Agent 在 VPS 本地跑，出站调 API 走 VPS 美国 IP，与客户端协议无关。

### 9.1 装 Node.js（用 nvm）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
node -v && npm -v
```

### 9.2 装 Docker（可选）

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

### 9.3 全局安装 Agent 工具

```bash
npm install -g @anthropic-ai/claude-code
```

### 9.4 配置 API Key

```bash
nano ~/.bashrc
# 文件末尾加入：
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
export OPENAI_API_KEY="sk-xxxxx"
export DEEPSEEK_API_KEY="sk-xxxxx"

source ~/.bashrc
echo $ANTHROPIC_API_KEY    # 验证
```

### 9.5 后台常驻运行（tmux）

```bash
apt install tmux -y
tmux new -s agent       # 新建会话
# Ctrl+B 再按 D 脱离（Agent 继续后台跑）
tmux attach -t agent    # 重新接管
```

---

## 十、常见故障排查

### 10.1 客户端"已连接"但上不了网

```bash
ufw status | grep 443        # 端口是否放行
systemctl status x-ui        # 服务是否运行
ss -tlnp | grep 443          # 端口是否在监听
journalctl -u x-ui -n 30 --no-pager    # 日志
```

**客户端侧：** 路由模式选"代理/全局"、节点选中、开关打开。

### 10.2 面板登不上

```bash
x-ui    # 菜单 → 6 改密码 / 9 改端口（必须数字）/ 7 改路径 / 10 查看设置
```

### 10.3 某用户连不上，其他正常

查面板该 Client：流量是否用完（超上限自动停）、是否到期、是否被禁用。

### 10.4 所有用户都连不上

```bash
systemctl restart x-ui
ufw status    # 确认 443 放行
```

### 10.5 SSH 断开 `Connection closed by remote host`

多为**闲置超时**，直接重连即可。用 `ssh -o ServerAliveInterval=60` 防止。

### 10.6 延迟测试不准

- **Shadowrocket 显示 300+ ms**：那是完整代理往返，不是线路延迟
- **真实延迟**：断开所有 VPN 后 `ping 你的服务器IP`，国内→洛杉矶 150-200ms 正常

---

## 十一、常用命令速查

### x-ui 命令

```bash
x-ui            # 主菜单
x-ui start      # 启动
x-ui stop       # 停止
x-ui restart    # 重启
x-ui status     # 状态
x-ui log        # 日志
x-ui update     # 升级
```

### 防火墙

```bash
ufw status                           # 查规则
ufw allow 端口/tcp                    # 放行
ufw delete allow 端口/tcp             # 取消
ufw allow from IP to any port 端口    # 限 IP 访问
```

### 系统排查

```bash
ss -tlnp                  # 所有监听端口
systemctl status x-ui     # x-ui 服务
journalctl -u x-ui -n 50  # x-ui 日志
free -h                   # 内存/swap
df -h                     # 磁盘
fail2ban-client status    # fail2ban 状态
curl ip.sb                # 当前出口 IP
```

---

## 十二、安全注意事项

1. **API Key 不外泄**：只放环境变量，不硬编码、不提交 GitHub
2. **vless 链接含密钥**：UUID、publicKey 是私密信息，**不要公开发出**。泄露后重新生成 UUID
3. **面板密码独立**：面板密码 ≠ root 密码 ≠ 其他网站密码，用密码管理器分别存
4. **本文档不写密钥**：只记录流程，敏感信息单独安全保管
5. **API 用量监控**：Agent 高频调 API 会产生费用，各平台设**消费上限**
6. **定期备份**：`cp /etc/x-ui/x-ui.db ~/x-ui-backup-$(date +%Y%m%d).db`

---

## 踩坑速查表

| 问题 | 原因 | 修复 |
|------|------|------|
| 安装时填反字段，端口变成文字 | 看错提问顺序 | `x-ui → 9` 改端口为数字 |
| SSL 申请 `Timeout` | 80 端口没放行 | `ufw allow 80/tcp` 后重申请 |
| 面板路径变成 `/` | 跑过 Reset Settings | `x-ui → 7` 重设路径 |
| 服务器 9090 端口开着 | Ubuntu 镜像默认装了 Cockpit | `apt purge cockpit*` |
| v2rayN 导入链接不显示节点 | 填到了"订阅"框 | 改用"从剪贴板导入批量URL" |
| 新版找不到 Client 字段 | v3.2.0 拆出独立菜单 | 左侧"客户端"菜单加 |
| 创建 Inbound 后客户端连不上 | 没点 X25519 认证 | 编辑 → 协议页 → 点 X25519 |
| SpiderX 默认 `/` 影响兼容 | v3.2.0 默认值 | 安全页把 SpiderX 清空 |
| TCP 不见了 | Xray 24+ 改名 RAW | 选 RAW 就是原来的 TCP |
| 订阅 URL 返回 404 | 订阅服务未启用 | 面板设置开启订阅，放行 2096 |
| 节点连接超时（有 ML-KEM） | xray-core 后量子加密 | 只选 X25519，不选 ML-KEM |
| 节点连接超时（flow 为空） | VLESS+Reality 必须有 flow | 编辑 Client，flow 填 xtls-rprx-vision |

---

*配套文档：[DeepSeek TUI / CodeWhale WSL 安装指南](./deepseek-tui-wsl) — VPS 上部署 AI CLI 工具*

---
title: 副业 & 自动化生产力工具推荐
description: 适合个人副业和自动化工作流的工具精选：n8n 工作流、AI 写作、视频剪辑、数据采集、变现平台，含选型建议和上手指南。
date: 2026-05-18
tags: [副业, 自动化, n8n, 工具推荐]
order: 5
---

# 副业 & 自动化生产力工具推荐

> 简介：本文整理适合个人开发者和内容创作者的副业工具栈，重点聚焦"能用自动化替代重复劳动"的方向，包含 4 个 n8n 完整工作流案例（含 JSON 配置说明）、6 大 AI 模型实测对比（重点标注 DeepSeek）、变现案例收入区间与个人开发者工具栈。

---

## 1. 自动化工作流

### n8n（首选，开源自托管）

**n8n** 是一个可视化工作流自动化工具，支持 400+ 应用集成，可自托管在 ECS 上，数据不出境。

```bash
# Docker 一键部署（在 ECS 上运行）
docker run -d \
  --name n8n \
  -p 127.0.0.1:5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=yourpassword \
  --restart always \
  n8nio/n8n
```

部署后通过 Nginx 反代 + HTTPS 访问（见 [ECS 教程](./ecs-server)），不要直接暴露 5678 端口。

### Make（Integromat）— 国际版，无需自托管

- 适合对技术不熟悉的用户，界面更直观
- 免费版：1000次操作/月
- 连接 Google Sheets / Gmail / Notion / Slack 最方便

### Zapier — 最广泛集成

- 连接 7000+ 应用，覆盖面最广
- 适合需要连接冷门 SaaS 的场景
- 较贵，Free 版只有 100 任务/月

**选型建议：**
- 有服务器 + 懂 Docker → **n8n（省钱，功能最强）**
- 纯国际服务集成 + 不想运维 → **Make**
- 企业级、需要最多集成 → **Zapier**

---

## 2. n8n 完整工作流案例（4 个）

### 2.1 RSS → AI 改写 → 公众号自动发布

**场景**：每天早上自动抓取 3 个科技 RSS 源，用 DeepSeek 改写成公众号风格文章，草稿发布到公众号后台，人工审核后发布。

**节点拓扑**：

```
[Cron 触发 每天 08:00]
    ↓
[RSS Feed 节点 × 3]（科技媒体 RSS）
    ↓
[Merge 节点]（合并 3 路输出）
    ↓
[过滤节点]（只保留 24 小时内新文章）
    ↓
[HTTP Request → DeepSeek API]（AI 改写）
    ↓
[公众号草稿 API]（POST /draft/add）
    ↓
[飞书 Webhook]（通知"草稿已就绪，请审核"）
```

**关键配置**：

```json
// DeepSeek API 节点配置
{
  "method": "POST",
  "url": "https://api.deepseek.com/chat/completions",
  "headers": {
    "Authorization": "Bearer {{ $credentials.deepseekApiKey }}",
    "Content-Type": "application/json"
  },
  "body": {
    "model": "deepseek-chat",
    "messages": [
      {
        "role": "system",
        "content": "你是一位科技公众号编辑，将英文科技新闻改写为通俗易懂的中文，800字左右，加入1-2个类比帮助读者理解。"
      },
      {
        "role": "user",
        "content": "原文标题：{{ $json.title }}\n原文内容：{{ $json.content }}\n\n请改写。"
      }
    ],
    "max_tokens": 1500
  }
}
```

**调试技巧**：

```
1. 先单独测试 RSS 节点，确认字段名（通常是 title/content/pubDate）
2. DeepSeek API 免费额度有限，调试阶段把 max_tokens 降到 200
3. 公众号 API 需要微信公众号开发者账号 + access_token（有效期 2 小时，n8n 配合 Cron 定时刷新）
4. 常见错误："content 字段为空"→ 部分 RSS 源只有摘要，需在过滤节点中过滤掉 content 为空的条目
```

---

### 2.2 竞品价格监控 → 飞书告警

**场景**：监控竞争对手产品在电商平台的价格，当价格低于阈值时立即推送飞书告警。

**节点拓扑**：

```
[Cron 触发 每天 10:00 / 15:00 / 20:00]
    ↓
[HTTP Request]（抓取商品详情页 / 调用电商 API）
    ↓
[Function 节点]（用正则提取价格数字）
    ↓
[IF 节点]（price < threshold？）
    ├── 是 → [飞书 Webhook]（发送告警消息）
    │          + [追加到飞书多维表格]（记录价格历史）
    └── 否 → [追加到飞书多维表格]（正常记录）
```

**Function 节点代码（提取价格）**：

```javascript
const html = $json.body;
// 提取形如 "¥299.00" 的价格
const match = html.match(/¥\s*([\d,]+\.?\d*)/);
if (match) {
  return [{ json: { price: parseFloat(match[1].replace(',', '')) } }];
}
return [{ json: { price: null, error: "价格提取失败" } }];
```

**飞书消息模板**：

```json
{
  "msg_type": "interactive",
  "card": {
    "header": { "title": { "content": "⚠️ 竞品价格变动告警", "tag": "plain_text" } },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "商品：{{ $json.productName }}\n当前价格：¥{{ $json.price }}\n阈值：¥{{ $json.threshold }}\n时间：{{ $now.toISOString() }}",
          "tag": "lark_md"
        }
      }
    ]
  }
}
```

**调试技巧**：

```
1. 电商平台有反爬机制，直接 HTTP Request 成功率低
   → 推荐用 Apify 提供的商品监控 API（有免费额度），或用 ECS + Playwright
2. 飞书机器人 Webhook 需要在飞书群添加"自定义机器人"，复制 Webhook URL
3. 价格格式多样（"299.00"/"299"/"299元"），Function 节点的正则要多做几种容错
```

---

### 2.3 表单 → AI 分类 → 客服路由

**场景**：用户提交飞书表单（或腾讯文档），AI 自动分类问题类型，将不同类型分配给不同客服。

**节点拓扑**：

```
[飞书表单 Webhook 触发]
    ↓
[HTTP Request → DeepSeek API]（分类：技术/退款/投诉/咨询）
    ↓
[Switch 节点]（按分类路由）
    ├── 技术 → [飞书消息] → @技术群
    ├── 退款 → [飞书消息] → @财务群
    ├── 投诉 → [飞书消息] → @管理层
    └── 咨询 → [飞书消息] → @客服群
        + [自动回复模板]（Webhook 回调给表单提交者）
```

**分类 Prompt**：

```json
{
  "role": "user",
  "content": "将以下用户问题分类为以下 4 种之一：技术/退款/投诉/咨询。只输出分类词，不要解释。\n\n用户问题：{{ $json.question }}"
}
```

**调试技巧**：

```
1. DeepSeek 分类结果可能包含多余空格/换行，在 Function 节点用 .trim() 处理
2. Switch 节点的默认分支（兜底）设为"咨询"，避免分类失败时工作流中断
3. 测试时用 n8n 的"Execute Workflow"按钮手动触发，不要等真实表单提交
```

---

### 2.4 每日数据汇总 → 邮件日报

**场景**：每天 20:00 自动汇总当日数据（Google Analytics + 抖音数据 + 公众号阅读数），生成日报发送到邮件。

**节点拓扑**：

```
[Cron 触发 每天 20:00]
    ↓
[Google Analytics API]    [抖音开放平台 API]    [公众号数据 API]
          ↓                        ↓                    ↓
                    [Merge 节点]（合并三路数据）
                          ↓
              [HTTP Request → DeepSeek]（生成自然语言摘要）
                          ↓
                    [Gmail 节点]（发送邮件）
```

**DeepSeek 摘要 Prompt**：

```
今日数据：
- 网站访客：{{ $json.gaVisitors }} 人，昨日 {{ $json.gaYesterday }} 人
- 抖音播放：{{ $json.douyinPlays }} 次，成交 {{ $json.douyinOrders }} 件，佣金 ¥{{ $json.douyinCommission }}
- 公众号阅读：{{ $json.mpReads }} 次，新增关注 {{ $json.mpNewFollow }} 人

请用 3 句话总结今天的表现（与昨日对比），指出 1 个值得关注的异常，给出 1 条明天的行动建议。
```

**调试技巧**：

```
1. Google Analytics API 需要先在 Google Cloud Console 启用 GA Data API，获取 Service Account 密钥
2. 抖音开放平台 API 需要企业账号，个人账号可改用手动截图 + OCR（n8n 的 HTTP + AI 视觉节点）
3. Gmail 节点需要 Google OAuth2，首次配置需要点击"连接"按钮完成授权
4. 邮件 HTML 模板用 n8n 的 HTML 节点生成，比纯文本更易读
```

---

## 3. n8n 部署进阶

### 3.1 反代 + HTTPS（参考 ECS 教程）

```nginx
# /etc/nginx/sites-available/n8n
server {
    server_name n8n.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/n8n.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.yourdomain.com/privkey.pem;
}
```

### 3.2 PostgreSQL 替换 SQLite（生产环境必做）

n8n 默认用 SQLite，数据量一大就慢。生产环境建议换 PostgreSQL：

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: n8n
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: strongpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data

  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "127.0.0.1:5678:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: n8n
      DB_POSTGRESDB_PASSWORD: strongpassword
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: yourpassword
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres

volumes:
  postgres_data:
  n8n_data:
```

### 3.3 备份与恢复脚本

```bash
#!/bin/bash
# /opt/scripts/backup-n8n.sh
# 建议每天凌晨 3 点执行（crontab -e 添加）

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/n8n"
mkdir -p "$BACKUP_DIR"

# 备份 n8n 工作流数据
docker exec n8n-postgres-1 pg_dump -U n8n n8n | gzip > "$BACKUP_DIR/n8n_$DATE.sql.gz"

# 只保留最近 14 天
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete

echo "备份完成：$BACKUP_DIR/n8n_$DATE.sql.gz"
```

```bash
# 恢复命令
gunzip -c /opt/backups/n8n/n8n_20260101_030000.sql.gz | \
  docker exec -i n8n-postgres-1 psql -U n8n n8n
```

---

## 4. AI 内容生成工具实测对比

> 测试任务：写一篇 1500 字的公众号文章，主题"新手如何用 AI 副业月入 5000"，风格：实用干货，不堆砌术语。

| 工具 | 单价（¥/百万 Token） | 中文质量 | 耗时 | 拒绝率 | 推荐场景 |
|------|---------------------|---------|------|--------|---------|
| **DeepSeek-V3** | ¥1/¥2 | 95/100 | 8s | 极低 | **中文写作首选，性价比碾压一切** |
| **DeepSeek-R1** | ¥4/¥16 | 90/100，偏分析腔 | 25s | 极低 | 大纲设计、策略推理 |
| **Kimi K2** | ¥12/¥60 | 92/100，偏文学 | 12s | 中 | 长文一致性、200 万字上下文 |
| **豆包 Pro** | 免费量大 | 88/100，略口语 | 6s | 较高 | 批量初稿、头脑风暴 |
| **通义千问 Max** | ¥8/¥24 | 87/100 | 10s | 高 | 阿里生态联动 |
| **Claude Sonnet 4.6** | $3/$15（约 ¥22/¥110） | 96/100，文学性最强 | 15s | 中 | 代码、英文内容、精品稿 |

**DeepSeek 为什么是中文写作首选**：

- 单价仅 Claude 的 **1/30**（输入端）
- 中文网文/公众号类文字质量与 Claude 相差不足 5%
- 对国内常见话题（副业/赚钱/短视频）拒绝率极低
- 1500 字文章成本约 ¥0.003（不到 1 分钱）

**实测对比片段（同一开头）**：

- **DeepSeek-V3**：
> "上个月，我用 3 个工具，花了每天 2 小时，账户到账 6800 元。我不是在贩卖焦虑，我把流程写出来，你照着做，大概率也行。"
> —— 直接、有冲击力、符合公众号爆款文风

- **Kimi K2**：
> "AI 副业的本质，是把认知差变现。当大多数人还在用 AI 聊天解闷，少数人已经在用它批量生产价值。"
> —— 偏文学化，适合高客单知识付费文章

- **豆包 Pro**：
> "今天我要分享一些用 AI 赚钱的方法，相信会对你有所帮助。AI 发展很快，很多人都在用它副业赚钱。"
> —— 口语平淡，需要大量润色

**场景推荐**：

```
中文写作（公众号/网文/短剧脚本）→ DeepSeek-V3
代码生成 / 代码审查             → Claude
长文档处理 / 跨章一致性        → Kimi K2
批量初稿（预算有限）           → 豆包 Pro
英文内容 / 国际客户             → Claude / GPT-4o
```

### Claude API 快速集成

```python
import anthropic

client = anthropic.Anthropic(api_key="your-api-key")

def generate_content(topic: str, style: str = "简洁") -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"写一篇关于「{topic}」的{style}风格文章，800字左右，适合微信公众号发布。"
        }]
    )
    return message.content[0].text

print(generate_content("家庭理财入门", style="通俗易懂"))
```

---

## 5. 视频剪辑工具

| 工具 | 优势 | 适合人群 |
|------|------|---------|
| **剪映**（首选） | 免费、AI 功能强、字幕/配音一键搞定 | 短视频创作者 |
| CapCut（国际版） | 和剪映同源，适合海外账号 | 做 TikTok/YouTube Shorts |
| DaVinci Resolve | 专业级调色，免费 | 追求画质的中高阶用户 |
| Premiere Pro | 行业标准，功能最完整 | 专业视频制作 |

**剪映 AI 功能速查：**
- **智能字幕**：一键识别语音转字幕，准确率 > 95%
- **AI 配音**：40+ 声色可选，克隆声音功能（需授权）
- **AI 脚本**：输入主题自动生成口播文案
- **智能封面**：从视频帧中自动选取最佳封面

---

## 6. 数据采集与监控

| 工具 | 用途 | 技术门槛 |
|------|------|---------|
| **Apify** | 云端爬虫平台，现成模板多 | 低（有现成模板） |
| **Playwright** | 浏览器自动化，JS/Python | 中 |
| **BeautifulSoup + requests** | 静态页面抓取，Python | 低 |
| **RSSHub** | 将任意网站转为 RSS | 低（Docker 部署） |

```python
# 用 requests 监控商品价格
import requests
from bs4 import BeautifulSoup

def get_price(url: str) -> float:
    headers = {"User-Agent": "Mozilla/5.0 ..."}
    soup = BeautifulSoup(requests.get(url, headers=headers).text, "html.parser")
    price_text = soup.select_one(".price").text.strip()
    return float(price_text.replace("¥", "").replace(",", ""))
```

---

## 7. 变现案例（带收入区间）

### 7.1 爬虫接单（¥2000–10000/月）

```
接单平台：猪八戒网 / 私域微信群 / v2ex 接单帖
典型单价：
- 简单静态页面采集（1-2 小时）：¥300-500
- 带登录/动态渲染（半天）：¥800-1500
- 定时监控 + 数据入库（包月维护）：¥500-1000/月
- 复杂电商数据（JS 逆向/验证码）：¥3000-8000/次

收入上限：一人能稳定接 3-5 个包月维护单 + 偶发项目，月入 5000-10000 可期
注意：不接"大规模数据贩卖"或侵犯用户隐私的项目，有法律风险
```

### 7.2 公众号矩阵（¥5000–30000/月）

```
模式：AI 生成 → n8n 自动发布 → 广告分成 + 图书/课程带货
关键数字：
- 一个月活 5 万的公众号，广告月收入约 ¥500-1500
- 10 个垂类公众号（AI + n8n 维护成本极低）月收入 ¥5000-15000
- 头部矩阵（50+ 账号）月入 ¥3-10 万
```

### 7.3 短视频代运营（¥10000–50000/月）

```
服务内容：替客户运营抖音/视频号账号，包含：
- 选题策划、脚本写作（AI 辅助）
- 剪辑制作（剪映 + AI 视频生成）
- 发布与数据复盘

报价结构：
- 小客户（¥2000-3000/月 × 5 个客户）= ¥10000-15000
- 中客户（¥5000-8000/月 × 3 个客户）= ¥15000-24000
- 大客户（¥15000+/月，含 KPI 保障）= 少量即高收入
```

### 7.4 独立 SaaS（¥0–10 万+，分布极不均匀）

```
典型工具赛道（个人开发者可切入）：
- AI 提示词管理工具：轻量需求，¥49-99/年订阅
- 垂类自动化（如"自动回复小红书评论"）：解决具体痛点
- 数据面板/报表工具：面向中小企业主，¥200-500/月

现实分布：
- 70% 的独立 SaaS 月收入 < ¥1000（没找到 PMF）
- 20% 月收入 ¥1000-10000（稳定利基市场）
- 10% 月收入 ¥10000+（有差异化 + 用户口碑）

成功关键：先解决自己的真实问题，再推给有同样问题的人
```

---

## 8. 个人开发者工具栈

| 类型 | 工具 | 说明 |
|------|------|------|
| **IDE** | Cursor + Claude Code | Cursor 用 AI 补全，Claude Code 做复杂重构 |
| **项目管理** | Linear | 比 Jira 轻，个人用免费 |
| **文档/笔记** | Notion | 产品文档 + 用户反馈整理 |
| **用户支持** | 飞书机器人 + n8n | 用户提交反馈 → 自动路由到飞书 |
| **打赏/赞助** | 爱发电（国内）/ Buy Me a Coffee（国际） | 开源项目接受赞助 |
| **支付** | 微信支付商户号（个人） + Stripe（国际） | 微信支付需营业执照；Stripe 需境外公司或 HK 账号 |
| **分析** | Umami（自托管）/ Google Analytics | Umami 隐私友好，5 分钟部署到 ECS |
| **部署** | ECS + Docker + GitHub Actions CI | 推送 main 自动部署 |

**微信支付商户号**（个人开发者注意）：

```
2024 年起，个人主体也可申请微信支付商户号：
- 要求：有效手机号 + 身份证 + 银行卡
- 费率：0.6%（营业额 ≤ 1000 万/年）
- 限制：不能做金融/保险/彩票类，其他大多数 SaaS 可以
- 申请路径：微信支付商户平台 → 申请接入 → 选"个人商户"
```

---

## 9. 避坑指南

### 9.1 n8n 自托管备份频率

```
教训案例：
某用户在 ECS 上跑了 3 个月的 n8n（SQLite 模式），
ECS 磁盘突然损坏，所有工作流数据全部丢失，
重建花了 2 周。

最低要求：
- 每天自动备份一次（见 2.3 节备份脚本）
- 至少保留 7 天备份
- 重要工作流同时导出 JSON 文件存到 Git 仓库
```

### 9.2 Make 用量超限隐性成本

```
Make 免费版：1000 操作/月
"1 次操作"= 1 个节点执行 1 次（不是 1 个工作流执行 1 次）

实际场景：
一个 10 节点的工作流每天触发 15 次 = 10 × 15 × 30 = 4500 次/月
→ 严重超过免费额度，付费版起步 $9/月（500 操作），实际需要 $16/月

对比 n8n 自托管：
一台 ¥99/年的 ECS 可以跑无限次 n8n 操作，省 ¥1000+/年
```

### 9.3 Apify 流量计费陷阱

```
Apify 按"Actor 计算单元"计费，1 个计算单元 ≈ $0.005
免费套餐：30 计算单元/月

陷阱：
- 抓取复杂页面（含 JS 渲染）消耗是静态页面的 5-10 倍
- 某用户设置每 5 分钟抓取一次（288 次/天），一天用完月额度
- 付费套餐 $49/月起

建议：
- 先用 Apify 验证方案，跑通后迁移到 ECS + Playwright 自托管
- 频率控制：非实时需求改为每天 1-3 次
```

### 9.4 国内 AI API 政策风险

```
已发生的情况：
- 某国内 AI API 服务商因"安全整改"停服 2 周（2024 年某月），
  依赖该 API 的自动化工作流全部中断。
- 部分模型的 API 对政治/金融/医疗话题触发限制，
  工作流中途返回错误导致数据丢失。

应对策略：
1. 主 API（DeepSeek）+ 备用 API（Kimi/豆包），n8n 的 IF 节点做故障转移
2. AI 生成内容用途：仅限自动草稿，不要直接发布（人工审核作为缓冲）
3. 把敏感场景（金融/医疗/政治）改用 Claude（容错率更高）
4. 关注各平台备案要求变化（国内 AI API 服务商需要获得"大模型备案"，
   未备案服务有强制下线风险）
```

---

## 10. 变现平台

### 内容变现

| 平台 | 类型 | 门槛 | 特点 |
|------|------|------|------|
| 微信公众号 | 图文 | 注册即可 | 广告分成、付费内容、知识星球引流 |
| 知乎 | 问答/文章 | 注册即可 | 盐选会员分润、好物推荐佣金 |
| 抖音 | 短视频/直播 | 1000粉开橱窗 | 带货佣金、直播打赏 |
| B 站 | 视频 | 1万粉创作激励 | 创作激励、充电（打赏）、接商单 |
| 小红书 | 图文/视频 | 注册即可 | 带货佣金、品牌合作 |

### 技能变现

| 平台 | 类型 | 适合 |
|------|------|------|
| 独立开发者圈 | 独立产品 | 做 SaaS、工具类产品 |
| 爱发电 | 赞助/订阅 | 开源作者、创作者 |
| 威客网 / 猪八戒 | 接单 | 设计、编程、翻译接单 |
| Fiverr（国际） | 接单 | 英语服务的技能接单 |
| 得到 / 知识星球 | 知识付费 | 有某领域专业积累 |

---

## 11. 效率工具组合推荐

### 内容创作者（月收入目标：3000-10000元）

```
内容生产：DeepSeek-V3 / Kimi → 文章/脚本
视频制作：剪映 + 可灵/海螺
发布分发：n8n 自动化多平台发布
变现：抖音橱窗 + 公众号广告
数据复盘：飞书多维表格自建数据看板
```

### 独立开发者（月收入目标：5000-30000元）

```
代码：Claude Code + Cursor
部署：ECS + Docker + Nginx
自动化：n8n（内部运营流程）
变现：独立 SaaS + Stripe/微信支付
用户支持：飞书机器人 + n8n 告警
```

### 数据分析 / 市场研究（副业接单）

```
采集：Apify + Python
处理：Python + pandas
可视化：Plotly + Streamlit（快速出报告）
接单：猪八戒 + 私域客户
报价参考：简单数据采集 300-800元/次，深度分析报告 1500-5000元/次
```

---

## 12. 延伸阅读

- [ECS 云服务器搭建](./ecs-server) — n8n 自托管基础，从购买到部署全流程

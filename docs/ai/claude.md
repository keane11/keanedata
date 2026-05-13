# Claude 使用指南

> Anthropic 出品的 AI 助手，在长文本处理、代码编写和逻辑推理方面表现出色。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版 | [claude.ai](https://claude.ai) | 免费版每天有限额，Pro 版无限制 |
| API | Anthropic API | 按 token 计费，适合集成到应用 |
| CLI | Claude Code | 终端工具，专为编程场景设计 |

## 模型选择

| 模型 | 定位 | 适合场景 |
|------|------|---------|
| Claude Opus 4 | 最强推理 | 复杂分析、长文档、难题攻关 |
| Claude Sonnet 4.6 | 性价比首选 | 日常编程、写作、对话 |
| Claude Haiku 4.5 | 速度最快 | 简单任务、高频调用 |

## 核心使用技巧

### 系统提示词（System Prompt）

开头设定角色和约束，能显著提升输出质量和一致性。

```
你是一位资深 Python 工程师。
- 优先给出可直接运行的代码示例
- 解释只说关键点，不写废话前言
- 遇到多种实现方案时，先给推荐方案，再简述其他选项
```

### 长文档分析

Claude 支持超长上下文（Opus 支持 200K token），适合：
- 贴入整个代码文件让它 review
- 上传 PDF 论文逐段分析
- 多轮对话中始终记住前文

### 结构化输出

需要固定格式时，直接在提示词里给模板：

```
按以下 JSON 格式返回结果，不要额外说明：
{
  "summary": "...",
  "tags": ["...", "..."],
  "difficulty": "easy|medium|hard"
}
```

### 让 Claude 自我纠错

```
先完成任务，再以批评者身份检查自己的输出，
找出至少 2 个可以改进的地方并修正。
```

## Claude Code CLI

Claude Code 是 Anthropic 官方 CLI 工具，在终端直接调用 Claude 读写文件、运行命令、完成复杂多步骤编程任务。安装方式见 [WSL 安装 AI CLI 工具](./wsl_ai_cli_教程)。

### 常用命令

```bash
# 启动交互式会话（在项目目录下运行，自动加载结构）
cd my-project && claude

# 单次任务，执行后退出
claude "帮我写单元测试，覆盖 utils.py 里所有函数"

# 将文件内容作为上下文
claude "解释这段代码的逻辑，重点讲并发问题" < main.py

# 非交互输出（适合脚本、管道）
claude --print "生成一份标准 .gitignore（Python 项目）"

# 继续上一次会话
claude --continue

# 恢复指定会话
claude --resume <session-id>

# 指定模型
claude --model claude-opus-4-7 "做代码架构评审"

# 跳过所有确认（自动化脚本场景，慎用）
claude --dangerously-skip-permissions "重构整个 utils 模块"
```

### 权限模式

| 模式 | 行为 |
|------|------|
| 默认 | 读取文件自由，修改/执行前逐步确认 |
| `--dangerously-skip-permissions` | 全自动执行，无需确认 |

### 交互模式斜杠命令

| 命令 | 功能 |
|------|------|
| `/help` | 查看所有可用指令 |
| `/clear` | 清空当前对话上下文 |
| `/compact` | 压缩上下文，节省 token |
| `/model` | 切换模型 |
| `/cost` | 查看本次会话 token 用量 |
| `/review` | 对当前改动做代码审查 |
| `/memory` | 管理跨会话记忆 |
| `/init` | 在项目根生成 `CLAUDE.md` |
| `/quit` | 退出 |

### CLAUDE.md 项目配置

在项目根目录创建 `CLAUDE.md`，Claude Code 每次启动时自动读取，相当于给 AI 的永久系统提示：

```markdown
# 项目简介
这是一个基于 FastAPI 的后端服务，使用 PostgreSQL。

# 代码规范
- Python 3.11+，类型注解全覆盖
- 函数命名：snake_case；类命名：PascalCase
- 不写注释，让代码自解释
- 测试文件放 tests/ 目录，使用 pytest

# 禁止操作
- 不要修改 alembic/versions/ 下的文件
- 不要安装新依赖，需要时先提出
- 提交前必须运行 ruff check . && pytest

# 常用命令
- 启动开发服务器：uvicorn main:app --reload
- 运行测试：pytest -v
- 数据库迁移：alembic upgrade head
```

### MCP 服务器

MCP（Model Context Protocol）让 Claude Code 连接外部数据源和工具：

```bash
# 在 ~/.claude/settings.json 配置 MCP 服务器
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxx" }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://user:pass@localhost/mydb"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    }
  }
}
```

配置后，Claude Code 可以直接查询数据库、读取 GitHub Issues、访问指定文件系统路径。

### Hooks（钩子）

在工具调用前后自动执行 Shell 命令，适合格式化、测试、通知等场景：

```json
// ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "ruff format $CLAUDE_FILE_PATH 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

可用事件：`PreToolUse`、`PostToolUse`、`Stop`（会话结束时）。

### 实用工作流

```bash
# 1. 让 Claude 给整个 PR 写 commit message
git diff HEAD~1 | claude --print "根据这个 diff 写一条规范的 git commit message"

# 2. 批量处理文件
ls src/*.py | xargs -I{} claude --print "检查 {} 中有没有 SQL 注入风险" > security_report.txt

# 3. 生成测试覆盖
claude "分析 src/ 下所有函数，为没有测试的函数生成 pytest 用例"

# 4. 代码库问答（不修改文件）
claude --print "这个项目用了哪些设计模式？举具体例子"
```

## API 快速上手

```python
import anthropic

client = anthropic.Anthropic(api_key="your-key")

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "用 Python 写一个二分查找"}
    ]
)

print(message.content[0].text)
```

## 免费额度参考

- **claude.ai 免费版**：每天约 20-30 条消息（Sonnet）
- **API**：新账号有 $5 免费额度，用完需充值
- **Claude Code**：需要 API Key 或 Claude.ai Pro 订阅

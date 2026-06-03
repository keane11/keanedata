---
title: 产品选型 Agent 架构指南
description: 以蓝讯芯片选型助手为参考实现，介绍如何用 PydanticAI + SQLite + 本地文档快速搭建垂直领域智能选型 Agent，重点拆解四层 Harness 防幻觉机制。
date: 2026-06-03
tags: [Agent, PydanticAI, SQLite, 架构设计, 防幻觉]
order: 8
---

# 产品选型 Agent 架构指南

> 以蓝讯芯片选型助手为参考实现，介绍如何用 **PydanticAI + SQLite + 本地文档** 快速搭建一个垂直领域的智能选型 Agent。

---

## 目录

1. [整体架构](#1-整体架构)
2. [数据库设计](#2-数据库设计)
3. [Agent 设计（含 Harness 工作流）](#3-agent-设计含-harness-工作流)
4. [工具（Tools）设计](#4-工具tools设计)
5. [System Prompt 写法参考](#5-system-prompt-写法参考)
6. [两层记忆系统](#6-两层记忆系统)
7. [文档索引与检索](#7-文档索引与检索)
8. [LLM 提供商抽象](#8-llm-提供商抽象)
9. [多轮对话管理](#9-多轮对话管理)
10. [快速复用清单](#10-快速复用清单)

---

## 1. 整体架构

```
用户输入
   │
   ▼
gui/api.py          ← Web UI 桥接层（pywebview）
   │
   ▼
agent/chip_agent.py ← PydanticAI Agent（核心）
   ├── search_chips         → query/engine.py → db/chips.db
   ├── compare_chips        → db/chips.db
   ├── get_datasheet        → db/datasheets 表（已提取文本）
   ├── generate_pin_assignment → agent/pin_assignment.py
   ├── analyze_customer_spec → app/customer_matcher.py
   └── remember             → db/user_memory 表
   │
   ▼
agent/memory.py     ← 两层记忆（会话历史 + 跨会话长期记忆）
   │
   ▼
db/database.py      ← SQLite 单文件数据库（chips.db）
```

**关键设计选择**：不用 RAG（向量检索），改用**结构化 SQL + 全文片段注入**。原因是：
- 产品数据字段明确（RAM、GPIO、功能标志），SQL 比向量搜索更精确
- 文档内容稀疏（每颗芯片最多几份 PDF），grep 式片段提取足够
- 避免向量数据库依赖，整个应用打包成单一 EXE

---

## 2. 数据库设计

### 2.1 核心表结构

```sql
-- 产品主表
CREATE TABLE chips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    model        TEXT NOT NULL,          -- 型号，唯一标识
    category     TEXT NOT NULL,          -- 品类（=过滤维度）
    sub_category TEXT,                   -- 子系列
    package      TEXT,                   -- 封装
    -- 量化规格（允许 NULL，便于后续补充）
    ram_kb       REAL,
    flash_mbit   REAL,
    gpio_count   INTEGER,
    mic_count    INTEGER,                -- 从 specs JSON 回填
    tx_power     REAL,
    rf_sensitivity REAL,
    -- 布尔功能标志（0/1，可直接做 SQL 过滤）
    tws_support  INTEGER DEFAULT 0,
    anc          INTEGER DEFAULT 0,
    usb_support  INTEGER DEFAULT 0,
    aac          INTEGER DEFAULT 0,
    ldac         INTEGER DEFAULT 0,
    enc          INTEGER DEFAULT 0,
    cloud_ai     INTEGER DEFAULT 0,
    -- 冗余 JSON（保留原始数据，便于扩展）
    specs        TEXT,                   -- 全字段 JSON（应用/关键词检索用）
    applications TEXT,                   -- 应用场景 JSON 数组
    status       TEXT DEFAULT 'active'
);

-- 文档表（datasheet / pinfunction / schematic）
CREATE TABLE datasheets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model       TEXT,       -- 对应型号（NULL = 通用文档）
    kind        TEXT,       -- datasheet|pinfunction|schematic|manual
    filename    TEXT,
    rel_path    TEXT,       -- docs/ 相对路径（EXE 打包后用）
    content     TEXT,       -- pdfplumber 提取的全文（供 AI 检索）
    char_count  INTEGER DEFAULT 0
);
CREATE INDEX idx_datasheets_model ON datasheets(model);
CREATE INDEX idx_datasheets_kind  ON datasheets(kind);

-- 跨会话长期记忆
CREATE TABLE user_memory (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    kind      TEXT DEFAULT 'preference',  -- preference/customer/note
    content   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 会话历史（PydanticAI 原生 JSON blob）
CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT, ...);
CREATE TABLE messages (
    conversation_id INTEGER PRIMARY KEY,
    messages_json   BLOB    -- PydanticAI result.all_messages_json()
);
```

### 2.2 三条设计原则

**① 量化字段提升为独立列，不要只存 JSON**

错误做法：
```json
specs: {"MIC数量": "3路", "RAM": "408KB"}
```

正确做法：把 `mic_count`、`ram_kb` 提升为独立 INTEGER/REAL 列，才能做 `WHERE mic_count >= 5`。

`specs` JSON 列保留作为补充，用于 `LIKE` 关键词搜索那些没有独立列的长尾属性。

**② 布尔功能用 0/1 INTEGER，不用字符串**

```sql
-- ✓ 快速过滤
WHERE anc = 1 AND tws_support = 1

-- ✗ 慢且错误率高
WHERE specs LIKE '%ANC%'
```

**③ NULL 和 0 的语义区分**

- `mic_count = NULL`：数据未录入，不参与 `>=` 过滤
- `mic_count = 0`：确认不支持
- 查询时用 `mic_count >= ?` 而非 `mic_count = ?`，自然跳过 NULL

### 2.3 查询引擎（`query/engine.py`）

```python
def _build_sql(f: dict) -> tuple[str, list]:
    clauses = ["status = 'active'"]
    params = []

    # 品类精确匹配
    if f.get("category"):
        clauses.append("category = ?")
        params.append(f["category"])

    # 布尔功能批量处理
    bool_map = {"anc": "anc", "tws": "tws_support", "usb": "usb_support", ...}
    for key, col in bool_map.items():
        if f.get(key) is True:
            clauses.append(f"{col} = 1")

    # 量化下限（>=）
    for field, col, cast in [
        ("ram_min_kb",  "ram_kb >= ?",    float),
        ("mic_min",     "mic_count >= ?", int),
        ("gpio_min",    "gpio_count >= ?",int),
    ]:
        v = cast(f[field]) if f.get(field) is not None else None
        if v is not None:
            clauses.append(col)
            params.append(v)

    where = " AND ".join(clauses)
    sql = f"SELECT * FROM chips WHERE {where} ORDER BY category, model LIMIT ?"
    params.append(f.get("limit", 10))
    return sql, params
```

**要点**：全参数化查询（`?` 占位符），避免 SQL 注入；`rf_sensitivity` 用 `<=`（负值越小越灵敏）。

---

## 3. Agent 设计（含 Harness 工作流）

### 3.1 为什么需要 Harness

裸 LLM 在垂直领域选型中存在两类固有问题：

| 问题 | 表现 | 根因 |
|------|------|------|
| **幻觉** | 推荐了数据库里没有或参数错误的产品（如 BT8971H 实际 3MIC 却被说成 5MIC）| LLM 从系列文档"推断"了不属于该型号的规格 |
| **漂移** | 搜索过滤器正确执行后，LLM 绕过结果自行追加了不符合条件的产品 | LLM 把"看到文档里提到"等同于"满足过滤条件" |

Harness 通过**四个层次**协同解决这两类问题，每层责任边界清晰：

```
L1  信息层级   ── 定义哪个来源最可信，冲突时以谁为准
L2  执行协议   ── 强制工具调用顺序，不允许跳步
L4  硬约束     ── 铁律禁令，写在 System Prompt，LLM 必须遵守
L5  后处理校验  ── 代码层兜底，LLM 输出后再用数据库核验一遍
```

---

### 3.2 L1 — 信息层级（数据可信度排序）

**目标**：当数据库值、专属文档、系列文档互相矛盾时，明确告知 LLM 以谁为准。

```
Tier 1（最高）  数据库 chips 表 / compare_chips / search_chips 返回值
Tier 2（中）    该型号的专属 Datasheet（kind=datasheet，精确型号匹配）
Tier 3（参考）  系列 pinfunction（如 BT897X，标注"系列级"）
```

**在工具实现层落地**——`get_datasheet` 返回内容前先注入 Tier 1 锚点：

```python
def _datasheet_lookup(model: str, query: str) -> str:
    # Tier 1 锚点：先把数据库权威值打头，LLM 无法忽视
    db_summary = _chip_db_summary(model)
    # "BT8971H 数据库参数：MIC:3路 | RAM:408KB | GPIO:14"

    rows = _fetch_docs(model)

    if not rows:
        # 无文档：只返回数据库值 + 提示上传
        return f"【数据库参数（权威）】{db_summary}\n\n暂无入库文档，建议上传专属 Datasheet。"

    if _only_series_docs(rows):
        # 只有系列文档：强制警告 + 数据库值在前
        return (
            f"【数据库参数（权威，以此为准）】{db_summary}\n\n"
            f"⚠️ 以下为系列级参考文档，展示整个系列的最大引脚集合，"
            f"不代表 {model} 的实际规格：\n"
            + _format_docs(rows)
        )

    # 有专属 Datasheet：正常流程，系列文档加 [系列] 标签区分
    return _format_docs(rows, label_series=True)
```

**在 System Prompt 层声明**：
```
━━ 信息层级 ━━
Tier 1（最高）：数据库返回值 — 任何文档与之矛盾时以此为准
Tier 2（中）  ：型号专属 Datasheet
Tier 3（参考）：系列 pinfunction — 只供引脚命名参考，不可推断具体型号规格
系列 pinfunction 展示的是整个系列的引脚复用最大集合，
同系列各型号实际支持的 MIC 路数/GPIO 数量可以不同，必须以 Tier 1 数据库为准。
```

---

### 3.3 L2 — 执行协议（强制工具调用顺序）

**目标**：让 LLM 的每次选型查询都经过"搜索→核验"两道关，而不是直接从文档推断结论。

```
用户问题
   │
   ▼  [解析] 从需求提取结构化 filters
   │         category / mic_min / ram_min_kb / tws / anc …
   │
   ▼  [搜索] search_chips(filters)
   │         SQL 过滤后的结果 = 唯一权威候选集
   │         结果为空 → 放宽条件重查，禁止在结果外追加型号
   │
   ▼  [核验] compare_chips(候选型号列表)  ← 不可省略
   │         拉取每颗芯片的完整 DB 参数
   │         与需求逐项比对，不符合的立即移除
   │
   ▼  [输出] 只推荐通过核验的型号
             直接输出结果，不在回复里写步骤标签
```

**核验步骤（`compare_chips`）的必要性**：  
`search_chips` 只按用户指定的条件过滤，`compare_chips` 把候选芯片的全部参数拉出来对比，能发现 `search_chips` 没有覆盖到的隐含冲突（如用户问了 5MIC，但搜到的某颗芯片 DB 里 mic_count 实际是 NULL，应排除）。

**在 System Prompt 里写明步骤是内部标记**（否则 LLM 会把"第四步：输出推荐"输出给用户）：

```
━━ 执行协议（内部流程，步骤标签不输出给用户）━━
⚠️ [解析]/[搜索]/[核验]/[输出] 是内部执行标记，
   绝对不允许出现在发给用户的最终回复文字中。

1. [解析] 提取 filters
2. [搜索] search_chips(filters)
3. [核验] compare_chips(候选列表) — 不可跳过
4. [输出] 直接输出推荐，不写步骤标签
```

---

### 3.4 L4 — 硬约束（铁律禁令）

L4 是一组写死在 System Prompt 里、不允许任何例外的规则，专门针对 L1/L2 仍然可能被绕过的场景：

```
━━ 铁律（L4 硬约束）━━
· search_chips 的返回列表是推荐范围的全集
  禁止在此之外追加任何型号，即使从文档"推断"可能满足条件也不行
  若认为漏选 → 重新调整 search_chips 参数重查，不要自行添加

· 系列文档的引脚/MIC 数量 ≠ 具体型号的规格
  BT897X pinfunction 里有 5 路 MIC，不等于 BT8971H 支持 5 路 MIC
  具体型号参数以 compare_chips/search_chips 的数据库值为准

· 不编造文档里没有的电气参数
  充电电流 / 上拉阻值 / 外部器件型号，只有 get_datasheet 确有时才引用

· 引脚接线必须调用 generate_pin_assignment，不臆造 Pin 号
```

**L4 的写法原则**：针对已观察到的具体错误模式写禁令，而不是泛泛"不要幻觉"。模糊的规则 LLM 会找到边界情况绕过去。

---

### 3.5 L5 — 后处理校验（代码层兜底）

L1–L4 都在 LLM 内部约束，L5 是**在 LLM 输出之后**，由 Python 代码独立核验一遍，相当于 CI 检查。

```python
# gui/api.py
def _verify_chip_claims(answer: str) -> list[dict]:
    """从 LLM 回答中提取芯片型号，查数据库核验关键参数是否被正确引用。"""
    models = re.findall(r'\b((?:BT|AB)\d{3,5}[A-Z]{0,3})\b', answer)
    results = []
    conn = get_conn()
    for model in set(models):
        row = conn.execute(
            "SELECT model, category, mic_count, ram_kb, gpio_count FROM chips WHERE model=?",
            [model]
        ).fetchone()
        if not row:
            continue
        discrepancies = []
        # 检测 MIC 路数是否被错误引用
        if row["mic_count"]:
            # 在回答文本中寻找与 DB 不符的 MIC 声明
            wrong_mic = _detect_wrong_mic(answer, model, row["mic_count"])
            if wrong_mic:
                discrepancies.append(f"MIC路数错误：LLM说{wrong_mic}路，DB实际{row['mic_count']}路")
        results.append({
            "model": model,
            "category": row["category"],
            "specs": _chip_summary(dict(row)),
            "discrepancies": discrepancies,
        })
    conn.close()
    return results


# 在 query_chat 里调用
def query_chat(self, text: str, ...) -> dict:
    answer, history = run_chat(text, ...)

    # L5 核验
    verified = _verify_chip_claims(answer)
    bad = [c for c in verified if c["discrepancies"]]
    if bad:
        # 在回答末尾追加纠错说明
        corrections = "\n".join(
            f"⚠️ {c['model']}：{'; '.join(c['discrepancies'])}" for c in bad
        )
        answer += f"\n\n---\n**数据纠正**：{corrections}"

    return {"answer": answer, "verified_chips": verified, ...}
```

**L5 校验卡片**同时在前端展示，让用户看到"数据库核验"区块——不依赖 LLM 自述，由代码直接从 DB 拉取显示。

---

### 3.6 四层联动全景

```
用户输入 "推荐5MIC耳机"
         │
         │  L1 信息层级已在工具返回值里注入 Tier 1 锚点
         │
         ▼
    [LLM 内部]
    ┌─────────────────────────────────┐
    │ L2 执行协议                      │
    │  解析 → mic_min=5, category=耳机 │
    │  search_chips({mic_min:5,...})   │
    │      → [BT8931H, BT8970H]       │ ← SQL 过滤结果
    │  compare_chips([BT8931H,BT8970H])│
    │      → 两颗均 mic_count=5 ✓     │
    │                                  │
    │ L4 硬约束                        │
    │  BT8971H 未在 search 结果里 → 禁止追加 │
    └─────────────────────────────────┘
         │
         ▼ LLM 输出
    "推荐 BT8931H（5MIC）和 BT8970H（5MIC）"
         │
         │  L5 后处理校验（Python 代码）
         ▼
    _verify_chip_claims(answer)
      BT8931H → DB mic_count=5 ✓
      BT8970H → DB mic_count=5 ✓
      → 无差异，正常输出
         │
         ▼
    前端展示"🗃️ 数据库核验"卡片（独立于 LLM 文字）
```

---

### 3.7 PydanticAI 实现骨架

```python
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass

@dataclass
class Deps:
    """运行时上下文，不通过 LLM 传递，直接注入工具函数"""
    attached_file: str | None = None

agent = Agent(
    model,
    deps_type=Deps,
    system_prompt=SYSTEM_PROMPT,  # 包含 L2/L4 规则
    retries=2,
)

# L1 锚点注入：在工具实现里而非 System Prompt
@agent.tool_plain
def get_datasheet(model: str, query: str = "") -> str:
    return _datasheet_lookup(model, query)  # 内部已注入 DB 权威值

# L2 核验工具
@agent.tool_plain
def compare_chips(models: list[str]) -> str:
    return "\n".join(_chip_summary(_detail(m)) for m in models)

# 长期记忆动态注入 System Prompt
@agent.system_prompt
def _inject_memory() -> str:
    return memory.memory_prompt_text()

# 需要访问 deps 的工具
@agent.tool
def analyze_customer_spec(ctx: RunContext[Deps]) -> str:
    return _run_matcher(ctx.deps.attached_file)
```

### 3.8 工具输入 Schema 设计

```python
class ChipFilters(BaseModel):
    """description 里直接写触发词映射，比 System Prompt 里写更可靠"""
    category: Optional[str] = Field(
        None,
        description=(
            "品类（必须用中文）：音箱|耳机|BLE。"
            "英文映射：earphone/headphone/earbud→耳机；speaker→音箱"
        ),
    )
    mic_min: Optional[int] = Field(
        None,
        description="最少 MIC 路数。触发词：5MIC/five mic/5路麦 → mic_min=5",
    )
    ram_min_kb: Optional[float] = Field(None, description="最小 RAM (KB)")
    tws: Optional[bool] = None
    anc: Optional[bool] = None
```

**原则**：`description` 紧贴字段定义，LLM 调用工具时会读取这里的说明；放在 System Prompt 里距离太远，容易被忽略或遗忘。

### 3.9 入口函数

```python
def run_chat(
    user_text: str,
    history_json: bytes | None = None,
    cfg: LLMConfig | None = None,
    attached_file: str | None = None,
) -> tuple[str, bytes]:
    agent = build_agent(cfg)
    history = None
    if history_json:
        history = ModelMessagesTypeAdapter.validate_json(history_json)
    result = agent.run_sync(
        user_text,
        message_history=history,
        deps=Deps(attached_file=attached_file),
    )
    return result.output, result.all_messages_json()
    # 调用方负责：L5 后处理校验 + 存储 history_json
```

---

## 4. 工具（Tools）设计

### 4.1 本项目的工具清单

| 工具 | 类型 | 作用 |
|------|------|------|
| `search_chips(filters)` | tool_plain | SQL 过滤返回候选集，**推荐的权威来源** |
| `compare_chips(models)` | tool_plain | 批量拉取详细参数，用于核验 |
| `get_chip_detail(model)` | tool_plain | 单颗芯片全参数 |
| `get_datasheet(model, query)` | tool_plain | 查文档，query 非空时返回相关片段 |
| `search_datasheets(keyword)` | tool_plain | 全库关键词搜索 |
| `generate_pin_assignment(model, funcs)` | tool_plain | 接线清单（确定性查表） |
| `analyze_customer_spec()` | tool（带 ctx） | 解析上传的客户 Excel |
| `remember(content, kind)` | tool_plain | 写入长期记忆 |

### 4.2 工具返回值格式

工具返回 `str`，不返回结构化对象。原因：
- LLM 消费文本，不需要 JSON
- 可以直接格式化对 LLM 有意义的摘要，而不是原始数据

```python
def _chip_summary(c: dict) -> str:
    """把数据库行转成 LLM 容易理解的单行文本"""
    parts = [f"【{c['model']}】"]
    if c.get("ram_kb"):    parts.append(f"RAM:{c['ram_kb']}KB")
    if c.get("mic_count"): parts.append(f"MIC:{c['mic_count']}路")
    if c.get("anc"):       parts.append("ANC")
    if c.get("tws_support"): parts.append("TWS")
    ...
    return " | ".join(parts)
```

### 4.3 防幻觉工具设计原则

**原则：工具返回的数据自带权威标注，让 LLM 无法忽视**

```python
def _datasheet_lookup(model: str, query: str) -> str:
    # 先注入数据库权威值（Tier 1 锚点）
    db_summary = _chip_db_summary(model)  # "MIC:3路 | RAM:408KB | ..."
    
    # 再看文档
    rows = _fetch_docs(model)
    if not rows:
        return f"【数据库参数（权威）】{db_summary}\n\n该型号暂无入库文档。"
    
    if _only_series_docs(rows):
        # 系列文档加强制警告
        return (
            f"【数据库参数（权威，以此为准）】{db_summary}\n\n"
            f"⚠️ 以下为系列级参考文档，展示整个系列的最大引脚集合，"
            f"不代表 {model} 的实际规格：\n" + _format_docs(rows)
        )
    
    # 精确文档直接返回
    return _format_docs(rows)
```

---

## 5. System Prompt 写法参考

Harness 各层规则（L1/L2/L4）都通过 System Prompt 传达给 LLM。以下是完整结构模板，各节对应关系见注释：

```
你是[领域]产品选型助手，服务[用户角色]，用简洁[语言]作答。

━━ 工具清单 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
search_products(filters)     按条件从数据库筛选，结果是权威候选集
compare_products(models)     批量对比完整参数（L2 核验步骤专用）
get_product_detail(model)    单个产品全参数
get_datasheet(model, query)  查已入库文档正文
remember(content, kind)      记住用户长期偏好

━━ 执行协议（L2，内部流程，步骤标签不输出给用户）━━━━━━
⚠️ [解析]/[搜索]/[核验]/[输出] 是内部执行标记，
   绝对不允许出现在发给用户的最终回复文字中。

  1. [解析] 从用户需求提取结构化 filters
  2. [搜索] search_products(filters) — 返回列表即推荐范围全集
  3. [核验] compare_products(候选列表) — 不可跳过
  4. [输出] 直接输出推荐，不写步骤标签

━━ 信息层级（L1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tier 1（最高）数据库返回值 / compare_products / search_products
  Tier 2（中）  产品专属 Datasheet
  Tier 3（参考）系列/通用文档 — 只供参考，不可推断具体型号规格

上级与下级矛盾时，以上级为准。

━━ 铁律（L4 硬约束）━━━━━━━━━━━━━━━━━━━━━━━━━
· search_products 结果之外的产品，禁止出现在推荐里
  认为漏选 → 重新调整 search_products 参数，不要自行添加
· 不编造数据库中没有的参数
· 系列文档里的规格不等于具体型号的规格

━━ 对话规则 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· 指代（"上一个""更便宜的"）在已有结果上收窄，不从零重查
· 需求含糊先反问，不臆造推荐
· 用户透露稳定偏好时调用 remember
```

**写好 System Prompt 的三条原则**：

1. **步骤标签必须声明是内部标记**：不加这句，LLM 会把"第四步：输出推荐"当作回复的一部分输出
2. **禁令要针对具体错误模式**：写"系列文档里的 MIC 路数不等于具体型号规格"，比写"不要幻觉"有效十倍
3. **信息层级放 System Prompt，权威值注入放工具实现**：两者缺一不可——System Prompt 说"Tier 1 最高"，工具返回值把 DB 数据打在最前面，双重锚定

---

## 6. 两层记忆系统

### 6.1 会话内记忆（短期）

PydanticAI 原生支持多轮：把 `result.all_messages_json()` 存到 SQLite，下一轮传入 `message_history` 参数。

```python
# 存储
save_messages_json(conv_id, result.all_messages_json())

# 恢复
history_json = load_messages_json(conv_id)
history = ModelMessagesTypeAdapter.validate_json(history_json)
result = agent.run_sync(user_text, message_history=history, ...)
```

`messages_json` 是原始 PydanticAI 消息格式，包含工具调用记录，不需要手动处理。

### 6.2 跨会话记忆（长期）

```python
# 工具：LLM 主动调用，把用户的稳定偏好写入 DB
@agent.tool_plain
def remember(content: str, kind: str = "preference") -> str:
    memory.add_memory(content, kind)
    return f"已记住：{content}"

# 注入：每次运行前自动追加到系统提示词
@agent.system_prompt
def _inject_memory() -> str:
    rows = list_memory(limit=30)
    lines = [f"- [{r['kind']}] {r['content']}" for r in rows]
    return "用户长期偏好：\n" + "\n".join(lines)
```

**触发时机**：在 System Prompt 里写明 `"用户透露稳定偏好/背景时调用 remember"`，例如"我们只做 TWS 耳机"、"我们的供应商只接受 QFN 封装"。

---

## 7. 文档索引与检索

### 7.1 入库流程

```python
def register_doc(src_path: str, model: str) -> dict:
    # 1. 复制到 docs/<model>/<filename>
    dest = docs_dir / model / Path(src_path).name
    shutil.copy2(src_path, dest)

    # 2. 提取文本（PDF 用 pdfplumber，Excel 用 openpyxl）
    content = extract_text(dest)  # 最多 80 页

    # 3. 按文件名判断类型
    kind = classify_kind(dest.name)
    # "datasheet" / "pinfunction" / "schematic" / "manual"

    # 4. 写入 datasheets 表
    conn.execute(
        "INSERT INTO datasheets (model, kind, filename, rel_path, content) VALUES ...",
        [model, kind, filename, rel_path, content]
    )
    # 5. 同步更新 chips.datasheet_path（供列表展示 DS 徽章）
    if kind == "datasheet":
        conn.execute("UPDATE chips SET datasheet_path=? WHERE model=?", ...)
```

### 7.2 检索策略

```python
def _excerpt(content: str, query: str, width: int = 600) -> str:
    """返回包含 query 关键词的上下文片段，而不是整个文档"""
    idx = content.lower().find(query.lower())
    if idx == -1:
        return content[:width]  # 找不到就返回开头
    start = max(0, idx - 200)
    return content[start : start + width]
```

**不用向量搜索的理由**：
- 文档总量小（几百份），grep 式检索足够
- 精确字段查询（PIN 号、参数值）用关键词比语义更准确
- 不依赖向量数据库，整个应用打成单一 EXE

### 7.3 系列文档 vs 型号专属文档

```python
def _doc_matches_model(target_model: str, doc_model: str, filename: str) -> bool:
    """
    精确匹配：doc_model == target_model → True
    系列回退：doc_model 以 'X' 结尾，如 BT897X → 匹配 BT8970H/BT8971H 等
    但系列文档不能错误匹配：BT896X 不匹配 BT8970H
    """
    if doc_model == target_model:
        return True
    if not doc_model.endswith("X"):
        return False
    prefix = doc_model[:-1]           # "BT897"
    if not target_model.startswith(prefix):
        return False
    # 如果文件名里有具体型号，只匹配那个型号
    concrete = _filename_model_token(filename)
    return concrete in (None, "", target_model)
```

---

## 8. LLM 提供商抽象

```python
@dataclass
class LLMConfig:
    provider: str
    model: str
    api_key: str
    base_url: str | None = None

    @classmethod
    def from_env(cls) -> "LLMConfig":
        provider = os.getenv("LLM_PROVIDER", "deepseek").lower()
        if provider == "claude":
            return cls(provider="claude", model=..., api_key=os.getenv("ANTHROPIC_API_KEY"))
        if provider == "deepseek":
            return cls(
                provider="openai_compat",
                model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
                api_key=os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
            )
        # OpenAI / SiliconFlow / Ollama / 自定义
        return cls(provider="openai_compat", base_url=os.getenv("LLM_BASE_URL"), ...)


def _build_model(cfg: LLMConfig):
    if cfg.provider == "claude":
        from pydantic_ai.models.anthropic import AnthropicModel
        return AnthropicModel(cfg.model, provider=AnthropicProvider(...))
    # 其余全部走 OpenAI 兼容接口
    return OpenAIChatModel(
        cfg.model,
        provider=OpenAIProvider(base_url=cfg.base_url, api_key=cfg.api_key),
    )
```

**.env 配置示例**：

```env
# 选择提供商（deepseek / claude / openai / custom）
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# 或切换到 Claude
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=sk-ant-xxx
# CLAUDE_MODEL=claude-sonnet-4-6
```

---

## 9. 多轮对话管理

### 9.1 对话生命周期

```
新建对话 → create_conversation() → 返回 conv_id
    │
每轮问答 → run_chat(text, load_messages_json(conv_id))
         → save_messages_json(conv_id, result.all_messages_json())
    │
历史展示 → history_to_display(messages_json)
         → 解析 PydanticAI 消息，只返回 user/assistant 的 {role, content}
```

### 9.2 指代消解（上下文理解）

在 System Prompt 里添加：
```
指代（"上一个""更便宜的""RAM 再大点"）在已有结果上收窄，不从零重查。
需求含糊时先反问品类/关键功能，不臆造推荐。
```

PydanticAI 的 `message_history` 自动把整个对话历史传给模型，指代消解由 LLM 自然处理。

---

## 10. 快速复用清单

用这套架构做其他垂直领域选型助手，需要替换以下部分：

### 必须替换

| 文件/模块 | 替换内容 |
|-----------|---------|
| `db/database.py` — `chips` 表 DDL | 改为你的产品字段（量化指标 + 布尔特性） |
| `query/engine.py` — `_build_sql` | 对应新字段的 SQL 过滤逻辑 |
| `query/engine.py` — `_chip_summary` | 适配新字段的单行摘要文本 |
| `agent/chip_agent.py` — `ChipFilters` | 新的 Pydantic 过滤 schema |
| `agent/chip_agent.py` — `SYSTEM_PROMPT` | 替换品类/触发词/工具描述 |
| `importers/` | 你的数据导入脚本（Excel/CSV/API） |

### 可直接复用

| 文件/模块 | 说明 |
|-----------|------|
| `agent/memory.py` | 两层记忆（会话 + 长期）开箱即用 |
| `config.py` — `LLMConfig` | DeepSeek/Claude/OpenAI 三合一切换 |
| `_build_model` / `build_agent` | Agent 工厂，换 model 即可 |
| `run_chat` | 多轮对话入口，接口不变 |
| `db/database.py` — `datasheets / conversations / user_memory` | 文档索引 + 对话历史表结构通用 |
| `_register_doc_in_db` | PDF 注册 + 全文提取，换路径即用 |
| `_excerpt` | 关键词片段提取 |

### 数据库初始化（约 30 行核心代码）

```python
# 仿照 db/database.py 模式
DDL = """
CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model       TEXT NOT NULL,
    category    TEXT NOT NULL,
    -- 量化字段
    price       REAL,
    weight_g    REAL,
    battery_mah INTEGER,
    -- 布尔特性
    waterproof  INTEGER DEFAULT 0,
    wireless    INTEGER DEFAULT 0,
    -- 冗余 JSON
    specs       TEXT
);
"""

def get_conn():
    conn = sqlite3.connect("db/products.db")
    conn.row_factory = sqlite3.Row
    conn.executescript(DDL)
    return conn
```

### Harness 快速套用

复制 §3.2–§3.5 的四层结构，替换以下占位符：

| 占位符 | 替换为 |
|--------|--------|
| `search_products` | 你的主搜索工具名 |
| `compare_products` | 你的核验工具名 |
| `[领域]` | 具体业务名称 |
| 系列文档说明 | 针对你领域特有的文档/数据来源冲突场景 |

L5 后处理校验（`_verify_chip_claims` 模式）直接复用，把正则里的 `BT|AB` 换成你的产品型号前缀模式即可。

---

*参考实现代码：`agent/chip_agent.py`、`query/engine.py`、`db/database.py`、`agent/memory.py`*

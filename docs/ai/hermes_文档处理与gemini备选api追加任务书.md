# Hermes 追加任务书：文档处理能力优化 + Gemini API 备选与图片默认路由

> 使用方式：把本文档直接发给 Hermes，让它按“执行要求”逐步修改配置、安装/创建 Skills、验证功能。不要覆盖已经正常工作的 DeepSeek 主模型、微信、cron、memory、terminal/file 等现有配置。

---

## 0. 总目标

当前 Hermes 已经完成基础部署和第一轮配置优化。现在继续补充两类能力：

1. **文档处理能力增强**
   - 以后处理 Excel / Word / PDF / PPT 时，不要只输出 `.txt`、纯文本摘要、Markdown 草稿。
   - 默认要输出用户能直接打开和发送的真实文件格式：`.xlsx`、`.docx`、`.pdf`、`.pptx`。
   - 需要尽量保留原文件格式、样式、布局、图片、表格、公式、标题层级、页眉页脚、批注等。
   - 修改已有文件时，必须先备份原文件，不允许直接覆盖原文件。

2. **接入 Gemini API 作为 DeepSeek 的备选 API**
   - DeepSeek 继续作为主模型。
   - Gemini API 作为 fallback / backup provider。
   - 图片理解、截图分析、PDF 页面截图分析、OCR、图片生成/编辑等视觉相关任务，默认优先使用 Gemini API。
   - 如果 Hermes 的辅助视觉配置不支持直接 `provider: gemini`，则使用 Gemini 的 OpenAI-compatible endpoint 或单独创建 Gemini 图片处理 Skill。

---

## 1. 执行前必须先备份

请先执行：

```bash
mkdir -p ~/.hermes_backups
backup_dir=~/.hermes_backups/hermes_backup_$(date +%Y%m%d_%H%M%S)
cp -a ~/.hermes "$backup_dir"
echo "Hermes backup saved to: $backup_dir"
```

检查现有配置：

```bash
hermes config show
hermes model
hermes fallback list || true
hermes skills list || true
hermes tools || true
```

执行原则：

- 不要删除现有可用配置。
- 不要覆盖 DeepSeek 主模型。
- 不要把 API Key 写入聊天记录或公开日志。
- 如果需要用户输入 Gemini API Key，只提示用户在本地终端输入或编辑 `~/.hermes/.env`。
- 如果配置失败，恢复备份并汇报失败点。

---

## 2. Gemini API Key 配置

优先使用 API Key 路线，不优先使用 Google Gemini OAuth。OAuth 方式可能涉及账号策略风险，因此默认不使用。

请检查 `~/.hermes/.env` 是否已有以下任一变量：

```bash
grep -E '^(GEMINI_API_KEY|GOOGLE_API_KEY)=' ~/.hermes/.env 2>/dev/null || true
```

如果没有，让用户手动添加其中一个即可：

```env
GEMINI_API_KEY=你的Gemini_API_Key
```

或者：

```env
GOOGLE_API_KEY=你的Gemini_API_Key
```

注意：Hermes 官方文档中 Google / Gemini API Key provider 使用 `provider: gemini`，环境变量支持 `GOOGLE_API_KEY` 或 `GEMINI_API_KEY`。

完成后测试 Gemini OpenAI-compatible endpoint：

```bash
curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "用中文回复：Gemini API 测试成功。"}
    ]
  }'
```

如果用户使用的是 `GOOGLE_API_KEY`，请把命令里的 `$GEMINI_API_KEY` 改成 `$GOOGLE_API_KEY`。

---

## 3. 保持 DeepSeek 主模型，添加 Gemini fallback

目标配置逻辑：

```yaml
model:
  provider: deepseek
  default: deepseek-chat

fallback_model:
  provider: gemini
  model: gemini-2.5-flash
```

如果当前配置已经使用 `fallback_providers:`，则追加 Gemini，不要覆盖原 fallback 链：

```yaml
fallback_providers:
  - provider: gemini
    model: gemini-2.5-flash
```

优先通过 Hermes 命令配置：

```bash
hermes model
hermes fallback add
hermes fallback list
```

如果 Hermes 命令无法添加 Gemini fallback，再手动编辑 `~/.hermes/config.yaml`。

Gemini 模型选择建议：

```text
备用通用模型：gemini-2.5-flash
高质量复杂推理：gemini-2.5-pro
图片理解/截图分析：gemini-2.5-flash
图片生成/图片编辑：gemini-2.5-flash-image
```

不要把 `gemini-3-* preview` 作为默认生产配置，除非用户明确要求使用预览模型。

---

## 4. 让视觉/图片任务默认使用 Gemini

目标：只要用户上传图片、截图、照片、PDF 页面截图，或者提出 OCR、图片识别、图片内容分析、图片对比、图像生成、图像编辑等任务，默认优先使用 Gemini。

### 4.1 优先尝试 Hermes auxiliary vision 配置

请先尝试在 `~/.hermes/config.yaml` 中加入或合并以下配置：

```yaml
auxiliary:
  vision:
    provider: gemini
    model: gemini-2.5-flash
  compression:
    provider: auto
    model: ""
  session_search:
    provider: auto
    model: ""
  title_generation:
    provider: auto
    model: ""
```

然后测试：

```bash
hermes config show
hermes chat --toolsets vision,file -q "之后遇到图片、截图、OCR、PDF页面视觉分析，默认优先使用 Gemini API。请确认你的视觉辅助模型配置。"
```

如果 Hermes 报错或不接受 `auxiliary.vision.provider: gemini`，不要硬改；改用 4.2 的 Skill 方案。

### 4.2 兜底方案：创建 Gemini 图片处理 Skill

请创建目录：

```bash
mkdir -p ~/.hermes/skills/productivity/gemini-image-processing/scripts
```

创建 `~/.hermes/skills/productivity/gemini-image-processing/SKILL.md`：

```bash
cat > ~/.hermes/skills/productivity/gemini-image-processing/SKILL.md <<'SKILL'
---
name: gemini-image-processing
description: 当用户处理图片、截图、照片、扫描件、PDF页面图片、OCR、图片内容识别、图片对比、图片生成或图片编辑时，默认优先使用 Gemini API。输出必须说明使用了哪个文件和模型，不要只给泛泛描述。
version: 1.0.0
platforms: [linux, windows, macos]
metadata:
  hermes:
    tags: [gemini, image, vision, ocr, pdf, screenshot]
    category: productivity
    requires_toolsets: [terminal, file]
---

# Gemini 图片处理默认流程

## 触发条件

用户出现以下任一意图时使用本技能：

- 上传图片、截图、照片、UI界面图、电路图、遥控器图片、硬件照片。
- 需要 OCR、识别图片文字、读取截图内容。
- 需要分析 PDF 中的图片页、扫描件、表格截图。
- 需要对比两张图片差异。
- 需要图片生成、图片编辑、背景替换、局部修改、风格保持。

## 默认模型

- 图片理解 / OCR / 截图分析：`gemini-2.5-flash`
- 复杂图片推理：`gemini-2.5-pro`
- 图片生成 / 图片编辑：`gemini-2.5-flash-image`

## API Key 规则

优先读取环境变量：

1. `GEMINI_API_KEY`
2. `GOOGLE_API_KEY`

不要把 API Key 写入输出文档、日志或技能说明里。

## 处理规则

1. 先确认输入图片路径存在。
2. 使用 Gemini API 读取图片，不要只用本地 OCR 粗暴识别。
3. 输出时说明：输入文件、任务类型、使用模型、结论。
4. 如果用户要的是文档结果，必须输出真实文件，例如 `.docx`、`.pdf`、`.pptx`、`.xlsx`，不要只输出 `.txt`。
5. 如果 Gemini API 不可用，才使用本地 OCR / 其他模型，并明确说明 fallback 原因。

## 常用命令

图片理解 / OCR：

```bash
python ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_vision.py \
  --image "input.png" \
  --prompt "请用中文详细识别这张图片的内容，若有文字请尽量完整提取。"
```

图片生成：

```bash
python ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_image_generate.py \
  --prompt "生成一张简洁科技风封面图" \
  --output "output.png"
```

## 验证

每次处理完成后检查输出文件是否真实存在：

```bash
ls -lh output.png output.docx output.xlsx output.pptx output.pdf 2>/dev/null || true
```
SKILL
```

创建图片理解脚本：

```bash
cat > ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_vision.py <<'PY'
#!/usr/bin/env python3
import argparse
import base64
import json
import mimetypes
import os
import sys
from pathlib import Path
from urllib import request, error


def get_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise SystemExit("ERROR: GEMINI_API_KEY or GOOGLE_API_KEY is not set")
    return key


def main() -> None:
    parser = argparse.ArgumentParser(description="Use Gemini OpenAI-compatible API for image understanding/OCR.")
    parser.add_argument("--image", required=True, help="Image file path")
    parser.add_argument("--prompt", required=True, help="Prompt for Gemini")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model")
    args = parser.parse_args()

    image_path = Path(args.image).expanduser()
    if not image_path.exists():
        raise SystemExit(f"ERROR: image not found: {image_path}")

    mime = mimetypes.guess_type(str(image_path))[0] or "image/png"
    b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")

    payload = {
        "model": args.model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": args.prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ],
            }
        ],
    }

    req = request.Request(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {get_key()}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP ERROR {e.code}: {body}")

    try:
        print(data["choices"][0]["message"]["content"])
    except Exception:
        print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
PY
chmod +x ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_vision.py
```

创建图片生成脚本：

```bash
cat > ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_image_generate.py <<'PY'
#!/usr/bin/env python3
import argparse
import base64
import json
import os
from pathlib import Path
from urllib import request, error


def get_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise SystemExit("ERROR: GEMINI_API_KEY or GOOGLE_API_KEY is not set")
    return key


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate image with Gemini OpenAI-compatible Images API.")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="gemini-2.5-flash-image")
    parser.add_argument("--size", default="1024x1024")
    args = parser.parse_args()

    payload = {
        "model": args.model,
        "prompt": args.prompt,
        "n": 1,
        "size": args.size,
        "response_format": "b64_json",
    }

    req = request.Request(
        "https://generativelanguage.googleapis.com/v1beta/openai/images/generations",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {get_key()}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP ERROR {e.code}: {body}")

    b64 = data["data"][0]["b64_json"]
    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(b64))
    print(f"Generated image: {output}")


if __name__ == "__main__":
    main()
PY
chmod +x ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_image_generate.py
```

测试 Skill 是否能被发现：

```bash
hermes chat --toolsets skills,terminal,file -q "列出和图片处理相关的 skill，并确认 gemini-image-processing 已可用。"
```

---

## 5. 文档处理 Skills：不要输出 TXT 风格，要输出真实 Office/PDF 文件

### 5.1 安装或恢复文档类 Skills

先搜索可用 Skills：

```bash
hermes skills search docx --source github || true
hermes skills search xlsx --source github || true
hermes skills search pdf --source github || true
hermes skills search pptx --source github || true
hermes skills search document --source skills-sh || true
```

优先安装或检查以下文档类 Skills：

```bash
hermes skills inspect anthropics/skills/skills/docx || true
hermes skills inspect anthropics/skills/skills/xlsx || true
hermes skills inspect anthropics/skills/skills/pdf || true
hermes skills inspect anthropics/skills/skills/pptx || true
```

如果 inspect 正常，再安装：

```bash
hermes skills install anthropics/skills/skills/docx --force || true
hermes skills install anthropics/skills/skills/xlsx --force || true
hermes skills install anthropics/skills/skills/pdf --force || true
hermes skills install anthropics/skills/skills/pptx --force || true
```

如果上面的 GitHub 路径不可用，改用搜索结果中实际返回的路径。安装前必须 `inspect`，不要盲目安装未知第三方 Skill。

### 5.2 创建本地文档输出规则 Skill

创建目录：

```bash
mkdir -p ~/.hermes/skills/productivity/native-document-output
```

创建 `~/.hermes/skills/productivity/native-document-output/SKILL.md`：

```bash
cat > ~/.hermes/skills/productivity/native-document-output/SKILL.md <<'SKILL'
---
name: native-document-output
description: 当用户要求处理 Excel、Word、PDF、PPT、报告、表格、演示文稿、简历、说明书、合同、技术文档时，必须优先输出真实文件格式（.xlsx/.docx/.pdf/.pptx），不要只输出 txt 或纯 Markdown 风格内容。
version: 1.0.0
platforms: [linux, windows, macos]
metadata:
  hermes:
    tags: [docx, xlsx, pdf, pptx, office, document]
    category: productivity
    requires_toolsets: [terminal, file]
---

# Native Document Output Rules

## 总规则

用户要求文档处理、文档优化、格式美化、报告生成、表格整理、PPT制作、PDF处理时，默认交付真实文件：

- Excel：`.xlsx`，必要时保留公式、样式、图表、筛选、冻结窗格。
- Word：`.docx`，必要时包含标题样式、目录、页眉页脚、表格、图片、批注。
- PowerPoint：`.pptx`，必要时包含版式、母版风格、图表、图片、备注。
- PDF：`.pdf`，必要时合并、拆分、加水印、提取页面、表单填写、图片提取、OCR。

不要把最终结果只输出成 `.txt`、纯文本、Markdown 草稿。除非用户明确说“只要文本”。

## 修改已有文件时

1. 先复制备份：`原文件名.backup_YYYYMMDD_HHMMSS.扩展名`。
2. 新文件用明确名称输出，例如：`原文件名_optimized.docx`、`原文件名_cleaned.xlsx`、`原文件名_merged.pdf`。
3. 不要直接覆盖原文件。
4. 处理完成后检查文件是否存在、大小是否合理。
5. 能打开验证时，尽量用 Python / LibreOffice / unzip / file 命令做基本验证。

## Excel / XLSX 规则

- 优先使用 `openpyxl` 保留样式和公式。
- 数据分析可用 `pandas`，但最终必须写回 `.xlsx`，不能只给 `.csv` 或 `.txt`。
- 不要破坏已有公式；改公式前先备份。
- 重要表格需要设置：标题行加粗、列宽、冻结首行、筛选、数字格式、日期格式。
- 交付前检查公式错误：`#REF!`、`#DIV/0!`、`#VALUE!`、`#N/A`、`#NAME?`。

## Word / DOCX 规则

- 优先输出 `.docx`。
- 使用标题层级、编号、表格、页眉页脚，不要输出像 txt 一样的纯段落。
- 技术文档要包含：标题、版本、适用范围、目录或章节结构、步骤、注意事项、验证方法。
- 如果需要 PDF 版，先生成 `.docx`，再转换或导出 `.pdf`。

## PDF 规则

- 能直接操作 PDF 的，优先使用 `pypdf` / `PyMuPDF` / `reportlab`。
- 需要生成正式 PDF 时，优先从 `.docx` / `.html` / `.pptx` / `.xlsx` 导出 PDF，避免排版变乱。
- 扫描件或图片型 PDF，需要 OCR 时优先使用 Gemini 视觉 Skill；必要时再使用本地 OCR。
- 合并/拆分 PDF 后要检查页数。

## PPT / PPTX 规则

- 最终输出 `.pptx`，不要只输出大纲。
- 每页要有标题、正文层次、留白、统一字体和色彩。
- 优先根据用户内容生成可演示的页面，而不是仅生成 Markdown。
- 技术 PPT 默认结构：封面、背景、问题、方案、流程/架构、关键实现、验证结果、风险与后续计划。

## 验证命令示例

```bash
file output.docx output.xlsx output.pptx output.pdf 2>/dev/null || true
ls -lh output.docx output.xlsx output.pptx output.pdf 2>/dev/null || true
python - <<'PY'
from pathlib import Path
for p in Path('.').glob('*'):
    if p.suffix.lower() in ['.docx', '.xlsx', '.pptx', '.pdf']:
        print(p, p.stat().st_size)
PY
```

## 汇报格式

完成文档处理任务后，必须汇报：

1. 输入文件。
2. 输出文件路径。
3. 输出格式。
4. 做了哪些优化。
5. 是否保留原文件备份。
6. 是否完成基本打开/结构验证。
SKILL
```

---

## 6. 安装文档处理依赖

请检测 Python 环境：

```bash
python3 --version
python3 -m pip --version || true
```

优先安装常用文档库：

```bash
python3 -m pip install --user --upgrade \
  openpyxl pandas xlsxwriter python-docx python-pptx \
  pypdf pymupdf reportlab pillow lxml defusedxml markdownify beautifulsoup4 \
  google-genai openai
```

如果使用 WSL，并且用户允许安装系统工具，再安装以下可选工具：

```bash
sudo apt update
sudo apt install -y libreoffice pandoc poppler-utils tesseract-ocr tesseract-ocr-chi-sim fonts-noto-cjk
```

注意：

- 没有 sudo 权限时不要卡死，跳过系统工具安装，使用纯 Python 方案。
- LibreOffice 主要用于 Office 与 PDF 转换。
- `fonts-noto-cjk` 用于减少中文文档导出 PDF 时乱码。

---

## 7. 把用户偏好写入 Hermes Memory

请把下面内容写入 Hermes 的长期记忆：

```text
用户希望 Hermes 处理 Word、Excel、PDF、PPT 等文档时，默认输出真实 Office/PDF 文件格式，不要只输出 txt、纯文本或 Markdown 风格草稿。Word 输出 .docx，Excel 输出 .xlsx，PPT 输出 .pptx，PDF 输出 .pdf。修改已有文件前必须备份原文件，输出新文件并做基本验证。

用户希望 DeepSeek 继续作为 Hermes 主模型，同时接入 Gemini API 作为备选 provider。图片、截图、照片、OCR、PDF 页面视觉分析、图片对比、图片生成、图片编辑等视觉类任务默认优先使用 Gemini API。

用户使用 Windows + WSL2 环境，技术文档和脚本最好给出可以直接执行的命令，中文回答优先。
```

---

## 8. 测试任务

配置完成后，请执行以下测试，不要跳过。

### 8.1 Gemini 文本 API 测试

```bash
curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "请用中文回复：Gemini fallback 配置测试成功。"}]
  }'
```

### 8.2 Hermes fallback 测试

```bash
hermes fallback list || true
hermes chat -q "请确认 DeepSeek 是主模型，Gemini 是 fallback。如果主模型失败，应该切换到 Gemini。"
```

### 8.3 文档 Skill 测试

```bash
hermes chat --toolsets skills,terminal,file -q "以后我让你优化 Word、Excel、PDF、PPT 时，不要输出 txt 风格，要输出真实 .docx/.xlsx/.pdf/.pptx 文件。请确认 native-document-output skill 已可用。"
```

### 8.4 图片 Skill 测试

如果当前目录有图片，例如 `test.png`：

```bash
python ~/.hermes/skills/productivity/gemini-image-processing/scripts/gemini_vision.py \
  --image test.png \
  --prompt "请用中文识别这张图片中的内容。"
```

没有图片时，只确认 Skill 存在：

```bash
hermes chat --toolsets skills,terminal,file -q "请确认 gemini-image-processing skill 已可用。以后图片、截图、OCR、PDF页面视觉分析默认使用 Gemini。"
```

---

## 9. 完成后汇报模板

执行完成后，请按这个格式回复用户：

```text
已完成 Hermes 追加配置：

1. 已备份配置：<backup_path>
2. DeepSeek 主模型：保留 / 未修改
3. Gemini API：已接入 / 未接入，原因：...
4. Gemini fallback：已配置 / 未配置，当前 fallback 列表：...
5. 图片默认 Gemini：已通过 auxiliary.vision 配置 / 已通过 gemini-image-processing skill 兜底
6. 文档处理规则：已创建 native-document-output skill
7. 文档类 skills：docx/xlsx/pdf/pptx 已安装或已检查，结果：...
8. 依赖安装：已安装 / 部分跳过，原因：...
9. 验证结果：...
10. 后续使用方式：用户直接发送 Word/Excel/PDF/PPT/图片文件，并说明要优化/整理/转换即可。
```

---

## 10. 后续使用示例

完成配置后，用户可以这样使用：

```text
帮我把这个 Word 文档优化成正式技术文档，输出 .docx 和 .pdf，不要只给文本。
```

```text
帮我整理这个 Excel，修复格式、冻结首行、添加筛选、调整列宽，输出新的 .xlsx。
```

```text
帮我把这份 PDF 拆成多个文件，并提取表格到 Excel。
```

```text
帮我把这个 Markdown 内容做成 PPT，输出 .pptx。
```

```text
识别这张图片里的内容，默认用 Gemini API。
```

```text
分析这张截图里的报错，并给我排查步骤。
```

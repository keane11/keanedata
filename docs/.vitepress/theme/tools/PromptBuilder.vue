<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Preset { name: string; role: string; task: string; context: string; constraints: string; format: string; examples: string }

const builtins: Preset[] = [
  {
    name: '代码助手',
    role: '你是一位资深软件工程师，精通多种编程语言和设计模式。',
    task: '帮我实现以下功能：[功能描述]',
    context: '项目使用 [技术栈]，代码需要与现有模块集成。',
    constraints: '- 优先考虑可读性和可维护性\n- 不引入不必要的依赖\n- 添加必要的错误处理',
    format: '先给出核心实现代码，再简要解释关键逻辑，最后列出使用示例。',
    examples: '',
  },
  {
    name: '翻译助手',
    role: '你是一位专业翻译，擅长技术文档和学术论文的中英互译。',
    task: '将以下内容翻译为 [目标语言]：\n\n[待翻译内容]',
    context: '这是一篇 [文档类型] 文档，面向 [目标读者]。',
    constraints: '- 保持专业术语的准确性\n- 保留原文的格式和结构\n- 遇到无对应翻译的词汇保留原文并加括号标注',
    format: '直接输出译文，无需解释。',
    examples: '',
  },
  {
    name: '文章写作',
    role: '你是一位经验丰富的技术写作者，善于将复杂概念用简洁语言表达。',
    task: '写一篇关于 [主题] 的技术文章。',
    context: '目标读者是有一定基础的 [读者群体]，文章将发布在 [平台]。',
    constraints: '- 字数控制在 [X] 字以内\n- 包含实际代码示例\n- 避免过于学术化的表达',
    format: '使用 Markdown 格式，包含：引言、核心内容（分小节）、总结、延伸阅读。',
    examples: '',
  },
  {
    name: '数据分析',
    role: '你是一位数据分析师，擅长从数据中发现规律和业务洞见。',
    task: '分析以下数据，找出关键趋势和异常：\n\n[数据内容]',
    context: '数据来自 [数据源]，时间跨度 [时间范围]，业务背景 [背景说明]。',
    constraints: '- 使用具体数字支撑结论\n- 标注数据局限性\n- 按重要性排列发现',
    format: '分三部分：核心发现（3-5条）、详细分析、行动建议。',
    examples: '',
  },
  {
    name: '代码审查',
    role: '你是一位代码质量专家，擅长发现潜在的缺陷、安全漏洞和设计问题。',
    task: '请审查以下代码：\n\n```[语言]\n[代码内容]\n```',
    context: '这段代码的功能是 [功能说明]，运行在 [环境]。',
    constraints: '- 重点关注安全性、性能和可维护性\n- 发现问题请给出具体行号和修复建议\n- 先列出严重问题，再列出优化建议',
    format: '分三级输出：🔴 严重问题、🟡 改进建议、🟢 值得肯定的地方。',
    examples: '',
  },
  {
    name: '自定义',
    role: '', task: '', context: '', constraints: '', format: '', examples: '',
  },
]

const STORAGE_KEY = 'prompt-builder-custom-presets'
const customPresets = ref<Preset[]>([])

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) customPresets.value = JSON.parse(saved)
  } catch {}
})

const allPresets = computed(() => [...builtins, ...customPresets.value])

const selectedPreset = ref(builtins[0].name)
const role = ref(builtins[0].role)
const task = ref(builtins[0].task)
const context = ref(builtins[0].context)
const constraints = ref(builtins[0].constraints)
const format = ref(builtins[0].format)
const examples = ref(builtins[0].examples)
const copied = ref(false)
const saveNotice = ref('')

const fields: { key: keyof Omit<Preset,'name'>; label: string; rows: number; placeholder: string }[] = [
  { key: 'role', label: '角色设定', rows: 2, placeholder: '告诉 AI 它是谁，建立专业背景...' },
  { key: 'task', label: '任务描述', rows: 3, placeholder: '清晰描述你要做什么，必要时使用 [占位符] 标记需要替换的内容...' },
  { key: 'context', label: '背景信息', rows: 2, placeholder: '提供相关背景，帮助 AI 理解场景...' },
  { key: 'constraints', label: '约束要求', rows: 3, placeholder: '说明限制条件（每行一条，用 - 开头）...' },
  { key: 'format', label: '输出格式', rows: 2, placeholder: '指定期望的输出结构和格式...' },
  { key: 'examples', label: '参考示例（可选）', rows: 3, placeholder: '提供1-2个期望输出的示例...' },
]

const fieldRefs: Record<string, typeof role> = { role, task, context, constraints, format, examples }

function getVal(key: string) { return fieldRefs[key].value }
function setVal(key: string, v: string) { (fieldRefs[key] as typeof role).value = v }

function applyPreset(name: string) {
  selectedPreset.value = name
  const p = allPresets.value.find(p => p.name === name)
  if (!p) return
  role.value = p.role; task.value = p.task; context.value = p.context
  constraints.value = p.constraints; format.value = p.format; examples.value = p.examples
}

function clearAll() {
  selectedPreset.value = '自定义'
  role.value = ''; task.value = ''; context.value = ''
  constraints.value = ''; format.value = ''; examples.value = ''
}

function saveCustom() {
  const name = prompt('为此模板命名：')
  if (!name?.trim()) return
  const preset: Preset = { name: name.trim(), role: role.value, task: task.value, context: context.value, constraints: constraints.value, format: format.value, examples: examples.value }
  customPresets.value = customPresets.value.filter(p => p.name !== name.trim())
  customPresets.value.push(preset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets.value))
  saveNotice.value = `已保存"${name.trim()}"`
  setTimeout(() => saveNotice.value = '', 2000)
}

function deleteCustom(name: string, e: MouseEvent) {
  e.stopPropagation()
  customPresets.value = customPresets.value.filter(p => p.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets.value))
  if (selectedPreset.value === name) clearAll()
}

const prompt = computed(() => {
  const parts: string[] = []
  if (role.value.trim()) parts.push(role.value.trim())
  if (task.value.trim()) parts.push(`## 任务\n${task.value.trim()}`)
  if (context.value.trim()) parts.push(`## 背景\n${context.value.trim()}`)
  if (constraints.value.trim()) parts.push(`## 要求\n${constraints.value.trim()}`)
  if (format.value.trim()) parts.push(`## 输出格式\n${format.value.trim()}`)
  if (examples.value.trim()) parts.push(`## 示例\n${examples.value.trim()}`)
  return parts.join('\n\n')
})

const charCount = computed(() => prompt.value.length)
const tokenEst = computed(() => Math.ceil(prompt.value.length / 3.5))

async function copy() {
  await navigator.clipboard.writeText(prompt.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

function exportTxt() {
  const blob = new Blob([prompt.value], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `prompt-${Date.now()}.txt`
  a.click()
}
</script>

<template>
  <div class="tw">
    <!-- 模板选择 -->
    <div class="presets-section">
      <div class="presets-header">
        <label class="lbl">模板预设</label>
        <div class="preset-actions">
          <button class="btn btn-ghost btn-sm" @click="saveCustom">保存为模板</button>
          <button class="btn btn-ghost btn-sm" @click="clearAll">清空</button>
        </div>
      </div>
      <div class="preset-group">
        <button v-for="p in builtins" :key="p.name"
          :class="['preset-btn', selectedPreset===p.name&&'preset-active']"
          @click="applyPreset(p.name)">{{ p.name }}</button>
        <button v-for="p in customPresets" :key="p.name"
          :class="['preset-btn preset-custom', selectedPreset===p.name&&'preset-active']"
          @click="applyPreset(p.name)">
          {{ p.name }}
          <span class="del-x" @click="deleteCustom(p.name, $event)">×</span>
        </button>
      </div>
      <p v-if="saveNotice" class="save-notice">✓ {{ saveNotice }}</p>
    </div>

    <!-- 字段 -->
    <div class="fields">
      <div v-for="f in fields" :key="f.key" class="field">
        <label class="lbl">{{ f.label }}</label>
        <textarea :value="getVal(f.key)" :rows="f.rows" class="inp" :placeholder="f.placeholder"
          @input="setVal(f.key, ($event.target as HTMLTextAreaElement).value)" />
      </div>
    </div>

    <!-- 输出 -->
    <div class="output-section">
      <div class="output-hdr">
        <span class="lbl" style="margin:0">生成的 Prompt</span>
        <span class="stats">{{ charCount }} 字符 · 约 {{ tokenEst }} tokens</span>
        <button class="btn btn-ghost btn-sm" @click="exportTxt">导出 .txt</button>
        <button class="btn btn-p btn-sm" @click="copy">{{ copied ? '✓ 已复制' : '复制' }}</button>
      </div>
      <pre class="output-pre">{{ prompt || '（填写上方字段后自动生成）' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:20px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:6px; }
.presets-section { display:flex; flex-direction:column; gap:8px; }
.presets-header { display:flex; align-items:center; justify-content:space-between; }
.preset-actions { display:flex; gap:6px; }
.preset-group { display:flex; gap:8px; flex-wrap:wrap; }
.preset-btn { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); display:inline-flex; align-items:center; gap:4px; }
.preset-btn:hover { border-color:var(--vp-c-brand-1); }
.preset-active { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.preset-custom { border-style:dashed; }
.del-x { font-size:14px; line-height:1; opacity:.6; }
.del-x:hover { opacity:1; }
.save-notice { font-size:12px; color:#16a34a; margin:0; }
.fields { display:grid; gap:12px; }
.field { display:flex; flex-direction:column; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:inherit; line-height:1.6;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.output-section { border:1px solid var(--vp-c-divider); border-radius:10px; overflow:hidden; }
.output-hdr { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--vp-c-bg-soft); border-bottom:1px solid var(--vp-c-divider); flex-wrap:wrap; }
.stats { font-size:12px; color:var(--vp-c-text-3); margin-left:auto; white-space:nowrap; }
.output-pre { margin:0; padding:16px; font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word; color:var(--vp-c-text-1); background:var(--vp-c-bg); max-height:360px; overflow-y:auto; font-family:inherit; }
.btn { padding:6px 14px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-ghost { background:transparent; border:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); }
.btn-ghost:hover { border-color:var(--vp-c-brand-1); color:var(--vp-c-brand-1); }
.btn-sm { padding:4px 12px; font-size:12px; }
</style>

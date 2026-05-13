<script setup lang="ts">
import { ref, computed } from 'vue'

interface Preset {
  name: string
  role: string
  task: string
  context: string
  constraints: string
  format: string
  examples: string
}

const presets: Preset[] = [
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
    name: '自定义',
    role: '',
    task: '',
    context: '',
    constraints: '',
    format: '',
    examples: '',
  },
]

const selectedPreset = ref(presets[0].name)
const role = ref(presets[0].role)
const task = ref(presets[0].task)
const context = ref(presets[0].context)
const constraints = ref(presets[0].constraints)
const format = ref(presets[0].format)
const examples = ref(presets[0].examples)
const copied = ref(false)

function applyPreset(name: string) {
  selectedPreset.value = name
  const p = presets.find(p => p.name === name)!
  role.value = p.role
  task.value = p.task
  context.value = p.context
  constraints.value = p.constraints
  format.value = p.format
  examples.value = p.examples
}

const prompt = computed(() => {
  const sections: string[] = []
  if (role.value.trim()) sections.push(role.value.trim())
  if (task.value.trim()) sections.push(`## 任务\n${task.value.trim()}`)
  if (context.value.trim()) sections.push(`## 背景\n${context.value.trim()}`)
  if (constraints.value.trim()) sections.push(`## 要求\n${constraints.value.trim()}`)
  if (format.value.trim()) sections.push(`## 输出格式\n${format.value.trim()}`)
  if (examples.value.trim()) sections.push(`## 示例\n${examples.value.trim()}`)
  return sections.join('\n\n')
})

async function copy() {
  await navigator.clipboard.writeText(prompt.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

const charCount = computed(() => prompt.value.length)
</script>

<template>
  <div class="tw">
    <!-- Presets -->
    <div>
      <label class="lbl">模板预设</label>
      <div class="preset-group">
        <button
          v-for="p in presets" :key="p.name"
          :class="['preset-btn', selectedPreset===p.name&&'preset-active']"
          @click="applyPreset(p.name)"
        >{{ p.name }}</button>
      </div>
    </div>

    <!-- Fields -->
    <div class="fields">
      <div v-for="(label, key) in { role:'角色设定', task:'任务描述', context:'背景信息', constraints:'约束要求', format:'输出格式', examples:'参考示例（可选）' }" :key="key" class="field">
        <label class="lbl">{{ label }}</label>
        <textarea
          :value="key==='role'?role:key==='task'?task:key==='context'?context:key==='constraints'?constraints:key==='format'?format:examples"
          :rows="key==='role'||key==='format'?2:3"
          class="inp"
          :placeholder="key==='examples'?'提供1-2个期望输出的示例（可留空）':'填写此字段...'"
          @input="e => { const v=(e.target as HTMLTextAreaElement).value; if(key==='role')role=v;else if(key==='task')task=v;else if(key==='context')context=v;else if(key==='constraints')constraints=v;else if(key==='format')format=v;else examples=v }"
        />
      </div>
    </div>

    <!-- Output -->
    <div class="output-section">
      <div class="output-header">
        <span class="lbl" style="margin:0">生成的 Prompt</span>
        <span class="char-count">{{ charCount }} 字符</span>
        <button class="btn btn-p" @click="copy">{{ copied ? '✓ 已复制' : '复制全部' }}</button>
      </div>
      <pre class="output-pre">{{ prompt || '（填写上方字段后自动生成）' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:20px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:6px; }
.preset-group { display:flex; gap:8px; flex-wrap:wrap; }
.preset-btn { padding:6px 16px; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); }
.preset-btn:hover { border-color:var(--vp-c-brand-1); }
.preset-active { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.fields { display:grid; gap:12px; }
.field { display:flex; flex-direction:column; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:inherit; line-height:1.6;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.output-section { border:1px solid var(--vp-c-divider); border-radius:10px; overflow:hidden; }
.output-header { display:flex; align-items:center; gap:12px; padding:10px 14px; background:var(--vp-c-bg-soft); border-bottom:1px solid var(--vp-c-divider); }
.char-count { font-size:12px; color:var(--vp-c-text-3); margin-left:auto; }
.output-pre { margin:0; padding:16px; font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word; color:var(--vp-c-text-1); background:var(--vp-c-bg); max-height:360px; overflow-y:auto; font-family:inherit; }
.btn { padding:6px 16px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
</style>

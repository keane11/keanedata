<script setup lang="ts">
import { ref, watch } from 'vue'

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-512'
const algos: Algo[] = ['SHA-1', 'SHA-256', 'SHA-512']
const selected = ref<Algo[]>(['SHA-256'])
const mode = ref<'single' | 'compare'>('single')
const uppercase = ref(false)
const textA = ref('')
const textB = ref('')

interface HashResult { algo: Algo; hex: string }
const resultsA = ref<HashResult[]>([])
const resultsB = ref<HashResult[]>([])
const copied = ref('')
const draggingA = ref(false)
const draggingB = ref(false)
const fileNameA = ref('')
const fileNameB = ref('')

let debounceTimer: ReturnType<typeof setTimeout>

async function digest(buf: ArrayBuffer | string, algo: Algo): Promise<string> {
  const data = typeof buf === 'string' ? new TextEncoder().encode(buf) : buf
  const hashBuf = await crypto.subtle.digest(algo, data)
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return uppercase.value ? hex.toUpperCase() : hex
}

async function compute() {
  resultsA.value = []
  resultsB.value = []
  for (const algo of selected.value) {
    resultsA.value.push({ algo, hex: await digest(textA.value, algo) })
    if (mode.value === 'compare') {
      resultsB.value.push({ algo, hex: await digest(textB.value, algo) })
    }
  }
}

// 实时计算（防抖 400ms）
watch([textA, textB, selected, uppercase], () => {
  if (!textA.value && !textB.value) { resultsA.value = []; resultsB.value = []; return }
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(compute, 400)
})

function match(algo: Algo) {
  const a = resultsA.value.find(r => r.algo === algo)?.hex
  const b = resultsB.value.find(r => r.algo === algo)?.hex
  if (!a || !b) return null
  return a === b
}

async function copyHash(hex: string) {
  await navigator.clipboard.writeText(hex)
  copied.value = hex
  setTimeout(() => copied.value = '', 1500)
}

function toggleAlgo(algo: Algo) {
  const i = selected.value.indexOf(algo)
  if (i >= 0) { if (selected.value.length > 1) selected.value.splice(i, 1) }
  else selected.value.push(algo)
}

function clearAll() {
  textA.value = ''; textB.value = ''
  resultsA.value = []; resultsB.value = []
  fileNameA.value = ''; fileNameB.value = ''
}

function readFile(file: File, side: 'A' | 'B') {
  const reader = new FileReader()
  reader.onload = async e => {
    const buf = e.target?.result as ArrayBuffer
    const results: HashResult[] = []
    for (const algo of selected.value) {
      results.push({ algo, hex: await digest(buf, algo) })
    }
    if (side === 'A') { resultsA.value = results; fileNameA.value = file.name }
    else { resultsB.value = results; fileNameB.value = file.name }
  }
  reader.readAsArrayBuffer(file)
}

function onDrop(e: DragEvent, side: 'A' | 'B') {
  e.preventDefault()
  side === 'A' ? (draggingA.value = false) : (draggingB.value = false)
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file, side)
}

function onFileInput(e: Event, side: 'A' | 'B') {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file, side)
}
</script>

<template>
  <div class="tw">
    <!-- Controls -->
    <div class="row">
      <div class="col">
        <label class="lbl">模式</label>
        <div class="tg">
          <button :class="['tog', mode==='single'&&'tog-a']" @click="mode='single'; resultsB=[]">单文本</button>
          <button :class="['tog', mode==='compare'&&'tog-a']" @click="mode='compare'">对比模式</button>
        </div>
      </div>
      <div class="col">
        <label class="lbl">算法</label>
        <div class="tg">
          <button v-for="a in algos" :key="a" :class="['tog', selected.includes(a)&&'tog-a']" @click="toggleAlgo(a)">{{ a }}</button>
        </div>
      </div>
      <div class="col">
        <label class="lbl">输出格式</label>
        <div class="tg">
          <button :class="['tog', !uppercase&&'tog-a']" @click="uppercase=false">小写</button>
          <button :class="['tog', uppercase&&'tog-a']" @click="uppercase=true">大写</button>
        </div>
      </div>
      <button class="btn btn-ghost clear-btn" @click="clearAll">清空</button>
    </div>

    <!-- 输入区 -->
    <div class="inputs">
      <!-- 文本 A -->
      <div class="input-col">
        <label class="lbl">{{ mode==='compare' ? '文本 / 文件 A' : '输入文本或拖拽文件' }}</label>
        <div
          :class="['drop-zone', draggingA&&'drag-over']"
          @dragover.prevent="draggingA=true"
          @dragleave="draggingA=false"
          @drop="onDrop($event,'A')"
        >
          <textarea v-model="textA" rows="5" class="inp"
            :placeholder="fileNameA || '粘贴文本，或拖拽文件到此处...'" />
          <div v-if="fileNameA" class="file-tag">📄 {{ fileNameA }}</div>
          <label class="file-choose">选择文件 <input type="file" style="display:none" @change="onFileInput($event,'A')" /></label>
        </div>
      </div>
      <!-- 文本 B -->
      <div v-if="mode==='compare'" class="input-col">
        <label class="lbl">文本 / 文件 B</label>
        <div
          :class="['drop-zone', draggingB&&'drag-over']"
          @dragover.prevent="draggingB=true"
          @dragleave="draggingB=false"
          @drop="onDrop($event,'B')"
        >
          <textarea v-model="textB" rows="5" class="inp"
            :placeholder="fileNameB || '粘贴文本，或拖拽文件到此处...'" />
          <div v-if="fileNameB" class="file-tag">📄 {{ fileNameB }}</div>
          <label class="file-choose">选择文件 <input type="file" style="display:none" @change="onFileInput($event,'B')" /></label>
        </div>
      </div>
    </div>

    <!-- 结果 -->
    <div v-if="resultsA.length" class="results">
      <div v-for="r in resultsA" :key="r.algo" class="result-row">
        <div class="result-hdr">
          <span class="algo-tag">{{ r.algo }}</span>
          <span v-if="mode==='compare' && resultsB.length"
            :class="['badge', match(r.algo)===true?'badge-ok':'badge-fail']">
            {{ match(r.algo) === true ? '✓ 一致' : '✗ 不一致' }}
          </span>
        </div>
        <div class="hash-block">
          <div class="hash-line">
            <span v-if="mode==='compare'" class="side-label">A</span>
            <code class="hv">{{ r.hex }}</code>
            <button class="copy-btn" @click="copyHash(r.hex)">{{ copied===r.hex?'✓':'复制' }}</button>
          </div>
          <div v-if="mode==='compare' && resultsB.find(b=>b.algo===r.algo)" class="hash-line">
            <span class="side-label">B</span>
            <code :class="['hv', match(r.algo)===false&&'hv-diff']">
              {{ resultsB.find(b=>b.algo===r.algo)?.hex }}
            </code>
            <button class="copy-btn" @click="copyHash(resultsB.find(b=>b.algo===r.algo)!.hex)">
              {{ copied===resultsB.find(b=>b.algo===r.algo)?.hex?'✓':'复制' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <p v-else-if="textA||fileNameA" class="hint">输入内容后自动计算…</p>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }
.col { display:flex; flex-direction:column; gap:6px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; }
.tg { display:flex; gap:5px; flex-wrap:wrap; }
.tog { padding:5px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); }
.tog:hover { border-color:var(--vp-c-brand-1); }
.tog-a { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.clear-btn { margin-left:auto; align-self:flex-end; }
.btn { padding:7px 16px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; }
.btn-ghost { background:transparent; border:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); }
.btn-ghost:hover { border-color:#ef4444; color:#ef4444; }
.inputs { display:flex; gap:16px; flex-wrap:wrap; }
.input-col { flex:1; min-width:240px; display:flex; flex-direction:column; gap:6px; }
.drop-zone { position:relative; border:2px dashed var(--vp-c-divider); border-radius:10px; padding:4px; transition:border-color .2s; }
.drag-over { border-color:var(--vp-c-brand-1); background:var(--vp-c-brand-soft); }
.inp {
  background:transparent; border:none; outline:none;
  padding:10px 12px; font-size:13px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:monospace; display:block;
}
.file-tag { font-size:12px; color:var(--vp-c-brand-1); padding:4px 12px; }
.file-choose { display:inline-block; font-size:12px; color:var(--vp-c-text-3); padding:4px 12px 8px; cursor:pointer; }
.file-choose:hover { color:var(--vp-c-brand-1); }
.results { display:flex; flex-direction:column; gap:10px; }
.result-row { border:1px solid var(--vp-c-divider); border-radius:10px; overflow:hidden; }
.result-hdr { display:flex; align-items:center; gap:10px; padding:8px 14px; background:var(--vp-c-bg-soft); }
.algo-tag { font-weight:600; font-size:13px; color:var(--vp-c-brand-1); }
.badge { font-size:12px; font-weight:600; padding:2px 10px; border-radius:20px; }
.badge-ok { background:#dcfce7; color:#16a34a; }
.badge-fail { background:#fee2e2; color:#dc2626; }
.hash-block { display:flex; flex-direction:column; }
.hash-line { display:flex; align-items:center; gap:8px; padding:10px 14px; border-top:1px solid var(--vp-c-divider); }
.side-label { font-size:11px; font-weight:700; color:var(--vp-c-text-3); width:14px; flex-shrink:0; }
.hv { font-family:monospace; font-size:12px; color:var(--vp-c-text-1); flex:1; word-break:break-all; background:none; padding:0; border:none; }
.hv-diff { color:#dc2626; }
.copy-btn { padding:3px 10px; border-radius:5px; font-size:12px; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); flex-shrink:0; }
.copy-btn:hover { border-color:var(--vp-c-brand-1); }
.hint { font-size:13px; color:var(--vp-c-text-3); text-align:center; padding:16px 0; margin:0; }
</style>

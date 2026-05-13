<script setup lang="ts">
import { ref } from 'vue'

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-512'
const algos: Algo[] = ['SHA-1', 'SHA-256', 'SHA-512']
const selected = ref<Algo[]>(['SHA-256'])

const mode = ref<'single' | 'compare'>('single')
const textA = ref('')
const textB = ref('')

interface HashResult { algo: Algo; hex: string }
const resultsA = ref<HashResult[]>([])
const resultsB = ref<HashResult[]>([])
const copied = ref('')

async function digest(text: string, algo: Algo): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
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
</script>

<template>
  <div class="tw">
    <!-- Mode + Algo -->
    <div class="row">
      <div class="col">
        <label class="lbl">模式</label>
        <div class="toggle-group">
          <button :class="['tog', mode==='single'&&'tog-active']" @click="mode='single'; resultsA=[];resultsB=[]">单文本</button>
          <button :class="['tog', mode==='compare'&&'tog-active']" @click="mode='compare'; resultsA=[];resultsB=[]">对比模式</button>
        </div>
      </div>
      <div class="col">
        <label class="lbl">算法</label>
        <div class="toggle-group">
          <button v-for="a in algos" :key="a" :class="['tog', selected.includes(a)&&'tog-active']" @click="toggleAlgo(a)">{{ a }}</button>
        </div>
      </div>
    </div>

    <!-- Input(s) -->
    <div class="row">
      <div class="col grow">
        <label class="lbl">{{ mode==='compare' ? '文本 A' : '输入文本' }}</label>
        <textarea v-model="textA" rows="4" class="inp" placeholder="在这里粘贴内容..." />
      </div>
      <div v-if="mode==='compare'" class="col grow">
        <label class="lbl">文本 B</label>
        <textarea v-model="textB" rows="4" class="inp" placeholder="在这里粘贴内容..." />
      </div>
    </div>

    <button class="btn btn-p" @click="compute">计算 Hash</button>

    <!-- Results -->
    <div v-if="resultsA.length" class="results">
      <div v-for="r in resultsA" :key="r.algo" class="result-row">
        <div class="result-header">
          <span class="algo-tag">{{ r.algo }}</span>
          <span v-if="mode==='compare'" :class="['match-badge', match(r.algo)===true?'match-ok':'match-fail']">
            {{ match(r.algo) === true ? '✓ 一致' : '✗ 不一致' }}
          </span>
        </div>
        <div class="hash-block">
          <div class="hash-line">
            <span class="hash-label" v-if="mode==='compare'">A</span>
            <code class="hash-val">{{ r.hex }}</code>
            <button class="copy-btn" @click="copyHash(r.hex)">{{ copied===r.hex ? '✓' : '复制' }}</button>
          </div>
          <div v-if="mode==='compare' && resultsB.find(b=>b.algo===r.algo)" class="hash-line">
            <span class="hash-label">B</span>
            <code class="hash-val" :class="match(r.algo)===false&&'hash-diff'">
              {{ resultsB.find(b=>b.algo===r.algo)?.hex }}
            </code>
            <button class="copy-btn" @click="copyHash(resultsB.find(b=>b.algo===r.algo)!.hex)">
              {{ copied===resultsB.find(b=>b.algo===r.algo)?.hex ? '✓' : '复制' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.col { display:flex; flex-direction:column; gap:6px; }
.grow { flex:1; min-width:220px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:monospace;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.toggle-group { display:flex; gap:6px; flex-wrap:wrap; }
.tog { padding:6px 14px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); }
.tog:hover { border-color:var(--vp-c-brand-1); }
.tog-active { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.btn { padding:9px 24px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; align-self:flex-start; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.results { display:flex; flex-direction:column; gap:12px; }
.result-row { border:1px solid var(--vp-c-divider); border-radius:10px; overflow:hidden; }
.result-header { display:flex; align-items:center; gap:10px; padding:8px 14px; background:var(--vp-c-bg-soft); }
.algo-tag { font-weight:600; font-size:13px; color:var(--vp-c-brand-1); }
.match-badge { font-size:12px; font-weight:600; padding:2px 10px; border-radius:20px; }
.match-ok { background:#dcfce7; color:#16a34a; }
.match-fail { background:#fee2e2; color:#dc2626; }
.hash-block { display:flex; flex-direction:column; gap:0; }
.hash-line { display:flex; align-items:center; gap:8px; padding:10px 14px; border-top:1px solid var(--vp-c-divider); }
.hash-label { font-size:12px; font-weight:700; color:var(--vp-c-text-3); width:16px; flex-shrink:0; }
.hash-val { font-family:monospace; font-size:12px; color:var(--vp-c-text-1); flex:1; word-break:break-all; background:none; padding:0; border:none; }
.hash-diff { color:#dc2626; }
.copy-btn { padding:3px 10px; border-radius:5px; font-size:12px; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); flex-shrink:0; }
.copy-btn:hover { border-color:var(--vp-c-brand-1); }
</style>

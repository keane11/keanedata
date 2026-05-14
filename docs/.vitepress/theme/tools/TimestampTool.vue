<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// ── 工具函数 ──────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')

function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function fmtUTC(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}
function fmtISO(d: Date) { return d.toISOString() }
function fmtMs(d: Date) { return d.getTime() }

function relativeTime(d: Date): string {
  const diff = (Date.now() - d.getTime()) / 1000
  const abs = Math.abs(diff)
  const future = diff < 0
  let str: string
  if (abs < 60) str = `${Math.round(abs)} 秒`
  else if (abs < 3600) str = `${Math.round(abs/60)} 分钟`
  else if (abs < 86400) str = `${Math.round(abs/3600)} 小时`
  else if (abs < 86400*30) str = `${Math.round(abs/86400)} 天`
  else if (abs < 86400*365) str = `${Math.round(abs/86400/30)} 个月`
  else str = `${(abs/86400/365).toFixed(1)} 年`
  return future ? `${str}后` : `${str}前`
}

// ── 实时时钟 ──────────────────────────────────────────────────────
const nowTs = ref(0)
const nowMs = ref(0)
const nowLocal = ref('')
const nowUTC = ref('')
const nowISO = ref('')
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  const tick = () => {
    const d = new Date()
    nowTs.value = Math.floor(d.getTime() / 1000)
    nowMs.value = d.getTime()
    nowLocal.value = fmtLocal(d)
    nowUTC.value = fmtUTC(d)
    nowISO.value = fmtISO(d)
  }
  tick(); timer = setInterval(tick, 1000)
})
onUnmounted(() => clearInterval(timer))

const nowCopied = ref('')
async function copyNow(val: string | number) {
  await navigator.clipboard.writeText(String(val))
  nowCopied.value = String(val); setTimeout(() => nowCopied.value = '', 1500)
}

// ── 时间戳 → 日期时间 ─────────────────────────────────────────────
interface TsResult { local: string; utc: string; iso: string; ms: string; rel: string }
const tsInput = ref('')
const tsResult = ref<TsResult | null>(null)
const tsErr = ref('')

function tsToDate() {
  tsErr.value = ''; tsResult.value = null
  const n = Number(tsInput.value.trim())
  if (isNaN(n) || !tsInput.value.trim()) { tsErr.value = '请输入有效的时间戳'; return }
  // 自动判断秒/毫秒
  const d = new Date(n > 1e12 ? n : n * 1000)
  if (isNaN(d.getTime())) { tsErr.value = '无效的时间戳'; return }
  tsResult.value = { local: fmtLocal(d), utc: fmtUTC(d), iso: fmtISO(d), ms: String(fmtMs(d)), rel: relativeTime(d) }
}

// ── 日期时间 → 时间戳 ─────────────────────────────────────────────
interface DateResult { sec: string; ms: string; iso: string }
const dateInput = ref('')
const dateResult = ref<DateResult | null>(null)

function dateToTs() {
  dateResult.value = null
  if (!dateInput.value) return
  const d = new Date(dateInput.value)
  if (isNaN(d.getTime())) return
  dateResult.value = { sec: String(Math.floor(d.getTime()/1000)), ms: String(d.getTime()), iso: fmtISO(d) }
}

// ── 秒数 → 时长 ───────────────────────────────────────────────────
const durInput = ref('')
const durResult = ref('')

function parseDur() {
  const s = parseInt(durInput.value)
  if (isNaN(s)) { durResult.value = '请输入秒数'; return }
  const neg = s < 0; const abs = Math.abs(s)
  const d = Math.floor(abs/86400), h = Math.floor((abs%86400)/3600), m = Math.floor((abs%3600)/60), sec = abs%60
  const parts: string[] = []
  if (d) parts.push(`${d} 天`)
  if (h) parts.push(`${h} 小时`)
  if (m) parts.push(`${m} 分钟`)
  if (sec || !parts.length) parts.push(`${sec} 秒`)
  durResult.value = (neg ? '-' : '') + parts.join(' ')
}

const copied = ref('')
async function cp(v: string) {
  await navigator.clipboard.writeText(v); copied.value = v; setTimeout(() => copied.value = '', 1500)
}
</script>

<template>
  <div class="tw">
    <!-- 实时时钟 -->
    <div class="card clock-card">
      <div class="clock-hdr">当前时间</div>
      <div class="clock-grid">
        <div class="clock-row" v-for="(val, label) in { 'Unix 秒': nowTs, 'Unix 毫秒': nowMs, '本地时间': nowLocal, 'UTC 时间': nowUTC, 'ISO 8601': nowISO }" :key="label">
          <span class="clock-label">{{ label }}</span>
          <code class="clock-val">{{ val }}</code>
          <button class="cp-btn" @click="copyNow(val)">{{ nowCopied===String(val)?'✓':'复制' }}</button>
        </div>
      </div>
    </div>

    <!-- 时间戳 → 日期时间 -->
    <div class="card">
      <div class="card-title">时间戳 → 日期时间</div>
      <div class="row">
        <input v-model="tsInput" class="inp" placeholder="Unix 时间戳（自动识别秒/毫秒）" type="number"
          @keydown.enter="tsToDate" />
        <button class="btn btn-p" @click="tsToDate">转换</button>
      </div>
      <p v-if="tsErr" class="err">{{ tsErr }}</p>
      <div v-if="tsResult" class="result-grid">
        <div class="res-row" v-for="(val, label) in { '本地时间': tsResult.local, 'UTC': tsResult.utc, 'ISO 8601': tsResult.iso, '毫秒时间戳': tsResult.ms, '相对时间': tsResult.rel }" :key="label">
          <span class="res-label">{{ label }}</span>
          <code class="res-val">{{ val }}</code>
          <button class="cp-btn" @click="cp(val)">{{ copied===val?'✓':'复制' }}</button>
        </div>
      </div>
    </div>

    <!-- 日期时间 → 时间戳 -->
    <div class="card">
      <div class="card-title">日期时间 → 时间戳</div>
      <div class="row">
        <input v-model="dateInput" class="inp" type="datetime-local" @change="dateToTs" />
        <button class="btn btn-p" @click="dateToTs">转换</button>
      </div>
      <div v-if="dateResult" class="result-grid">
        <div class="res-row" v-for="(val, label) in { 'Unix 秒': dateResult.sec, 'Unix 毫秒': dateResult.ms, 'ISO 8601': dateResult.iso }" :key="label">
          <span class="res-label">{{ label }}</span>
          <code class="res-val">{{ val }}</code>
          <button class="cp-btn" @click="cp(val)">{{ copied===val?'✓':'复制' }}</button>
        </div>
      </div>
    </div>

    <!-- 秒数 → 时长 -->
    <div class="card">
      <div class="card-title">秒数 → 可读时长</div>
      <div class="row">
        <input v-model="durInput" class="inp" placeholder="秒数，如 86400（支持负数）" type="number"
          @keydown.enter="parseDur" />
        <button class="btn btn-p" @click="parseDur">转换</button>
      </div>
      <div v-if="durResult" class="result-grid">
        <div class="res-row">
          <span class="res-label">时长</span>
          <code class="res-val">{{ durResult }}</code>
          <button class="cp-btn" @click="cp(durResult)">{{ copied===durResult?'✓':'复制' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:14px; }
.card { background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider); border-radius:12px; padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
.clock-hdr { font-size:13px; font-weight:600; color:var(--vp-c-text-2); letter-spacing:.5px; text-transform:uppercase; }
.clock-grid, .result-grid { display:flex; flex-direction:column; gap:1px; border:1px solid var(--vp-c-divider); border-radius:8px; overflow:hidden; }
.clock-row, .res-row { display:flex; align-items:center; gap:12px; padding:9px 14px; background:var(--vp-c-bg); }
.clock-row:not(:last-child), .res-row:not(:last-child) { border-bottom:1px solid var(--vp-c-divider); }
.clock-label, .res-label { font-size:12px; color:var(--vp-c-text-3); width:100px; flex-shrink:0; }
.clock-val, .res-val { font-family:monospace; font-size:13px; color:var(--vp-c-text-1); flex:1; word-break:break-all; background:none; padding:0; border:none; }
.card-title { font-size:14px; font-weight:600; color:var(--vp-c-text-1); }
.row { display:flex; gap:10px; flex-wrap:wrap; }
.inp {
  flex:1; min-width:180px; background:var(--vp-c-bg); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:8px 12px; font-size:14px; color:var(--vp-c-text-1); box-sizing:border-box;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.btn { padding:8px 18px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; white-space:nowrap; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.cp-btn { padding:3px 10px; border-radius:5px; font-size:12px; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); flex-shrink:0; }
.cp-btn:hover { border-color:var(--vp-c-brand-1); }
.err { color:#ef4444; font-size:13px; margin:0; }
</style>

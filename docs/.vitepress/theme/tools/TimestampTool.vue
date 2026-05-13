<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const nowTs = ref(0)
const nowStr = ref('')
let timer: ReturnType<typeof setInterval>

function pad(n: number) { return String(n).padStart(2, '0') }

function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(() => {
  const tick = () => {
    const d = new Date()
    nowTs.value = Math.floor(d.getTime() / 1000)
    nowStr.value = fmt(d)
  }
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => clearInterval(timer))

// ts → datetime
const tsInput = ref('')
const tsResult = ref('')
function tsToDate() {
  const n = parseInt(tsInput.value)
  if (isNaN(n)) { tsResult.value = '无效时间戳'; return }
  const d = new Date(n * (n > 1e10 ? 1 : 1000))
  tsResult.value = fmt(d)
}

// datetime → ts
const dateInput = ref('')
const dateResult = ref('')
function dateToTs() {
  if (!dateInput.value) { dateResult.value = '请选择时间'; return }
  dateResult.value = String(Math.floor(new Date(dateInput.value).getTime() / 1000))
}

// duration
const dur = ref('')
const durResult = ref('')
function parseDur() {
  const s = parseInt(dur.value)
  if (isNaN(s)) { durResult.value = '无效数字'; return }
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sec = s%60
  const parts: string[] = []
  if (d) parts.push(`${d} 天`)
  if (h) parts.push(`${h} 小时`)
  if (m) parts.push(`${m} 分钟`)
  if (sec || !parts.length) parts.push(`${sec} 秒`)
  durResult.value = parts.join(' ')
}

async function copyNow(v: string | number) {
  await navigator.clipboard.writeText(String(v))
}
</script>

<template>
  <div class="tw">
    <!-- 当前时间 -->
    <div class="card now-card">
      <div class="now-row">
        <div>
          <div class="now-label">Unix 时间戳（秒）</div>
          <div class="now-val">{{ nowTs }}</div>
        </div>
        <button class="btn btn-s btn-sm" @click="copyNow(nowTs)">复制</button>
      </div>
      <div class="now-row">
        <div>
          <div class="now-label">本地时间</div>
          <div class="now-val">{{ nowStr }}</div>
        </div>
        <button class="btn btn-s btn-sm" @click="copyNow(nowStr)">复制</button>
      </div>
    </div>

    <!-- 时间戳 → 时间 -->
    <div class="card">
      <div class="card-title">时间戳 → 日期时间</div>
      <div class="row">
        <input v-model="tsInput" class="inp" placeholder="Unix 时间戳（秒或毫秒）" type="number" />
        <button class="btn btn-p" @click="tsToDate">转换</button>
      </div>
      <div v-if="tsResult" class="result">{{ tsResult }}</div>
    </div>

    <!-- 时间 → 时间戳 -->
    <div class="card">
      <div class="card-title">日期时间 → 时间戳</div>
      <div class="row">
        <input v-model="dateInput" class="inp" type="datetime-local" />
        <button class="btn btn-p" @click="dateToTs">转换</button>
      </div>
      <div v-if="dateResult" class="result">{{ dateResult }} <button class="btn btn-s btn-sm" @click="copyNow(dateResult)">复制</button></div>
    </div>

    <!-- 秒数 → 可读时长 -->
    <div class="card">
      <div class="card-title">秒数 → 可读时长</div>
      <div class="row">
        <input v-model="dur" class="inp" placeholder="秒数，如 86400" type="number" />
        <button class="btn btn-p" @click="parseDur">转换</button>
      </div>
      <div v-if="durResult" class="result">{{ durResult }}</div>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:14px; }
.card { background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider); border-radius:10px; padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
.now-card { gap:8px; }
.now-row { display:flex; align-items:center; justify-content:space-between; }
.now-label { font-size:12px; color:var(--vp-c-text-3); }
.now-val { font-size:22px; font-family:monospace; font-weight:600; color:var(--vp-c-brand-1); letter-spacing:1px; }
.card-title { font-size:14px; font-weight:600; color:var(--vp-c-text-1); }
.row { display:flex; gap:10px; flex-wrap:wrap; }
.inp {
  flex:1; min-width:180px; background:var(--vp-c-bg); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:8px 12px; font-size:14px; color:var(--vp-c-text-1); box-sizing:border-box;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.result { font-family:monospace; font-size:15px; color:var(--vp-c-text-1); padding:8px 12px; background:var(--vp-c-bg); border-radius:7px; display:flex; align-items:center; gap:10px; }
.btn { padding:8px 16px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; white-space:nowrap; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.btn-sm { padding:4px 10px; font-size:12px; }
</style>

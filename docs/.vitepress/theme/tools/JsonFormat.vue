<script setup lang="ts">
import { ref, computed } from 'vue'

const input = ref('')
const output = ref('')
const errMsg = ref('')
const indent = ref(2)
const sortKeys = ref(false)
const copied = ref(false)

function sortedReplacer(_: string, val: unknown) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return Object.keys(val as object).sort().reduce((acc: Record<string,unknown>, k) => {
      acc[k] = (val as Record<string,unknown>)[k]; return acc
    }, {})
  }
  return val
}

function format() {
  errMsg.value = ''
  try {
    const parsed = JSON.parse(input.value)
    const replacer = sortKeys.value ? sortedReplacer : undefined
    const indentVal = indent.value === 0 ? '\t' : indent.value
    output.value = JSON.stringify(parsed, replacer as any, indentVal)
  } catch (e: any) { errMsg.value = e.message; output.value = '' }
}

function minify() {
  errMsg.value = ''
  try { output.value = JSON.stringify(JSON.parse(input.value)) }
  catch (e: any) { errMsg.value = e.message; output.value = '' }
}

function validate() {
  output.value = ''
  try { JSON.parse(input.value); errMsg.value = '✓ 合法的 JSON' }
  catch (e: any) { errMsg.value = '✗ ' + e.message }
}

function onPaste() {
  // 粘贴后自动格式化（稍等 DOM 更新）
  setTimeout(() => {
    if (!input.value.trim()) return
    try { JSON.parse(input.value); format() } catch {}
  }, 0)
}

async function copy() {
  await navigator.clipboard.writeText(output.value)
  copied.value = true; setTimeout(() => copied.value = false, 1500)
}

function useOutput() { input.value = output.value; output.value = ''; errMsg.value = '' }
function clearAll() { input.value = ''; output.value = ''; errMsg.value = '' }

const stats = computed(() => {
  if (!output.value) return null
  const lines = output.value.split('\n').length
  const size = new Blob([output.value]).size
  const sizeStr = size < 1024 ? `${size} B` : `${(size/1024).toFixed(1)} KB`
  return `${lines} 行 · ${output.value.length} 字符 · ${sizeStr}`
})
</script>

<template>
  <div class="tw">
    <div class="top-row">
      <!-- 输入 -->
      <div class="col grow">
        <label class="lbl">输入 JSON</label>
        <textarea v-model="input" rows="12" class="inp"
          placeholder='{"key": "value", "arr": [1, 2, 3]}'
          @paste="onPaste" />
      </div>

      <!-- 操作列 -->
      <div class="col ops-col">
        <div class="opt-group">
          <label class="lbl">缩进</label>
          <select v-model.number="indent" class="sel">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
            <option :value="0">Tab</option>
          </select>
        </div>
        <label class="chk-label">
          <input type="checkbox" v-model="sortKeys" class="chk" />
          按字母排序键
        </label>
        <div class="divider" />
        <button class="btn btn-p" @click="format">格式化 →</button>
        <button class="btn btn-s" @click="minify">压缩</button>
        <button class="btn btn-s" @click="validate">验证</button>
        <div class="divider" />
        <button class="btn btn-ghost" @click="clearAll">清空</button>
      </div>

      <!-- 输出 -->
      <div class="col grow">
        <div class="out-header">
          <label class="lbl" style="margin:0">输出</label>
          <button v-if="output" class="btn btn-ghost btn-sm" @click="useOutput">← 作为输入</button>
          <button v-if="output" class="btn btn-s btn-sm" @click="copy">{{ copied ? '✓' : '复制' }}</button>
        </div>
        <textarea readonly :value="output" rows="12" class="inp out"
          placeholder="结果显示在这里..." style="margin-top:4px" />
        <div v-if="stats" class="stat-bar">{{ stats }}</div>
      </div>
    </div>

    <p v-if="errMsg" :class="['msg', errMsg.startsWith('✓')?'ok':'err']">{{ errMsg }}</p>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:10px; }
.top-row { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start; }
.col { display:flex; flex-direction:column; gap:7px; }
.grow { flex:1; min-width:240px; }
.ops-col { min-width:120px; padding-top:20px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:2px; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:12.5px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical;
  font-family:'Cascadia Code','Fira Code',Consolas,monospace; line-height:1.6;
}
.out { cursor:text; }
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.opt-group { display:flex; flex-direction:column; gap:4px; }
.sel { padding:5px 8px; border-radius:6px; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); font-size:13px; color:var(--vp-c-text-1); width:100%; }
.chk-label { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--vp-c-text-1); cursor:pointer; white-space:nowrap; }
.chk { accent-color:var(--vp-c-brand-1); }
.divider { height:1px; background:var(--vp-c-divider); margin:2px 0; }
.out-header { display:flex; align-items:center; gap:6px; }
.stat-bar { font-size:11px; color:var(--vp-c-text-3); text-align:right; margin-top:4px; }
.btn { padding:7px 14px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; white-space:nowrap; width:100%; text-align:center; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.btn-ghost { background:transparent; border:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); }
.btn-ghost:hover { border-color:#ef4444; color:#ef4444; }
.btn-sm { padding:3px 10px; font-size:12px; width:auto; }
.msg { font-size:13px; padding:8px 14px; border-radius:7px; margin:0; }
.ok { color:#16a34a; background:#dcfce7; }
.err { color:#dc2626; background:#fee2e2; }
</style>

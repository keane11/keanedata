<script setup lang="ts">
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const errMsg = ref('')
const indent = ref(2)
const copied = ref(false)

function format() {
  errMsg.value = ''
  try {
    const parsed = JSON.parse(input.value)
    output.value = JSON.stringify(parsed, null, indent.value)
  } catch (e: any) {
    errMsg.value = e.message
    output.value = ''
  }
}

function minify() {
  errMsg.value = ''
  try {
    output.value = JSON.stringify(JSON.parse(input.value))
  } catch (e: any) {
    errMsg.value = e.message
    output.value = ''
  }
}

function validate() {
  errMsg.value = ''
  try {
    JSON.parse(input.value)
    errMsg.value = '✓ 合法的 JSON'
  } catch (e: any) {
    errMsg.value = '✗ ' + e.message
  }
  output.value = ''
}

async function copy() {
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

function escape_() {
  output.value = JSON.stringify(input.value)
}

function unescape_() {
  try {
    output.value = JSON.parse(input.value)
  } catch {
    errMsg.value = '解析失败'
  }
}

function useOutput() {
  input.value = output.value
  output.value = ''
}
</script>

<template>
  <div class="tw">
    <div class="top-row">
      <div class="col grow">
        <label class="lbl">输入 JSON</label>
        <textarea v-model="input" rows="10" class="inp" placeholder='{"key": "value", "arr": [1, 2, 3]}' />
      </div>
      <div class="col" style="gap:8px;justify-content:center">
        <div class="indent-row">
          <label class="lbl" style="margin:0">缩进</label>
          <select v-model.number="indent" class="sel">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
            <option :value="0">Tab</option>
          </select>
        </div>
        <button class="btn btn-p" @click="format">格式化 →</button>
        <button class="btn btn-s" @click="minify">压缩</button>
        <button class="btn btn-s" @click="validate">验证</button>
        <button class="btn btn-s" @click="escape_">转义字符串</button>
      </div>
      <div class="col grow">
        <div class="output-header">
          <label class="lbl" style="margin:0">输出</label>
          <button v-if="output" class="btn btn-s btn-sm" @click="useOutput">← 作为输入</button>
          <button v-if="output" class="btn btn-s btn-sm" @click="copy">{{ copied ? '✓' : '复制' }}</button>
        </div>
        <textarea readonly :value="output" rows="10" class="inp out" placeholder="结果显示在这里..." style="margin-top:4px" />
      </div>
    </div>
    <p :class="['msg', errMsg.startsWith('✓')?'ok':'err']" v-if="errMsg">{{ errMsg }}</p>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:12px; }
.top-row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.col { display:flex; flex-direction:column; gap:6px; }
.grow { flex:1; min-width:240px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:4px; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:12.5px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:'Cascadia Code','Fira Code',monospace; line-height:1.6;
}
.out { cursor:text; }
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.indent-row { display:flex; align-items:center; gap:8px; }
.sel { padding:4px 8px; border-radius:6px; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); font-size:13px; color:var(--vp-c-text-1); }
.output-header { display:flex; align-items:center; gap:8px; }
.btn { padding:8px 16px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; white-space:nowrap; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.btn-sm { padding:4px 10px; font-size:12px; }
.msg { font-size:13px; padding:8px 14px; border-radius:7px; }
.ok { color:#16a34a; background:#dcfce7; }
.err { color:#dc2626; background:#fee2e2; }
</style>

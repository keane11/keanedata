<script setup lang="ts">
import { ref } from 'vue'

const mode = ref<'encode' | 'decode'>('encode')
const input = ref('')
const output = ref('')
const errMsg = ref('')
const copied = ref(false)
const fileName = ref('')

function run() {
  errMsg.value = ''
  try {
    if (mode.value === 'encode') {
      output.value = btoa(unescape(encodeURIComponent(input.value)))
    } else {
      output.value = decodeURIComponent(escape(atob(input.value.trim())))
    }
  } catch {
    errMsg.value = mode.value === 'decode' ? '无效的 Base64 字符串' : '编码失败'
    output.value = ''
  }
}

function swap() {
  const tmp = input.value
  input.value = output.value
  output.value = tmp
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  errMsg.value = ''
}

async function copy() {
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    const b64 = result.split(',')[1]
    input.value = b64
    mode.value = 'decode'
    output.value = ''
  }
  reader.readAsDataURL(file)
}

function download() {
  const blob = new Blob([output.value], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'output.txt'
  a.click()
}
</script>

<template>
  <div class="tw">
    <div class="row">
      <div class="col">
        <label class="lbl">模式</label>
        <div class="toggle-group">
          <button :class="['tog', mode==='encode'&&'tog-active']" @click="mode='encode'; output=''; errMsg=''">编码</button>
          <button :class="['tog', mode==='decode'&&'tog-active']" @click="mode='decode'; output=''; errMsg=''">解码</button>
        </div>
      </div>
      <div class="col">
        <label class="lbl">上传文件（自动编码）</label>
        <label class="file-btn">
          {{ fileName || '选择文件' }}
          <input type="file" style="display:none" @change="onFile" />
        </label>
      </div>
    </div>

    <div>
      <label class="lbl">{{ mode==='encode' ? '原始文本' : 'Base64 字符串' }}</label>
      <textarea v-model="input" rows="5" class="inp" :placeholder="mode==='encode' ? '在这里粘贴原始文本...' : '在这里粘贴 Base64 字符串...'" />
    </div>

    <div class="btn-row">
      <button class="btn btn-p" @click="run">{{ mode==='encode' ? '编码 →' : '解码 →' }}</button>
      <button class="btn btn-s" @click="swap">⇅ 互换</button>
    </div>

    <p v-if="errMsg" class="err">{{ errMsg }}</p>

    <div v-if="output">
      <div class="output-header">
        <label class="lbl" style="margin:0">{{ mode==='encode' ? 'Base64 结果' : '解码结果' }}</label>
        <button class="btn btn-s btn-sm" @click="copy">{{ copied ? '✓' : '复制' }}</button>
        <button class="btn btn-s btn-sm" @click="download">⬇ 下载</button>
      </div>
      <textarea readonly :value="output" rows="5" class="inp" style="margin-top:6px;cursor:text" />
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.col { display:flex; flex-direction:column; gap:6px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:4px; }
.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:13px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:monospace; line-height:1.6;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.toggle-group { display:flex; gap:6px; }
.tog { padding:6px 18px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); }
.tog-active { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.file-btn { padding:6px 14px; border-radius:6px; font-size:13px; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); display:inline-block; }
.file-btn:hover { border-color:var(--vp-c-brand-1); }
.btn-row { display:flex; gap:10px; }
.btn { padding:9px 20px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.btn-sm { padding:4px 12px; font-size:12px; }
.output-header { display:flex; align-items:center; gap:8px; }
.err { color:#ef4444; font-size:13px; }
</style>

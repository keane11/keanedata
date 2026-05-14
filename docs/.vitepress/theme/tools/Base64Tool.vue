<script setup lang="ts">
import { ref, computed } from 'vue'

const mode = ref<'encode' | 'decode'>('encode')
const urlSafe = ref(false)
const input = ref('')
const output = ref('')
const errMsg = ref('')
const copied = ref(false)
const dragging = ref(false)
const fileInfo = ref<{ name: string; size: string } | null>(null)
const imagePreview = ref('')

function toUrlSafe(s: string) { return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function fromUrlSafe(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return s
}

function run() {
  errMsg.value = ''; imagePreview.value = ''
  try {
    if (mode.value === 'encode') {
      let result = btoa(unescape(encodeURIComponent(input.value)))
      if (urlSafe.value) result = toUrlSafe(result)
      output.value = result
    } else {
      const normalized = urlSafe.value ? fromUrlSafe(input.value.trim()) : input.value.trim()
      output.value = decodeURIComponent(escape(atob(normalized)))
      // 尝试检测是否是图片
      try {
        const raw = atob(normalized)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        const mime = detectMime(bytes)
        if (mime) imagePreview.value = `data:${mime};base64,${normalized}`
      } catch {}
    }
  } catch {
    errMsg.value = mode.value === 'decode' ? '无效的 Base64 字符串' : '编码失败'
    output.value = ''
  }
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes[0]===0xFF && bytes[1]===0xD8) return 'image/jpeg'
  if (bytes[0]===0x89 && bytes[1]===0x50) return 'image/png'
  if (bytes[0]===0x47 && bytes[1]===0x49) return 'image/gif'
  if (bytes[0]===0x52 && bytes[1]===0x49 && bytes[8]===0x57) return 'image/webp'
  return null
}

function swap() {
  ;[input.value, output.value] = [output.value, input.value]
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  errMsg.value = ''; imagePreview.value = ''; fileInfo.value = null
}

async function copy() {
  await navigator.clipboard.writeText(output.value)
  copied.value = true; setTimeout(() => copied.value = false, 1500)
}

function download() {
  const blob = new Blob([output.value], { type: 'text/plain' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = 'base64_output.txt'; a.click()
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function handleFile(file: File) {
  fileInfo.value = { name: file.name, size: formatSize(file.size) }
  const reader = new FileReader()
  reader.onload = e => {
    const arr = new Uint8Array(e.target?.result as ArrayBuffer)
    let binary = ''
    arr.forEach(b => binary += String.fromCharCode(b))
    let result = btoa(binary)
    if (urlSafe.value) result = toUrlSafe(result)
    input.value = result
    mode.value = 'decode'
    output.value = ''; errMsg.value = ''
  }
  reader.readAsArrayBuffer(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault(); dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

const stats = computed(() => {
  if (!output.value) return ''
  return `${output.value.length} 字符`
})
</script>

<template>
  <div class="tw">
    <!-- 控制栏 -->
    <div class="ctrl-bar">
      <div class="col">
        <label class="lbl">模式</label>
        <div class="tg">
          <button :class="['tog', mode==='encode'&&'tog-a']" @click="mode='encode'; output=''; errMsg=''; imagePreview=''">编码</button>
          <button :class="['tog', mode==='decode'&&'tog-a']" @click="mode='decode'; output=''; errMsg=''; imagePreview=''">解码</button>
        </div>
      </div>
      <div class="col">
        <label class="lbl">选项</label>
        <label class="chk-label">
          <input type="checkbox" v-model="urlSafe" class="chk" />
          URL-safe（用 - _ 替代 + /）
        </label>
      </div>
      <div class="col">
        <label class="lbl">上传文件</label>
        <label class="file-btn">📂 选择文件 <input type="file" style="display:none" @change="onFileInput" /></label>
      </div>
    </div>

    <!-- 拖拽输入区 -->
    <div>
      <label class="lbl">{{ mode==='encode' ? '原始文本' : 'Base64 字符串' }}</label>
      <div :class="['drop-zone', dragging&&'drag-over']"
        @dragover.prevent="dragging=true" @dragleave="dragging.value=false" @drop="onDrop">
        <textarea v-model="input" rows="6" class="inp"
          :placeholder="mode==='encode' ? '粘贴原始文本，或将文件拖拽到此处...' : '粘贴 Base64 字符串，或将文件拖拽到此处...'" />
        <div v-if="dragging" class="drop-hint">松开鼠标上传文件</div>
      </div>
      <div v-if="fileInfo" class="file-info">📄 {{ fileInfo.name }} · {{ fileInfo.size }}</div>
    </div>

    <!-- 按钮 -->
    <div class="btn-row">
      <button class="btn btn-p" @click="run">{{ mode==='encode' ? '编码 →' : '解码 →' }}</button>
      <button class="btn btn-s" @click="swap">⇅ 互换</button>
      <button class="btn btn-ghost" @click="input=''; output=''; fileInfo=null; imagePreview=''; errMsg=''">清空</button>
    </div>

    <p v-if="errMsg" class="err">{{ errMsg }}</p>

    <!-- 结果 -->
    <div v-if="output" class="result-section">
      <div class="output-hdr">
        <label class="lbl" style="margin:0">{{ mode==='encode' ? 'Base64 结果' : '解码结果' }}</label>
        <span v-if="stats" class="stats">{{ stats }}</span>
        <button class="btn btn-s btn-sm" @click="copy">{{ copied ? '✓' : '复制' }}</button>
        <button class="btn btn-s btn-sm" @click="download">⬇ 下载</button>
      </div>
      <textarea readonly :value="output" rows="6" class="inp out" style="margin-top:6px" />
    </div>

    <!-- 图片预览 -->
    <div v-if="imagePreview" class="img-preview">
      <label class="lbl">图片预览</label>
      <img :src="imagePreview" alt="preview" class="preview-img" />
      <a :href="imagePreview" download="decoded_image" class="btn btn-s btn-sm" style="display:inline-flex;margin-top:8px">⬇ 下载图片</a>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.ctrl-bar { display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start; }
.col { display:flex; flex-direction:column; gap:6px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:2px; }
.tg { display:flex; gap:6px; }
.tog { padding:6px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); }
.tog-a { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }
.chk-label { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--vp-c-text-1); cursor:pointer; white-space:nowrap; }
.chk { accent-color:var(--vp-c-brand-1); width:14px; height:14px; }
.file-btn { padding:6px 14px; border-radius:6px; font-size:13px; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); display:inline-block; }
.file-btn:hover { border-color:var(--vp-c-brand-1); }
.drop-zone { position:relative; border:2px dashed var(--vp-c-divider); border-radius:10px; transition:all .2s; }
.drag-over { border-color:var(--vp-c-brand-1); background:var(--vp-c-brand-soft); }
.drop-hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:600; color:var(--vp-c-brand-1); pointer-events:none; }
.inp {
  background:transparent; border:none; outline:none;
  padding:10px 12px; font-size:13px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:monospace; line-height:1.6; display:block;
}
.out { background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider); border-radius:8px; cursor:text; }
.file-info { font-size:12px; color:var(--vp-c-brand-1); margin-top:4px; }
.btn-row { display:flex; gap:10px; flex-wrap:wrap; }
.btn { padding:9px 20px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.btn-ghost { background:transparent; border:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); }
.btn-ghost:hover { border-color:#ef4444; color:#ef4444; }
.btn-sm { padding:4px 12px; font-size:12px; }
.result-section { display:flex; flex-direction:column; }
.output-hdr { display:flex; align-items:center; gap:8px; }
.stats { font-size:12px; color:var(--vp-c-text-3); margin-left:auto; }
.err { color:#ef4444; font-size:13px; margin:0; }
.img-preview { display:flex; flex-direction:column; gap:8px; }
.preview-img { max-width:100%; max-height:320px; object-fit:contain; border-radius:8px; border:1px solid var(--vp-c-divider); }
</style>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const input = ref('https://www.keaneai.top')
const size = ref(256)
const errorLevel = ref<'L'|'M'|'Q'|'H'>('M')
const fgColor = ref('#1a1a2e')
const bgColor = ref('#ffffff')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const dataUrl = ref('')
const svgData = ref('')
const errMsg = ref('')
const copied = ref(false)

let QR: any = null

const MAX_CHARS = 2000
const charCount = () => input.value.length
const charWarn = () => input.value.length > MAX_CHARS

onMounted(async () => {
  // 跟随系统暗色模式自动设置默认颜色
  if (document.documentElement.classList.contains('dark')) {
    fgColor.value = '#e2e8f0'
    bgColor.value = '#1e1e2e'
  }
  const mod = await import('qrcode')
  QR = mod.default
  await generate()
})

watch([size, errorLevel, fgColor, bgColor], generate)

async function generate() {
  if (!QR || !input.value.trim()) return
  errMsg.value = ''
  try {
    await QR.toCanvas(canvasRef.value, input.value, {
      width: size.value,
      margin: 2,
      errorCorrectionLevel: errorLevel.value,
      color: { dark: fgColor.value, light: bgColor.value },
    })
    dataUrl.value = canvasRef.value!.toDataURL('image/png')
    svgData.value = await QR.toString(input.value, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: errorLevel.value,
      color: { dark: fgColor.value, light: bgColor.value },
    })
  } catch (e: any) {
    errMsg.value = e?.message || '生成失败'
    dataUrl.value = ''
  }
}

function downloadSvg() {
  const blob = new Blob([svgData.value], { type: 'image/svg+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'qrcode.svg'
  a.click()
}

async function copyImage() {
  if (!canvasRef.value) return
  canvasRef.value.toBlob(async blob => {
    if (!blob) return
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copied.value = true
    setTimeout(() => copied.value = false, 1500)
  })
}

function clear() {
  input.value = ''
  dataUrl.value = ''
  svgData.value = ''
  errMsg.value = ''
}
</script>

<template>
  <div class="tw">
    <!-- 输入 -->
    <div class="input-wrap">
      <div class="input-header">
        <label class="lbl">文字或链接</label>
        <span :class="['char-count', charWarn() && 'char-warn']">{{ charCount() }} / {{ MAX_CHARS }}</span>
      </div>
      <textarea v-model="input" rows="3" class="inp" placeholder="https://example.com 或任意文字"
        @input="generate" />
    </div>

    <!-- 设置 -->
    <div class="settings">
      <div class="setting-item">
        <label class="lbl">尺寸</label>
        <select v-model.number="size" class="sel">
          <option :value="128">128 px</option>
          <option :value="256">256 px</option>
          <option :value="512">512 px</option>
        </select>
      </div>
      <div class="setting-item">
        <label class="lbl">容错级别</label>
        <select v-model="errorLevel" class="sel">
          <option value="L">L（7%）</option>
          <option value="M">M（15%）</option>
          <option value="Q">Q（25%）</option>
          <option value="H">H（30%）</option>
        </select>
      </div>
      <div class="setting-item">
        <label class="lbl">前景色</label>
        <div class="color-wrap">
          <input type="color" v-model="fgColor" class="color-input" />
          <span class="color-val">{{ fgColor }}</span>
        </div>
      </div>
      <div class="setting-item">
        <label class="lbl">背景色</label>
        <div class="color-wrap">
          <input type="color" v-model="bgColor" class="color-input" />
          <span class="color-val">{{ bgColor }}</span>
        </div>
      </div>
    </div>

    <p v-if="errMsg" class="err">{{ errMsg }}</p>
    <p v-if="charWarn()" class="warn">内容超过 {{ MAX_CHARS }} 字符，二维码密度极高，可能无法扫描</p>

    <!-- 预览 -->
    <div class="qr-wrap">
      <canvas ref="canvasRef" />
    </div>

    <!-- 操作 -->
    <div v-if="dataUrl" class="actions">
      <a :href="dataUrl" download="qrcode.png" class="btn btn-p">⬇ PNG</a>
      <button class="btn btn-s" @click="downloadSvg">⬇ SVG</button>
      <button class="btn btn-s" @click="copyImage">{{ copied ? '✓ 已复制' : '复制图片' }}</button>
      <button class="btn btn-s" @click="clear">清空</button>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.input-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.input-wrap { display:flex; flex-direction:column; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; }
.char-count { font-size:12px; color:var(--vp-c-text-3); }
.char-warn { color:#f59e0b; font-weight:600; }
.inp, .sel {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:8px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box;
}
.inp { resize:vertical; }
.inp:focus, .sel:focus { outline:none; border-color:var(--vp-c-brand-1); }
.settings { display:flex; gap:12px; flex-wrap:wrap; }
.setting-item { display:flex; flex-direction:column; gap:4px; }
.color-wrap { display:flex; align-items:center; gap:6px; }
.color-input { width:40px; height:32px; border:1px solid var(--vp-c-divider); border-radius:6px; padding:2px; cursor:pointer; background:var(--vp-c-bg-soft); }
.color-val { font-size:12px; font-family:monospace; color:var(--vp-c-text-2); }
.qr-wrap { display:flex; justify-content:center; padding:8px 0; }
.qr-wrap canvas { border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.12); }
.actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.btn { padding:8px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; text-decoration:none; display:inline-flex; align-items:center; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.err { color:#ef4444; font-size:13px; margin:0; }
.warn { color:#f59e0b; font-size:13px; margin:0; }
</style>

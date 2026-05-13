<script setup lang="ts">
import { ref, onMounted } from 'vue'

const input = ref('https://www.keaneai.top')
const size = ref(256)
const errorLevel = ref<'L'|'M'|'Q'|'H'>('M')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const dataUrl = ref('')
const errMsg = ref('')

let QR: any = null

onMounted(async () => {
  const mod = await import('qrcode')
  QR = mod.default
  await generate()
})

async function generate() {
  if (!QR || !input.value.trim()) return
  errMsg.value = ''
  try {
    await QR.toCanvas(canvasRef.value, input.value, {
      width: size.value,
      margin: 2,
      errorCorrectionLevel: errorLevel.value,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    })
    dataUrl.value = canvasRef.value!.toDataURL('image/png')
  } catch (e: any) {
    errMsg.value = e?.message || '生成失败'
  }
}
</script>

<template>
  <div class="tw">
    <div class="row">
      <div class="col grow">
        <label class="lbl">文字或链接</label>
        <textarea v-model="input" rows="3" class="inp" placeholder="https://example.com 或任意文字" @input="generate" />
      </div>
      <div class="col" style="gap:8px">
        <div>
          <label class="lbl">尺寸</label>
          <select v-model.number="size" class="sel" @change="generate">
            <option :value="128">128 px</option>
            <option :value="256">256 px</option>
            <option :value="512">512 px</option>
          </select>
        </div>
        <div>
          <label class="lbl">容错级别</label>
          <select v-model="errorLevel" class="sel" @change="generate">
            <option value="L">L（7%）</option>
            <option value="M">M（15%）</option>
            <option value="Q">Q（25%）</option>
            <option value="H">H（30%）</option>
          </select>
        </div>
      </div>
    </div>
    <p v-if="errMsg" class="err">{{ errMsg }}</p>
    <div class="qr-wrap">
      <canvas ref="canvasRef" />
    </div>
    <div v-if="dataUrl" class="actions">
      <a :href="dataUrl" download="qrcode.png" class="btn btn-p">⬇ 下载 PNG</a>
      <button class="btn btn-s" @click="navigator.clipboard.writeText(input)">复制内容</button>
    </div>
  </div>
</template>

<style scoped>
.tw { display:flex; flex-direction:column; gap:16px; }
.row { display:flex; gap:16px; flex-wrap:wrap; }
.col { display:flex; flex-direction:column; gap:4px; }
.grow { flex:1; min-width:200px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; margin-bottom:4px; display:block; }
.inp, .sel {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:8px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box;
}
.inp { resize:vertical; }
.inp:focus, .sel:focus { outline:none; border-color:var(--vp-c-brand-1); }
.qr-wrap { display:flex; justify-content:center; padding:16px 0; }
.qr-wrap canvas { border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.12); }
.actions { display:flex; gap:12px; justify-content:center; }
.btn { padding:9px 20px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; text-decoration:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover { background:var(--vp-c-brand-2); }
.btn-s { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); border:1px solid var(--vp-c-divider); }
.btn-s:hover { border-color:var(--vp-c-brand-1); }
.err { color:#ef4444; font-size:13px; }
</style>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

let seq = 0
let t: ReturnType<typeof setTimeout> | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === '~') {
    if (t) clearTimeout(t)
    seq++
    if (seq >= 3) {
      seq = 0
      window.location.href = '/admin/'
    } else {
      t = setTimeout(() => { seq = 0 }, 2000 )
    }
  } else {
    seq = 0
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<template></template>

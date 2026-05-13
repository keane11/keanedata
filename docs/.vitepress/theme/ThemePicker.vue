<template>
  <div class="theme-picker">
    <button
      v-for="t in themes"
      :key="t.name"
      :title="t.label"
      :class="['theme-dot', { active: current === t.name }]"
      :style="{ background: t.color }"
      @click="setTheme(t.name)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const themes = [
  { name: 'indigo', label: '靛蓝', color: '#4f6ef7' },
  { name: 'green',  label: '翠绿', color: '#10b981' },
  { name: 'rose',   label: '玫红', color: '#f43f5e' },
  { name: 'orange', label: '暖橙', color: '#f97316' },
  { name: 'purple', label: '紫罗兰', color: '#8b5cf6' },
]

const current = ref('indigo')

function setTheme(name: string) {
  current.value = name
  document.documentElement.dataset.theme = name
  localStorage.setItem('keane-theme', name)
}

onMounted(() => {
  const saved = localStorage.getItem('keane-theme') || 'indigo'
  setTheme(saved)
})
</script>

<style scoped>
.theme-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
}
.theme-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  padding: 0;
}
.theme-dot:hover {
  transform: scale(1.2);
}
.theme-dot.active {
  border-color: var(--vp-c-text-1);
  transform: scale(1.15);
}
</style>

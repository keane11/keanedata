<script setup lang="ts">
import { ref, onMounted, onUpdated } from 'vue'
import { useData } from 'vitepress'
const { page } = useData()
const minutes = ref(0)
const calc = () => {
  const el = document.querySelector('.vp-doc')
  if (!el) return
  const chars = el.textContent?.replace(/\s+/g, '').length || 0
  minutes.value = Math.max(1, Math.ceil(chars / 400))
}
onMounted(calc)
onUpdated(calc)
</script>
<template>
  <p v-if="minutes && !page.frontmatter.layout" class="reading-time">
    预计阅读 {{ minutes }} 分钟
  </p>
</template>
<style scoped>
.reading-time {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  margin: -0.5rem 0 1.5rem;
}
</style>

<script setup lang="ts">
import { data as posts } from '../../data/posts.data'
import { useData } from 'vitepress'
const { frontmatter } = useData()
</script>
<template>
  <div v-if="frontmatter.layout === 'home'" class="recent-posts">
    <div class="recent-posts-inner">
      <h2 class="recent-title">最近更新</h2>
      <div class="recent-list">
        <a v-for="post in posts" :key="post.url" :href="post.url" class="recent-item">
          <div class="recent-item-header">
            <span class="recent-item-title">{{ post.title }}</span>
            <span class="recent-item-date">{{ post.date }}</span>
          </div>
          <p v-if="post.description" class="recent-item-desc">{{ post.description }}</p>
        </a>
      </div>
    </div>
  </div>
</template>
<style scoped>
.recent-posts {
  padding: 0 24px 48px;
}
.recent-posts-inner {
  max-width: 1152px;
  margin: 0 auto;
}
.recent-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--vp-c-text-1);
  border-bottom: 2px solid var(--vp-c-brand-soft);
  padding-bottom: 8px;
}
.recent-list {
  display: grid;
  gap: 12px;
}
.recent-item {
  display: block;
  padding: 16px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: var(--vp-c-bg-soft);
}
.recent-item:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px var(--vp-c-brand-soft);
}
.recent-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.recent-item-title {
  font-weight: 500;
  color: var(--vp-c-brand-1);
  font-size: 0.95rem;
}
.recent-item-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.recent-item-desc {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

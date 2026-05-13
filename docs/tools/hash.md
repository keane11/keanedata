---
title: Hash 计算器
description: 在线 Hash 计算工具，支持 SHA-1/SHA-256/SHA-512，可对比两段文本的散列值
date: 2026-05-13
---

# Hash 计算器

计算文本的散列值（SHA-1 / SHA-256 / SHA-512），支持双文本对比模式，快速验证内容是否一致。

<script setup>
import HashCalc from '../.vitepress/theme/tools/HashCalc.vue'
</script>

<HashCalc />

::: tip 说明
计算在浏览器本地完成（Web Crypto API），文本不会上传到任何服务器。不支持 MD5，因其已被认为不安全——推荐使用 SHA-256 或更高。
:::

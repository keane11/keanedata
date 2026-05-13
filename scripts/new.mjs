#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const sections = { ai: 'AI 平台', notes: '编程笔记', projects: '项目实战' }
const [, , section, slug] = process.argv

if (!section || !slug || !sections[section]) {
  console.log('用法：npm run new <section> <slug>')
  console.log('示例：npm run new ai deepseek')
  console.log('      npm run new notes fastapi')
  console.log('      npm run new projects blog')
  console.log(`\n可用分区：${Object.keys(sections).join(', ')}`)
  process.exit(1)
}

const filePath = resolve(root, 'docs', section, `${slug}.md`)

if (existsSync(filePath)) {
  console.error(`文件已存在：docs/${section}/${slug}.md`)
  process.exit(1)
}

const date = new Date().toISOString().slice(0, 10)
const title = slug.charAt(0).toUpperCase() + slug.slice(1)

const template = `---
title: ${title}
description:
date: ${date}
tags: []
order: 99
---

# ${title}

> 简介：一句话介绍这篇文章的内容。

## 章节一

内容...

## 章节二

内容...
`

mkdirSync(dirname(filePath), { recursive: true })
writeFileSync(filePath, template, 'utf-8')
console.log(`✓ 已创建：docs/${section}/${slug}.md`)
console.log(`  编辑后运行 git add / commit / push 即可发布`)

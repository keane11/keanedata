import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

const sidebarOptions = {
  useTitleFromFileHeading: true,
  useFolderTitleFromIndexFile: true,
  excludeFiles: ['index.md'],
  sortMenusByFrontmatterOrder: true,
  frontmatterOrderDefaultValue: 99,
  collapsed: false,
  rootGroupCollapsed: false,
}

const sidebar = generateSidebar([
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'ai',       resolvePath: '/ai/' },
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'notes',    resolvePath: '/notes/' },
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'projects', resolvePath: '/projects/' },
])

export default defineConfig({
  title: 'Keane 的技术笔记',
  description: 'AI 平台配置 · 编程笔记 · 项目实战',
  lang: 'zh-CN',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/favicon.ico',

    nav: [
      { text: '首页',   link: '/' },
      { text: 'AI',     link: '/ai/' },
      { text: '笔记',   link: '/notes/' },
      { text: '项目',   link: '/projects/' },
      { text: '文件共享', link: 'https://share.keaneai.top', target: '_blank' },
    ],

    sidebar,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/keane11' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2025 Keane',
    },

    outline: {
      label: '本页目录',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})

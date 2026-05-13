import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

const sidebarOptions = {
  useTitleFromFrontmatter: true,
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
  lastUpdated: true,

  sitemap: {
    hostname: 'https://www.keaneai.top',
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#4f6ef7' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Keane 的技术笔记' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  themeConfig: {
    logo: '/favicon.svg',

    nav: [
      { text: '首页',     link: '/' },
      { text: 'AI 平台',  link: '/ai/' },
      { text: '编程笔记', link: '/notes/' },
      { text: '项目实战', link: '/projects/' },
      {
        text: '工具',
        link: '/tools/',
        items: [
          { text: '🔲 QR 码生成器', link: '/tools/qrcode' },
          { text: '#  Hash 计算器', link: '/tools/hash' },
          { text: '✨ Prompt 构建器', link: '/tools/prompt' },
          { text: '📄 Base64 编解码', link: '/tools/base64' },
          { text: '{}  JSON 格式化', link: '/tools/json' },
          { text: '⏱  时间戳转换', link: '/tools/timestamp' },
          { text: '📁 文件共享', link: '/tools/share' },
        ],
      },
    ],

    sidebar: {
      ...sidebar,
      '/tools/': [
        {
          text: '开发工具',
          items: [
            { text: 'QR 码生成器', link: '/tools/qrcode' },
            { text: 'Hash 计算器', link: '/tools/hash' },
            { text: 'Base64 编解码', link: '/tools/base64' },
            { text: 'JSON 格式化', link: '/tools/json' },
            { text: '时间戳转换', link: '/tools/timestamp' },
          ],
        },
        {
          text: 'AI 辅助',
          items: [
            { text: 'Prompt 构建器', link: '/tools/prompt' },
          ],
        },
        {
          text: '服务',
          items: [
            { text: '文件共享', link: '/tools/share' },
          ],
        },
      ],
    },

    externalLinkIcon: true,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/keane11' },
    ],

    search: {
      provider: 'local',
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    },

    notFound: {
      title: '页面不见了',
      quote: '链接可能已失效，或页面已被移动。',
      linkLabel: '返回首页',
      linkText: '← 返回首页',
      code: '404',
    },

    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2026 Keane',
    },

    outline: {
      label: '本页目录',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    returnToTopLabel: '回到顶部',
  },
})

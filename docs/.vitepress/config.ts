import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Keane 的技术笔记',
  description: 'AI 平台配置 · 编程笔记 · 项目实战',
  lang: 'zh-CN',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/favicon.ico',

    nav: [
      { text: '首页', link: '/' },
      { text: 'AI 平台', link: '/ai/' },
      { text: '编程笔记', link: '/notes/' },
      { text: '项目实战', link: '/projects/' },
      { text: '文件共享', link: 'https://share.keaneai.top', target: '_blank' },
    ],

    sidebar: {
      '/ai/': [
        {
          text: 'AI 平台',
          items: [
            { text: '概览', link: '/ai/' },
            { text: 'Claude', link: '/ai/claude' },
            { text: 'OpenAI', link: '/ai/openai' },
            { text: 'Gemini', link: '/ai/gemini' },
            { text: '提示词工程', link: '/ai/prompt' },
          ],
        },
      ],
      '/notes/': [
        {
          text: '编程笔记',
          items: [
            { text: '概览', link: '/notes/' },
            { text: 'Python', link: '/notes/python' },
            { text: 'Docker', link: '/notes/docker' },
            { text: 'Linux', link: '/notes/linux' },
            { text: 'Git', link: '/notes/git' },
          ],
        },
      ],
      '/projects/': [
        {
          text: '项目实战',
          items: [
            { text: '概览', link: '/projects/' },
            { text: 'QR 文件共享', link: '/projects/qr-file-share' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/keane11' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: '用 VitePress 构建',
      copyright: 'Copyright © 2024 Keane',
    },

    outline: {
      label: '本页目录',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})

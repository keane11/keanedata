import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// 构建期扫描所有 .md 文件，收集 hidden: true 的文章路径，加入 srcExclude
// 这样 VitePress 根本不会生成对应 HTML，直接访问 URL 也会 404
const docsDir = fileURLToPath(new URL('..', import.meta.url))
function collectHiddenFiles(): string[] {
  const result: string[] = []
  function scan(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== '.vitepress' && name !== 'public' && !name.startsWith('.')) scan(full)
      } else if (name.endsWith('.md')) {
        const text = readFileSync(full, 'utf-8')
        if (text.startsWith('---')) {
          const close = text.indexOf('\n---', 3)
          if (close > 0 && /^hidden:\s*true\b/m.test(text.slice(3, close)))
            result.push(relative(docsDir, full))
        }
      }
    }
  }
  scan(docsDir)
  return result
}

const sidebarOptions = {
  useTitleFromFrontmatter: true,
  useTitleFromFileHeading: true,
  useFolderTitleFromIndexFile: true,
  excludeFiles: ['index.md'],
  excludeFilesByFrontmatterFieldName: 'hidden',
  sortMenusByFrontmatterOrder: true,
  frontmatterOrderDefaultValue: 99,
  collapsed: false,
  rootGroupCollapsed: false,
}

const sidebar = generateSidebar([
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'ai',           resolvePath: '/ai/' },
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'notes',        resolvePath: '/notes/' },
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'projects',     resolvePath: '/projects/' },
  { ...sidebarOptions, documentRootPath: 'docs', scanStartPath: 'productivity', resolvePath: '/productivity/' },
])

export default defineConfig({
  title: 'Keane 的折腾手记',
  description: 'AI 工具 · 服务器实战 · 效率工具 · 内容变现',
  lang: 'zh-CN',
  ignoreDeadLinks: true,
  lastUpdated: true,
  srcExclude: collectHiddenFiles(),

  sitemap: {
    hostname: 'https://www.keaneai.top',
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#4f6ef7' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Keane 的折腾手记' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  themeConfig: {
    logo: '/favicon.svg',

    nav: [
      { text: '首页',     link: '/' },
      { text: 'AI 平台',  link: '/ai/' },
      { text: '编程笔记', link: '/notes/' },
      { text: '项目实战', link: '/projects/' },
      { text: '生产力工具', link: '/productivity/' },
      {
        text: '工具',
        link: '/tools/',
        items: [
          { text: '🔲 QR 码生成器', link: '/tools/qrcode' },
          { text: '#  Hash 计算器', link: '/tools/hash' },
          { text: '✨ Prompt 构建器', link: '/tools/prompt' },
          { text: '📖 网文 Prompt 生成器', link: '/tools/novel-prompt' },
          { text: '📄 Base64 编解码', link: '/tools/base64' },
          { text: '{}  JSON 格式化', link: '/tools/json' },
          { text: '⏱  时间戳转换', link: '/tools/timestamp' },
          { text: '📁 文件共享', link: '/tools/share' },
        ],
      },
    ],

    sidebar: {
      ...sidebar,
      '/ai/': [
        {
          text: '🚀 新手入门',
          collapsed: false,
          items: [
            { text: '前置准备：VPN · 接码 · 虚拟信用卡', link: '/ai/ai-account-prerequisites' },
            { text: 'Google 账号注册全流程', link: '/ai/google-account-register' },
            { text: 'ChatGPT / Claude / Gemini 注册与订阅', link: '/ai/chatgpt-claude-gemini-register' },
          ],
        },
        {
          text: '🤖 主流 AI 平台',
          collapsed: false,
          items: [
            { text: 'Claude 使用指南', link: '/ai/claude' },
            { text: 'OpenAI 使用指南', link: '/ai/openai' },
            { text: 'Gemini 使用指南', link: '/ai/gemini' },
          ],
        },
        {
          text: '🛠 工具选型',
          collapsed: false,
          items: [
            { text: 'AI 编程工具横评（Cursor vs Copilot vs Claude Code）', link: '/ai/ai-coding-tools-compare' },
          ],
        },
        {
          text: '⚙️ 工具部署',
          collapsed: false,
          items: [
            { text: 'WSL 安装 AI CLI 工具', link: '/ai/wsl_ai_cli_教程' },
            { text: 'CC Switch 切换国产模型', link: '/ai/cc_switch_claude_code_国产模型切换流程' },
            { text: 'DeepSeek TUI / CodeWhale WSL 安装', link: '/ai/deepseek-tui-wsl' },
          ],
        },
        {
          text: '📐 方法论',
          collapsed: false,
          items: [
            { text: '提示词工程指南', link: '/ai/prompt' },
            { text: 'Hermes Agent 配置指南', link: '/ai/hermes' },
            { text: 'HARNESS 工作流完整指南', link: '/ai/HARNESS_WorkFlow' },
          ],
        },
      ],
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
            { text: '网文 Prompt 生成器', link: '/tools/novel-prompt' },
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

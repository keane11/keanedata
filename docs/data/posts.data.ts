import { createContentLoader } from 'vitepress'

interface PostData {
  title: string
  url: string
  date: string
  description: string
}

declare const data: PostData[]
export { data }

export default createContentLoader(['ai/*.md', 'notes/*.md', 'projects/*.md'], {
  transform(raw) {
    return raw
      .filter(p => p.frontmatter.date && !p.url.endsWith('/index') && p.frontmatter.layout !== 'home')
      .sort((a, b) => +new Date(b.frontmatter.date as string) - +new Date(a.frontmatter.date as string))
      .slice(0, 6)
      .map(p => ({
        title: (p.frontmatter.title as string) || p.url,
        url: p.url,
        date: p.frontmatter.date as string,
        description: (p.frontmatter.description as string) || '',
      }))
  },
})

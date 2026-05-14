# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run docs:dev      # Start local dev server (hot reload)
npm run docs:build    # Build to docs/.vitepress/dist/
npm run docs:preview  # Preview production build locally
npm run new <section> <slug>  # Scaffold a new article
# Sections: ai | notes | projects
# Example: npm run new notes fastapi
```

There are no lint or test commands — this is a static content site.

## Deployment

Push to `main` → GitHub Actions builds → deploys to GitHub Pages at `keaneai.top`. The workflow uses `fetch-depth: 0` so `lastUpdated` git timestamps work correctly.

**Critical sync rule:** The Admin Panel writes commits directly to GitHub via the REST API. Always `git pull --rebase origin main` before making local changes, to avoid overwriting remote Admin Panel edits. A `.git/hooks/pre-push` hook does this automatically before every push.

## Architecture

### Content Structure

Three content sections, each auto-generating its sidebar via `vitepress-sidebar`:
- `docs/ai/` — AI platform guides (Claude, OpenAI, Gemini, prompting)
- `docs/notes/` — Technical cheat sheets (Python, Docker, Linux, Git, embedded)
- `docs/projects/` — Project write-ups

Every content `.md` file should have this frontmatter:
```yaml
---
title: 显示标题
description: 文章摘要（供搜索结果和 RecentPosts 组件使用）
date: YYYY-MM-DD
tags: [Tag1, Tag2]
order: 1          # lower = higher in sidebar
---
```

The sidebar order comes from `order` frontmatter (`frontmatterOrderDefaultValue: 99`). `index.md` files are excluded from sidebars and serve as section landing pages.

### Theme Extension (`docs/.vitepress/theme/`)

`index.ts` extends the default VitePress theme with three injected components via layout slots:
- `nav-bar-content-after` → `ThemePicker.vue` — 5 color themes stored in `data-theme` on `<html>`; persisted in `localStorage`
- `doc-before` → `ReadingTime.vue` — estimates reading time (chars ÷ 400), hidden on layout pages
- `home-features-after` → `RecentPosts.vue` — renders the 6 most recent posts on the homepage only (`frontmatter.layout === 'home'`)

`custom.css` drives the brand color system via CSS variables (`--vp-c-brand-*`), per-theme overrides via `[data-theme='green']` etc., and a scroll-driven reading progress bar (`animation-timeline: scroll(root)`) using `@supports` for progressive enhancement.

### Build-Time Data (`docs/data/posts.data.ts`)

`createContentLoader` scans `ai/*.md`, `notes/*.md`, `projects/*.md` at build time, filters to pages that have a `date` frontmatter field, sorts descending, and exports the top 6 as `PostData[]`. `RecentPosts.vue` imports this at runtime. Adding a new article won't appear in RecentPosts unless `date` is set in its frontmatter.

### Interactive Tools (`docs/tools/`)

Each tool page is a `.md` file that imports and renders a Vue SFC from `docs/.vitepress/theme/tools/`:

| Page | Component | Key APIs |
|------|-----------|----------|
| `qrcode.md` | `QrCode.vue` | `qrcode` npm package (Canvas + SVG output) |
| `hash.md` | `HashCalc.vue` | `crypto.subtle.digest` |
| `base64.md` | `Base64Tool.vue` | `FileReader`, `btoa/atob`, MIME detection |
| `json.md` | `JsonFormat.vue` | `JSON.parse/stringify`, key sorting |
| `timestamp.md` | `TimestampTool.vue` | `Date`, auto-detect ms vs sec (`n > 1e12`) |
| `prompt.md` | `PromptBuilder.vue` | `localStorage` for custom presets |

To add a new tool: create the Vue component in `theme/tools/`, create a `.md` page that imports it, add entries in `config.ts` under both `nav` (工具 dropdown) and the `/tools/` sidebar.

The `/tools/` sidebar is **manually defined** in `config.ts` (unlike the auto-generated `ai/notes/projects` sidebars).

### Admin Panel (`docs/public/admin/index.html`)

A standalone single-file HTML app (no build step) deployed as a static asset. It:
1. Encrypts the GitHub Personal Access Token with AES-GCM + PBKDF2, stores in `localStorage`
2. Uses the GitHub REST API (`/repos/{owner}/{repo}/contents/{path}`) to list, read, and write files
3. Edits frontmatter fields (`title`, `order`, `description`, `tags`, `date`) via toolbar inputs and the `setFrontmatterField()` helper
4. Commits changes directly to `main` with a SHA-based update (requires current file SHA to avoid conflicts)

Because the Admin Panel bypasses the local git tree entirely, local and remote can diverge. The pre-push hook handles this automatically.

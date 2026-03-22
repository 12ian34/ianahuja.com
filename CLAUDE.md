# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Framework**: Hugo v0.154.0 — no theme, fully custom layouts
- **Hosting**: Netlify (auto-deploys from `main` branch)
- **CMS**: Pages CMS (`.pages.yml`) — edits commit to GitHub → triggers Netlify rebuild
- **Analytics**: PostHog (EU instance, loaded in `layouts/partials/head.html`)
- **CSS**: Single file `static/css/style.css`, no preprocessor
- **JS**: Vanilla only — no frameworks

## Dev commands

```bash
hugo server -D          # local dev server with drafts
hugo                    # production build → public/
```

No test suite, linter, or build toolchain beyond Hugo itself.

## Architecture

**Layout hierarchy**: `layouts/_default/baseof.html` wraps all pages (nav, stars background, main content block). Section-specific layouts in `layouts/{words,recipes,supperclubs,black-hole}/`.

**Content sections**:

| Section | Content path | Notes |
|---|---|---|
| Home | `content/_index.md` | Landing page with live projects list |
| Words (blog) | `content/words/*.md` | Permalink `/words/:year/:month/:slug/`, listing shows date + description |
| Supper clubs | `content/supperclubs/*.md` | Event pages with shared info partial |
| Recipes | `content/recipes/*.md` | Grid layout with client-side cuisine/diet filtering |
| Black hole | `content/black-hole.md` | WebGL Schwarzschild ray tracing + KaTeX equations |
| Music | `content/music.md` | Standalone page |

**Partials**: `head.html` (OG/Twitter meta with per-page override), `nav.html` (glass-morphism horizontal scroll nav), `stars.html` (decorative background canvas).

**Shortcodes**: `figure.html` (image + caption), `youtube.html` (responsive 16:9 embed — usage: `{{</* youtube VIDEO_ID "optional title" */>}}`).

**JS assets**: `static/js/geometric-visualizer.js` (400-particle parallax starfield with shooting stars, nebula wisps, mouse repulsion) and `static/js/black-hole.js` (WebGL fragment shader ray tracer with orbit controls).

## Conventions

- **Lowercase** titles and copy throughout the entire site
- Dark theme (`#0f1210` bg) with green accents (`#94F3A6`)
- Goldmark renderer with `unsafe = true` — raw HTML allowed in markdown
- `buildFuture = true` — future-dated content is published
- Taxonomies disabled (`disableKinds = ['taxonomy', 'term']`)
- All images in `static/images/`. OG images should be 1200×630 PNG.

## Blog post frontmatter

```yaml
title: "post title"
date: 2026-02-17
description: "short summary"    # used in listing + OG meta
keywords: "comma, separated"
draft: true                      # hide from listing (default false)
og_image: "/images/foo.png"      # optional social preview
og_image_width: 1200
og_image_height: 630
```

## Deployment

Netlify config in `netlify.toml`. Hugo version pinned to v0.154.0. Redirects include `/miniti/*` → `miniti.app` (301) and a catch-all SPA fallback. Domain: ianahuja.com (CNAME in repo root).

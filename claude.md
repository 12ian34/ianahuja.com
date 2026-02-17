# ianahuja.com

Personal site for Ian Ahuja — projects, blog, supper clubs, recipes, music.

## Stack
- **Framework**: Hugo (v0.154.0), no theme — custom layouts
- **Hosting**: Netlify (auto-deploys from `main`)
- **Repo**: github.com/12ian34/ianahuja.com
- **Domain**: ianahuja.com (CNAME managed in repo)
- **Serverless**: Netlify Functions (CommonJS, `netlify/functions/`)
- **Email**: Resend SDK for transactional emails (miniti download flow)
- **Analytics**: PostHog (EU instance, loaded in `head.html`)
- **Fonts**: Google Fonts — Work Sans 300
- **CSS**: Single file `static/css/style.css`, no preprocessor

## Content sections
| Section | Path | Layout | Notes |
|---|---|---|---|
| Home | `content/_index.md` | `_default/single.html` | Personal landing page |
| Words (blog) | `content/words/` | `words/list.html`, `words/single.html` | Permalink: `/words/:year/:month/:slug/`. Listing shows date + description, newest first. Single has reading time, back link. Supports images in body, YouTube embeds via `{{</* youtube VIDEO_ID */>}}` shortcode. Managed via Pages CMS. |
| Miniti | `content/miniti.md` | `miniti/single.html` | Product page — gallery, signup form, changelog |
| Miniti privacy | `content/miniti-privacy.md` | `_default/single.html` | Privacy policy, terms of use, copyright (`/miniti/privacy`) |
| Supper clubs | `content/supperclubs/` | `supperclubs/list.html`, `supperclubs/single.html` | Event pages with shared info partial |
| Recipes | `content/recipes/` | `recipes/list.html`, `recipes/single.html` | Recipe collection |
| Music | `content/music.md` | `_default/single.html` | Standalone page |
| Black hole | `content/black-hole.md` | `black-hole/single.html` | WebGL Schwarzschild black hole — ray tracing, accretion disk, KaTeX equations |

## Key files
- `config.toml` — Hugo config; `buildFuture = true` so future-dated content is published
- `netlify.toml` — Build config + SPA-style redirect fallback
- `layouts/partials/head.html` — `<head>` with OG + Twitter Card meta (per-page override via front matter: `og_title`, `og_description`, `og_image`, `og_image_width`, `og_image_height`)
- `layouts/partials/nav.html` — Horizontal scrolling nav with active state + edge fade
- `layouts/partials/stars.html` — Decorative background partial
- `layouts/shortcodes/figure.html` — Custom figure shortcode
- `layouts/shortcodes/youtube.html` — Responsive YouTube embed (16:9). Usage: `{{</* youtube VIDEO_ID "optional title" */>}}`
- `.pages.yml` — Pages CMS config (words, supper clubs, recipes collections + media)
- `static/js/geometric-visualizer.js` — Background stars canvas (400 particles with depth-based parallax, subtle color tints, occasional shooting stars, satellite passes, nova flares, drifting nebula wisps, mouse repulsion, scroll interaction). Container opacity 0.45, screen blend mode.
- `static/js/black-hole.js` — WebGL black hole (Schwarzschild ray tracing in fragment shader, 350 steps/pixel, accretion disk with Doppler shift, procedural starfield with 3×3 cell neighborhood). Default view: 40 Rs, 85° inclination. Slider 3–40 Rs + mouse/touch orbit + arrow keys. KaTeX for equations in the explainer.

## Netlify Functions
- `request-download.js` — Receives name + email, generates HMAC-signed 24h token, sends download email via Resend (macOS DMG link + iOS TestFlight link)
- `verify-download.js` — Validates token, serves the DMG download

**Env vars required** (set in Netlify dashboard and `.env` for local dev):
- `RESEND_API_KEY` — Resend SDK key for sending emails
- `DOWNLOAD_SECRET` — HMAC secret for signing download tokens
- `SITE_URL` — e.g. `https://ianahuja.com`
- `SENDER_EMAIL` — From address for download emails
- `DOWNLOAD_URL` — Public Proton Drive share link to the current `.dmg.zip`

### Releasing a new miniti macOS version
1. Build the new `.dmg`
2. Upload it to Proton Drive
3. Copy the new public share link
4. Update `DOWNLOAD_URL` in **both** `.env` (local) and Netlify production via `netlify env:set DOWNLOAD_URL "<url>"`
5. Redeploy with `netlify deploy --prod` — Netlify Functions only pick up new env vars after a redeploy
6. Update changelog in `layouts/miniti/single.html`

### Releasing a new miniti iOS version
1. Upload build via Xcode → App Store Connect
2. Wait for TestFlight beta review (few hours to a day)
3. Public TestFlight link (hardcoded in `request-download.js`)
4. Update changelog in `layouts/miniti/single.html`

## Images
All in `static/images/`. OG images should be 1200x630 PNG. `miniti-og.png` was created by center-cropping `miniti-1.png` with `sips`.

## Dev commands
```bash
hugo server -D          # local dev with drafts
hugo                    # production build → public/
netlify dev             # local dev with functions
```

## Conventions
- Lowercase titles and copy throughout the site
- Dark theme with green accents (especially miniti)
- No JS framework — vanilla JS where needed (gallery, lightbox, forms)
- Goldmark renderer with `unsafe = true` (allows raw HTML in markdown)
- Taxonomies disabled (`disableKinds = ['taxonomy', 'term']`)

## Words (blog) frontmatter
```yaml
title: "post title"        # required
date: 2026-02-17            # required, publish date
description: "short summary" # listing page + OG meta
keywords: "comma, separated" # SEO keywords
draft: true                  # hide from listing (default false)
og_image: "/images/foo.png"  # optional social preview
```

## Pages CMS
Config: `.pages.yml` at repo root. Three collections (words, supper clubs, recipes) + media (`static/images` → `/images`). Use https://app.pagescms.org to edit content. Changes commit directly to GitHub → Netlify rebuilds.

## Recent changes
- 2026-02-17: Layout polish — left-aligned recipe cards/filters, left-aligned black hole equations (fit-to-content containers) and stats (single-column), matched black hole body text size to rest of site, capped blog post images at 400px, removed "words" h1 from blog listing, changed homepage title from `<p>` to `<h1>`, added top padding to black hole page to match other pages' spacing.
- 2026-02-17: Aligned nav and body content — moved nav visual styles (glass background, blur, border, shadow) to `.nav-wrap` (full-width), constrained `.nav-top` links to `max-width: 800px` centered with `flex-start` on desktop, matched `main` to same 800px max-width. Nav links and body content now share the same left edge.
- 2026-02-17: Enhanced background stars — 400 particles with depth-based parallax, color tints, shooting stars, satellite passes, nova flares, drifting nebula wisps. Removed constellation lines for performance. Container opacity 0.45, screen blend mode.
- 2026-02-17: Blog groundwork — unhid words in nav, rebuilt list layout (dates, descriptions, newest-first, draft filtering), rebuilt single layout (reading time, proper typography, back link, blockquote/code/image styles), added YouTube embed shortcode (`layouts/shortcodes/youtube.html`), updated `.pages.yml` (keywords, description, draft, og_image fields, view config, exclude `_index.md`), added words-specific CSS.
- 2026-02-17: Left-aligned homepage and music page — removed `centered-content` wrapper divs from `_index.md` and `music.md`, changed `.homepage-title` and `h1` to `text-align: left`, left-aligned `<hr>` elements (`margin: 20px 0` instead of `auto`).
- 2026-02-13: Miniti v1.5.1 release updates — updated DOWNLOAD_URL (Proton Drive), added iOS TestFlight link to download email, updated miniti page tagline/features for iOS, added privacy & terms page (`/miniti/privacy`), updated changelog through v1.5.1.
- 2026-02-12: Black hole page refinements — nav label "black hole", removed page heading, KaTeX equations (13 equations including Schwarzschild metric, geodesic, Doppler, beaming), M87* real-world stats, default 40 Rs / 85° view, 350 ray steps for accuracy at distance, 3×3 starfield cell neighborhood to fix grid artifacts, removed galactic band glow.
- 2026-02-10: Replaced relativistic starfield with WebGL black hole visualization (`/relativity/`). Schwarzschild metric ray tracing in a fragment shader — gravitational lensing, accretion disk with Doppler shift, procedural starfield background. Distance slider + mouse/touch drag orbit controls. Added `date_display` support to supper club templates.
- 2026-02-07: Added per-page OG + Twitter Card meta support in `head.html`. Created `miniti-og.png` (1200x630). Set custom social preview for miniti page.

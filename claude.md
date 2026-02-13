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
| Words (blog) | `content/words/` | `words/list.html`, `words/single.html` | Permalink: `/words/:year/:month/:slug/` |
| Miniti | `content/miniti.md` | `miniti/single.html` | Product page — gallery, signup form, changelog |
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
- `static/js/geometric-visualizer.js` — JS used on the site
- `static/js/black-hole.js` — WebGL black hole (Schwarzschild ray tracing in fragment shader, 350 steps/pixel, accretion disk with Doppler shift, procedural starfield with 3×3 cell neighborhood). Default view: 40 Rs, 85° inclination. Slider 3–40 Rs + mouse/touch orbit + arrow keys. KaTeX for equations in the explainer.

## Netlify Functions
- `request-download.js` — Receives name + email, generates HMAC-signed 24h token, sends download email via Resend
- `verify-download.js` — Validates token, serves the DMG download

**Env vars required** (set in Netlify dashboard and `.env` for local dev):
- `RESEND_API_KEY` — Resend SDK key for sending emails
- `DOWNLOAD_SECRET` — HMAC secret for signing download tokens
- `SITE_URL` — e.g. `https://ianahuja.com`
- `SENDER_EMAIL` — From address for download emails
- `DOWNLOAD_URL` — Public Proton Drive share link to the current `.dmg.zip`

### Releasing a new miniti version
1. Build the new `.dmg`
2. Upload it to Proton Drive
3. Copy the new public share link
4. Update `DOWNLOAD_URL` in **both** `.env` (local) and Netlify production via `netlify env:set DOWNLOAD_URL "<url>"`
5. Redeploy with `netlify deploy --prod` — Netlify Functions only pick up new env vars after a redeploy

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

## Recent changes
- 2026-02-12: Black hole page refinements — nav label "black hole", removed page heading, KaTeX equations (13 equations including Schwarzschild metric, geodesic, Doppler, beaming), M87* real-world stats, default 40 Rs / 85° view, 350 ray steps for accuracy at distance, 3×3 starfield cell neighborhood to fix grid artifacts, removed galactic band glow.
- 2026-02-10: Replaced relativistic starfield with WebGL black hole visualization (`/relativity/`). Schwarzschild metric ray tracing in a fragment shader — gravitational lensing, accretion disk with Doppler shift, procedural starfield background. Distance slider + mouse/touch drag orbit controls. Added `date_display` support to supper club templates.
- 2026-02-07: Added per-page OG + Twitter Card meta support in `head.html`. Created `miniti-og.png` (1200x630). Set custom social preview for miniti page.

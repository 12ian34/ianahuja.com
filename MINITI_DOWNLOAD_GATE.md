# Miniti Download Gate

Add an email-verified download gate for the Miniti macOS app at `ianahuja.com/miniti`.

## Overview

Users visit `/miniti`, enter their name + email, receive a verification email with a signed download link, click it, and get redirected to the `.dmg.zip` on GitHub Releases. Emails are collected via Netlify Forms for easy export/CRM.

## Architecture

- **Page**: Hugo content page at `content/miniti.md` + layout at `layouts/miniti/single.html`
- **Email gate**: Two Netlify Functions (JS, in `netlify/functions/`)
- **Email delivery**: Resend (free tier, 100 emails/day)
- **File hosting**: GitHub Releases on the `12ian34/miniti` repo (or a dedicated releases repo)
- **Token signing**: HMAC-SHA256 with a secret, 24h expiry

## Flow

1. User visits `ianahuja.com/miniti`
2. Fills in name + email, submits form
3. Form POST goes to `/.netlify/functions/request-download`
4. Function: stores submission in Netlify Forms (for records), generates HMAC token with email + expiry, sends verification email via Resend
5. User clicks link in email → `/.netlify/functions/verify-download?token=...&email=...`
6. Function: verifies HMAC + checks expiry → 302 redirect to GitHub Release `.dmg.zip` URL
7. On failure: shows "link expired or invalid" message

## Setup

### 1. Resend account
- Sign up at https://resend.com (free, 100 emails/day)
- Add and verify a sending domain (e.g. `ianahuja.com`) OR use the free `onboarding@resend.dev` sender for testing
- Create an API key

### 2. GitHub Release
- In the `miniti` repo (or a new `miniti-releases` repo), create a GitHub Release
- Upload `Miniti-<version>.dmg.zip` as a release asset
- Note the direct download URL: `https://github.com/12ian34/miniti/releases/download/v<version>/Miniti-<version>.dmg.zip`

### 3. Netlify environment variables
In Netlify dashboard → Site settings → Environment variables, add:
- `RESEND_API_KEY` — from Resend dashboard
- `DOWNLOAD_SECRET` — random string for HMAC signing (generate with `openssl rand -hex 32`)
- `DOWNLOAD_URL` — GitHub Release asset URL for the current version
- `SITE_URL` — `https://ianahuja.com`
- `SENDER_EMAIL` — verified Resend sender (e.g. `ian@ianahuja.com` or `onboarding@resend.dev`)

### 4. Install Resend dependency
```bash
npm init -y  # if no package.json yet
npm install resend
```

### 5. Netlify Functions

Create `netlify/functions/request-download.js`:

```js
const { Resend } = require("resend");
const crypto = require("crypto");

function generateToken(email, secret) {
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const data = `${email}:${expires}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  return { token: signature, expires };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { name, email } = JSON.parse(event.body);

  if (!name || !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name and email required" }),
    };
  }

  const secret = process.env.DOWNLOAD_SECRET;
  const siteUrl = process.env.SITE_URL;
  const senderEmail = process.env.SENDER_EMAIL;

  const { token, expires } = generateToken(email, secret);
  const verifyUrl = `${siteUrl}/.netlify/functions/verify-download?email=${encodeURIComponent(email)}&expires=${expires}&token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: `Miniti <${senderEmail}>`,
      to: email,
      subject: "Your Miniti download link",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-bottom: 8px;">Hey ${name},</h2>
          <p>Thanks for your interest in Miniti! Click below to download:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">Download Miniti</a>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours. macOS 14.2+ required.</p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">ianahuja.com/miniti</p>
        </div>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};
```

Create `netlify/functions/verify-download.js`:

```js
const crypto = require("crypto");

exports.handler = async (event) => {
  const { email, expires, token } = event.queryStringParameters || {};

  if (!email || !expires || !token) {
    return {
      statusCode: 400,
      body: htmlPage("Invalid link", "This download link is malformed."),
    };
  }

  if (Date.now() > parseInt(expires, 10)) {
    return {
      statusCode: 410,
      body: htmlPage(
        "Link expired",
        'This link has expired. <a href="/miniti">Request a new one</a>.'
      ),
    };
  }

  const secret = process.env.DOWNLOAD_SECRET;
  const data = `${email}:${expires}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");

  if (token !== expected) {
    return {
      statusCode: 403,
      body: htmlPage("Invalid link", "This download link is not valid."),
    };
  }

  return {
    statusCode: 302,
    headers: { Location: process.env.DOWNLOAD_URL },
  };
};

function htmlPage(title, message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fafafa;}
    .box{text-align:center;padding:40px;}a{color:#000;}</style></head>
    <body><div class="box"><h2>${title}</h2><p>${message}</p></div></body></html>`;
}
```

### 6. Hugo page

Create `content/miniti.md`:

```markdown
---
title: "Miniti"
type: "miniti"
---
```

Create `layouts/miniti/single.html`:

```html
{{ define "main" }}
<div class="miniti-page">
  <h1>Miniti</h1>
  <p>A macOS meeting assistant. Records mic + system audio, live transcription, AI insights.</p>
  <p>Requires macOS 14.2+. Free — 500 minutes/month managed, or bring your own API keys for unlimited.</p>

  <div id="form-section">
    <form id="download-form" name="miniti-download" method="POST" data-netlify="true" netlify-honeypot="hpot-field">
      <p style="display:none"><label><input name="hpot-field" /></label></p>
      <input type="text" name="name" placeholder="name" required minlength="2" />
      <br>
      <input type="email" name="email" placeholder="email" required />
      <br>
      <button type="submit">get download link</button>
    </form>
  </div>

  <div id="success-section" style="display:none;">
    <p>check your email for the download link.</p>
  </div>

  <div id="error-section" style="display:none;">
    <p>something went wrong. try again?</p>
  </div>
</div>

<script>
  const form = document.getElementById('download-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = form.querySelector('[name="name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const honeypot = form.querySelector('[name="hpot-field"]').value;

    if (honeypot) return; // bot

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'sending...';

    try {
      // Submit to Netlify Forms (for records)
      const formData = new URLSearchParams();
      formData.append('form-name', 'miniti-download');
      formData.append('name', name);
      formData.append('email', email);
      await fetch('/', { method: 'POST', body: formData, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      // Trigger the verification email
      const res = await fetch('/.netlify/functions/request-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      if (res.ok) {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('success-section').style.display = 'block';
      } else {
        throw new Error('Request failed');
      }
    } catch (err) {
      document.getElementById('error-section').style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'get download link';
    }
  });
</script>
{{ end }}
```

### 7. Netlify config update

The existing `netlify.toml` has a catch-all redirect that will interfere with the functions. Update it:

```toml
[build]
  publish = "public"
  command = "hugo"
  functions = "netlify/functions"

[context.production.environment]
  HUGO_VERSION = "v0.154.0"
  HUGO_ENV = "production"
  HUGO_ENABLEGITINFO = "true"

# Remove or adjust the catch-all redirect — it's not needed for Hugo
# (Hugo handles routing via generated HTML files)
```

The `/* → /index.html` redirect with status 200 is an SPA pattern that's wrong for a Hugo site anyway — Hugo generates individual HTML files. Remove it. If it was there for a reason, make the functions path an exception:

```toml
[[redirects]]
  from = "/.netlify/functions/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## File structure after implementation

```
ianahuja.com/
├── content/
│   └── miniti.md
├── layouts/
│   └── miniti/
│       └── single.html
├── netlify/
│   └── functions/
│       ├── request-download.js
│       └── verify-download.js
├── netlify.toml  (updated)
├── package.json  (new, for resend dependency)
└── ... existing files
```

## Email records

All verified-interest emails show up in two places:
- **Netlify Forms dashboard** → "miniti-download" form (name + email, easy CSV export)
- **Resend dashboard** → delivery logs (sent/opened/clicked analytics)

## Updating the download

When you ship a new version:
1. Create a new GitHub Release with the updated `.dmg.zip`
2. Update `DOWNLOAD_URL` in Netlify env vars to point to the new asset
3. That's it — no code changes needed

## Alternative: Proton Drive

Not recommended for this. Proton Drive has no API — you'd need to manually generate share links and can't automate token-based access. Fine for personal file sharing, not for a gated download flow.

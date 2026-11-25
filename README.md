# ClipViet.live — Video Streaming Platform

## GitHub Pages deployment (the only publishing target)

The public site is the static website in `site/`. The only production publishing workflow is `.github/workflows/deploy-clipviet-pages.yml`, which uploads **only** `site/` to GitHub Pages. It runs after approved changes reach `main` and on a six-hour schedule.

AppleCMS source configuration and static catalog generation live in `scripts/sync-pages-catalog.mjs`. GitHub Actions fetches source JSON, writes `site/data/catalog.json` into the Pages artifact, and never commits the generated catalog or source media into Git. The browser reads that static JSON; HLS/MP4 is delivered directly from the source CDN.

The repository's legacy Next.js Pages, duplicate Pages and Google Cloud/GKE deployment workflows are disabled. No Netlify, Vercel, Cloudflare Worker or separate application deployment is used for this GitHub Pages rollout. GitHub Pages cannot run server-side API routes or safely store browser-visible credentials; the five listed AppleCMS endpoints are configured as anonymous JSON sources in the supplied integration specification.

ClipViet.live is a Vietnamese streaming catalogue built with Next.js App Router, React and Tailwind CSS. The canonical domain configured for the application is https://clipviet.live.

## Features
- Dynamic video feed through internal `GET /api/videos`
- Provider response normalization (array, `results`, `data`, or `videos`)
- Search, category filtering, featured title and dynamic detail routes
- HTML5 playback for direct HTTPS media URLs
- Iframe playback only for HTTPS hosts explicitly allowlisted
- Browser feed refresh every five minutes; provider cache for 60 seconds
- Demo catalogue fallback when no provider endpoint is configured
- 18+ self-attestation gate; this is not identity or age verification

## Local development
Requires Node.js 20.9+.
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## Configure a provider
Set these variables in `.env.local` or Vercel Project Settings → Environment Variables:
- `VIDEO_PROVIDER_API_URL`: HTTPS JSON endpoint owned by, or contractually provided to, your project.
- `VIDEO_PROVIDER_API_KEY`: optional bearer token.
- `VIDEO_EMBED_ALLOWED_HOSTS`: comma-separated hostnames authorized to serve iframe players.

The provider may return a JSON array or an object containing `results`, `data`, or `videos`. Each item should include `id` (or `video_id`/`slug`), `title`, and optional `description`, `category`, `year`, `duration`, `rating`, `views`, `poster`/`thumbnail_url`, `backdrop`, `videoUrl`/`video_url`, and `embedUrl`/`embed_url`.

Only HTTPS media URLs are accepted. Iframe URLs are ignored unless their hostname matches `VIDEO_EMBED_ALLOWED_HOSTS`. Keep API credentials private; never commit real secrets. Only ingest and stream content you own or are licensed to distribute, with documented consent and appropriate adult-content safeguards.

## Domain and branding
- Brand / project name: **ClipViet.live**
- Canonical domain: `https://clipviet.live`
- Brand logo: `public/clipviet-logo.svg`
- App icon: `app/icon.svg`

The repository rebrand does not change DNS, registrar settings, Vercel project domains, or production deployment configuration. Connect the domain in the hosting dashboard only after confirming ownership and the intended hosting target.

## API
- `GET /api/videos` returns the normalized feed.
- `GET /api/videos?id=<video-id>` returns one video or 404.

Provider responses are cached for 60 seconds. The browser refreshes the feed every five minutes.

## OCodeJS Admin Control

A read-only monitoring workspace is available at `/admin/ocodejs`. Configure `OCODEJS_API_BASE_URL` and `OCODEJS_API_TOKEN` as server-side hosting secrets, plus the existing `ADMIN_CMS_TOKEN`. See [the integration roadmap](docs/OCODEJS-ADMIN-ROADMAP.md) for rollout boundaries and remaining backend verification.

## Clipform video suggestions

The community video-suggestion form is hosted in Clipform:
- Public form: https://clipform.io/3d76a8c57
- Responses dashboard: https://app.clipform.io/ce617e6d-4c43-475b-9c9d-d7ee953e3181/forms/3c0b50ba-72f3-426e-a489-36325e012907/responses
- Embedded on the static and Next.js homepages and Admin screens.
- Suggestions are reviewed manually. Submission does not grant distribution rights and does not publish or ingest media automatically.

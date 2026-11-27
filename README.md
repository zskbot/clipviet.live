# ClipViet.live — Video Streaming Platform

## Repository and deployment architecture

GitHub is the source-code and documentation repository only. It is not the application runtime or production hosting platform. Application hosting and APIs run on external infrastructure.

- **Source repository:** `zskbot/clipviet.live`
- **Static application:** `site/`
- **Application hosting:** Cloudflare Pages
- **API, authentication and catalog services:** Cloudflare Workers
- **GitHub Pages:** documentation only; do not use it to publish the application
- **Preview project:** `clipviet-live-independent-preview`
- **Preview branch:** `preview/cloudflare-independent`
- **Production safety:** Preview project has production deployments disabled and no custom domain attached

The independent Preview project must remain isolated from the existing `clipviet-live-preview` project and the `clipviet.live` custom domain. Do not change DNS, enable production deployment, or migrate a production domain without explicit approval. GitHub Actions may run source checks, but must not be used as the application deployment platform.

See [Cloudflare Pages Preview deployment notes](docs/deployment/cloudflare-pages-preview.md).

## Features

- Dynamic video catalog through five server-configured AppleCMS Worker APIs
- Multi-source pagination and per-video live playback detail resolution
- Provider response normalization (array, `results`, `data`, or `videos`)
- Search, category filtering, featured title and dynamic detail routes
- HTML5 playback for direct HTTPS media URLs
- Iframe playback only for HTTPS hosts explicitly allowlisted
- Browser feed refresh and API-side caching
- Openly licensed demo catalogue fallback when no provider endpoint is available
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

Set secrets in the relevant Cloudflare Pages Preview environment, never in Git or browser-visible source. The homepage AppleCMS adapter reads these server-side variables only:

- `APPLECMS_SOUAVZY_URL`
- `APPLECMS_APIYUTU_URL`
- `APPLECMS_LBAPI9_URL`
- `APPLECMS_SLAPIBF_URL`
- `APPLECMS_JIPINVIP1_URL`

Each value must be the HTTPS base URL of an AppleCMS-compatible API endpoint authorized for use by ClipViet. All five are currently required to reproduce the full multi-source catalog; unset sources are skipped and reported. The API requests `ac=list` for catalog pages and `ac=detail&ids=<vod_id>` for playback details. Playback URLs are parsed from `vod_play_from` / `vod_play_url` and only HTTPS URLs are accepted.
- `VIDEO_PROVIDER_API_URL`: HTTPS JSON endpoint owned by, or contractually provided to, the project.
- `VIDEO_PROVIDER_API_KEY`: optional bearer token.
- `VIDEO_EMBED_ALLOWED_HOSTS`: comma-separated hostnames authorized to serve iframe players.

The provider may return a JSON array or an object containing `results`, `data`, or `videos`. Each item should include `id` (or `video_id`/`slug`), `title`, and optional `description`, `category`, `year`, `duration`, `rating`, `views`, `poster`/`thumbnail_url`, `backdrop`, `videoUrl`/`video_url`, and `embedUrl`/`embed_url`.

Only HTTPS media URLs are accepted. Iframe URLs are ignored unless their hostname matches `VIDEO_EMBED_ALLOWED_HOSTS`. Keep API credentials private; never commit real secrets. Only ingest and stream content you own or are licensed to distribute, with documented consent and appropriate adult-content safeguards.

## Domain and branding

- Brand / project name: **ClipViet.live**
- Intended canonical domain: `https://clipviet.live`
- Brand logo: `site/clipviet-logo.svg`

This Preview setup does not change DNS, registrar settings, custom domains, or production deployment configuration.

## API

- `GET /api/videos` returns the normalized feed.
- `GET /api/videos?id=<video-id>` returns one video or 404.

Provider responses are cached by the API service. Keep browser requests read-only and do not expose provider credentials.

## OCodeJS Admin Control

A read-only monitoring workspace is available at `/admin/ocodejs`. Configure `OCODEJS_API_BASE_URL` and `OCODEJS_API_TOKEN` as server-side hosting secrets, plus the existing `ADMIN_CMS_TOKEN`. See [the integration roadmap](docs/OCODEJS-ADMIN-ROADMAP.md) for rollout boundaries and remaining backend verification.

## Clipform video suggestions

The community video-suggestion form is hosted in Clipform:
- Public form: https://clipform.io/3d76a8c57
- Responses dashboard: https://app.clipform.io/ce617e6d-4c43-475b-9c9d-d7ee953e3181/forms/3c0b50ba-72f3-426e-a489-36325e012907/responses
- Suggestions are reviewed manually. Submission does not grant distribution rights and does not publish or ingest media automatically.

# Cloudflare Preview — Admin Video API

This branch exists only to validate the current Next.js application through the existing Cloudflare Workers Preview pipeline.

## Scope
- Preview branch: `preview/cloudflare-admin-video-player`
- Worker: `clipviet-live`
- Build command configured in Cloudflare: `npm run build`
- Preview command configured in Cloudflare: `npx wrangler preview`
- Production branch remains `main`; this branch must create a Worker Preview, not deploy Production.

## Admin API player
The `/admin` page includes an API URL player. It supports HTTPS JSON endpoints that return an array or an object with `results`, `videos`, or `data` arrays, optional ephemeral Bearer token input, and direct HTTPS media URLs.

Browser-side API calls require the API provider to allow CORS from the Preview origin. The UI does not store the token in localStorage or repository files. Use only APIs and media that the site owner is authorized to access and distribute.

## Safety
- Do not change DNS or registrar nameservers.
- Do not attach `clipviet.live` as a custom domain.
- Do not merge this branch or promote the Preview to Production.
- Do not provision paid resources or persistent storage.

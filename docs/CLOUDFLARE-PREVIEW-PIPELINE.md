# Cloudflare Preview pipeline

This branch exists to validate the isolated Cloudflare Workers Preview build for ClipViet.

- Production branch remains `main`.
- This branch must deploy only to a Workers Preview URL.
- Do not bind production data or publish a custom domain from this Preview.
- Validate `/admin` authentication and API URL playback (JSON, MP4, HLS) before any domain migration.

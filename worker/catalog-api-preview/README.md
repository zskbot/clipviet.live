# ClipViet Catalog API — Preview

Read-only Cloudflare Worker API for the ClipViet Pages Preview.

## Routes

- `GET /health`
- `GET /api/providers`
- `GET /api/catalog/categories[?sourceId=...]`
- `GET /api/catalog/videos?page=1[&sourceId=...][&categoryId=...][&keyword=...]`
- `GET /api/providers/{sourceId}/categories`
- `GET /api/providers/{sourceId}/videos?page=1`
- `GET /api/providers/{sourceId}/videos/{videoId}`

## Security

- Read-only GET endpoints and CORS restricted to explicit Preview origins.
- No generic upstream URL, download, stream proxy, or relay endpoint.
- Provider IDs and upstream hosts are fixed in `worker/telegram-api/src/applecms.js`.
- Keep this Worker separate from Telegram publishing/authentication and editorial catalog credentials.
- This Worker is Preview-only; do not attach a production route or custom domain.

## Deploy

Use the Cloudflare account's Preview Worker `clipviet-catalog-api-preview`. Configure the non-secret variables from `wrangler.example.toml` only for the Preview environment. Never add Telegram tokens, session secrets, or API credentials to this Worker.

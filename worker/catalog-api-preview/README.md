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


## Optional Admin authentication (Preview)

The public Admin page is viewable without signing in. Management panels and the Clipform responses link remain locked until an Admin session is verified.

Configure these as **Worker Secrets** (never as plain-text vars and never in Git):
- `ADMIN_PASSWORD`: the Admin password chosen by the owner.
- `ADMIN_SESSION_SECRET`: a unique random secret of at least 32 bytes.

The Worker uses a signed, 4-hour bearer session. The browser keeps the session token in `sessionStorage`, not localStorage or a cookie. `POST /api/admin/login`, `GET /api/admin/session`, and `POST /api/admin/logout` are available. All other `/api/admin/*` routes fail closed unless a valid session is supplied; no content-write endpoint is enabled by this change.

The current static Admin has no persistent article/CMS editing API. This change gates the existing management tools and establishes the authenticated API boundary; article CRUD must be implemented separately against an approved persistent store before claiming that article edits are saved.

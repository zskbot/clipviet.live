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


## Persistent CMS (Preview)

The authenticated CMS stores article records in Cloudflare D1. Apply the SQL migration in `migrations/0001_create_articles.sql` to the Preview database before enabling the CMS UI.

### D1 binding

Bind the Preview database to the Worker as `DB`. The CMS supports:
- Public read-only: `GET /api/public/articles` and `GET /api/public/articles?slug=...` (published articles only).
- Admin-only: `GET/POST /api/admin/articles`, `PUT/DELETE /api/admin/articles/{id}`.
- Fields: title, slug, excerpt, body, draft/published status, created/updated/published timestamps.
- Maximum content size: 50 KB; list APIs are capped to 100 public / 200 Admin records.

Do not bind a Production database to this Preview Worker. Do not apply migrations to Production. The Admin page renders article text as text (not executable HTML).


### Live Preview resource status
- Cloudflare D1 Preview database: `clipviet-cms-preview` (`1e613e7b-5aa3-4927-bf78-552f383c9dce`, APAC).
- Migration `0001_create_articles.sql` has been applied and the table/indexes verified.
- Worker Preview has the `DB` binding. Admin secrets remain intentionally unconfigured until entered as Cloudflare Worker Secrets by the account owner.



## Admin PIN authentication (Preview)

The Admin page is available at `/admin/`. Management tools remain locked until a six-digit PIN is verified by the Worker.

Configure these as Cloudflare Worker Secrets on `clipviet-catalog-api-preview`:
- `ADMIN_PIN`: exactly six digits. The initial owner-selected value is set outside Git as a Worker Secret.
- `ADMIN_SESSION_SECRET`: unique random secret of at least 32 bytes.

The Worker issues a signed 4-hour bearer session. The six-digit PIN is never embedded in the static site or repository. The browser stores it in `sessionStorage`. The login endpoint applies a best-effort per-isolate limit of five failed attempts followed by a 15-minute cooldown; configure Cloudflare edge rate limiting for durable distributed enforcement before Production use. Never commit the PIN or signing secret.

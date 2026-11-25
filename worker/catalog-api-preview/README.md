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



## Cloudflare Access authentication (Preview)

The Admin workspace has no application PIN, password form, local bearer token, or app-level logout control. Preview requests are protected by a Cloudflare Access self-hosted application:

- Access application: `ClipViet.live Admin Preview — Cloudflare Access`
- Application ID: `415c240a-5a41-48f5-ada5-28cbdef4f513`
- Audience: `3df3c80811b8acd91282d0d7a68e7eefc1a74ccba3fcabf4d2d04406d3833d81`
- Protected hostname pattern: `*.clipviet-live-independent-preview.pages.dev`
- Access policy: `ClipViet Provider Registry Preview Admin` identity group with MFA required (TOTP, security key, or biometrics).
- Allowed owner identities are defined in that Cloudflare Access group, not in browser code.

The Pages Function forwards only the signed `Cf-Access-Jwt-Assertion` header to this Worker. The Worker independently verifies RS256 signature against the configured Cloudflare Access JWKS, exact issuer, application audience, expiry/not-before, and the `ADMIN_EMAILS` allowlist. The server fails closed if any Access setting is missing or invalid. Every `/api/admin/*` request is covered by the same authorization gate before route dispatch; CORS and UI state are not treated as authentication.

Preview Worker variables (non-secret):
- `ACCESS_TEAM_DOMAIN=dark-snow-8a68.cloudflareaccess.com`
- `ACCESS_AUD=3df3c80811b8acd91282d0d7a68e7eefc1a74ccba3fcabf4d2d04406d3833d81`
- `ADMIN_EMAILS=huynhthuongg2505@gmail.com,huynhthuongg25052002@gmail.com`

Legacy `/api/admin/login` and `/api/admin/logout` routes are removed. The old `ADMIN_PIN` and `ADMIN_SESSION_SECRET` Worker Secrets are obsolete and should be deleted from this Preview Worker after the Access-backed code is deployed and verified. Do not delete or change secrets on any other Worker. No Production Worker or database is modified.

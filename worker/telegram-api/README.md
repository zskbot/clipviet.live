# ClipViet Cloudflare Worker API

Server-side API for ClipViet.live. The Worker handles Telegram authentication, channel publishing, the editorial video catalog, and AppleCMS V10 provider adapters. Never commit Telegram tokens, session secrets, user IDs, or production credentials.

## AppleCMS V10 providers

The provider adapter implements one shared AppleCMS V10 contract for five source endpoints. Provider URLs are non-secret Worker variables and must match the exact approved host and path.

| ID | Role | Worker variable | Expected host |
|---|---|---|---|
| souavzy | Primary | APPLECMS_SOUAVZY_URL | api.souavzy.vip |
| apiyutu | Backup 1 | APPLECMS_APIYUTU_URL | apiyutu.com |
| lbapi9 | Backup 2 | APPLECMS_LBAPI9_URL | lbapi9.com |
| slapibf | Backup 3 | APPLECMS_SLAPIBF_URL | slapibf.com |
| jipinvip1 | Backup 4 | APPLECMS_JIPINVIP1_URL | jipinvip1.com |

Each value must be the HTTPS base path `https://<approved-host>/api.php/provide/vod/`. The Worker validates scheme, hostname, path, and absence of embedded credentials/query strings before using it. Three endpoints found unavailable in the supplied probe report (douapi.cc, ddapi.cc, zy.xiaomaomi.cc) are not configured.

The supplied integration report records these source totals at probe time: souavzy 130,740; apiyutu 228,064; lbapi9 340,304; slapibf 265,410; jipinvip1 74,701. These are historical probe figures, not live totals. Run the protected health endpoint to refresh current API status.

### Provider routes

- `GET /api/providers` — provider IDs, roles, protocol, and whether each URL variable is configured.
- `GET /api/catalog/categories[?sourceId=souavzy]` — leaf categories; default behavior tries primary then backups.
- `GET /api/catalog/videos?page=1[&sourceId=souavzy][&categoryId=67][&keyword=...]` — paginated video list. If sourceId is omitted, upstream failures trigger ordered failover. A category-filtered request does not fail over because category IDs are source-specific. Empty results are valid and do not trigger failover.
- `GET /api/providers/{sourceId}/categories` — categories for a specific source.
- `GET /api/providers/{sourceId}/videos?page=1[&categoryId=...][&keyword=...]` — source-specific list.
- `GET /api/providers/{sourceId}/videos/{vodId}` — detail and parsed playback lines.
- `GET /api/providers/health` — Telegram-admin-only active API probe across configured sources. It verifies categories, page-one metadata, pagination, and presence of playback URLs. It does not prove a real browser playback session.

### AppleCMS request and mapping contract

- `ac=list` is used only for `class[]`; categories with children are filtered out, leaving leaf categories based on `type_pid`.
- `ac=detail&pg=N` retrieves video list data; optional `t` filters by category, `wd` searches, and `ids` retrieves a detail record.
- The adapter sends a browser-like User-Agent and `Accept: application/json`, uses a 15-second timeout, retries once after 500 ms, caches JSON responses for 60 seconds, and serializes requests with a minimum 200 ms gap per Worker isolate.
- `limit`, `pagecount`, `page`, and `total` are read from each response. Never assume all providers return 20 items per page.
- Internal identity is `{sourceId}:{vod_id}` to prevent collisions between provider catalogs.
- Important field mappings include `vod_name → title`, `vod_pic → poster`, `vod_year → year`, `vod_area → area`, `vod_actor → actors`, `vod_director → director`, `vod_content → description` with `vod_blurb` fallback, `vod_time → updatedAt`, and `vod_play_url → lines`.
- Playback parsing is strictly `$$$` (line) → `#` (episode) → `lastIndexOf("$")` (episode name and URL). Do not replace lastIndexOf with indexOf.
- Only HTTPS episode URLs without embedded username/password are exposed to the player.

### Playback topology

- Browser → Worker: JSON catalog and detail requests, avoiding upstream CORS restrictions.
- Browser → source CDN: HLS manifest and TS segments directly. The Worker does not proxy or relay video bytes.
- iPhone/iPad: native HLS. Desktop: HLS.js 1.5.18 when Media Source Extensions are supported.
- Player destroys the previous HLS instance when switching episodes or leaving the page; a 12-second readiness watchdog offers line switching and an external link.
- API health is not a playback guarantee. Acceptance requires a real browser test with `readyState >= 2` and `videoWidth > 0`, including mobile Safari.

## Existing Telegram and catalog routes

- GET /health
- POST /auth/telegram
- GET /auth/me
- POST /auth/logout
- GET /channel/verify
- POST /channel/publish
- GET /api/v1/videos
- GET /api/v1/videos/{id}
- GET /api/v1/admin/videos
- POST /api/v1/admin/videos
- DELETE /api/v1/admin/videos/{id}

## Cloudflare configuration

Worker Secrets:
- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET` (random, at least 32 characters)

Non-secret Worker variables:
- `ALLOWED_ORIGIN=https://clipviet.live`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_ID`
- `TELEGRAM_CHANNEL_ID`
- `TELEGRAM_ALLOWED_USER_IDS`
- `MEDIA_HOST_ALLOWLIST` (for Telegram sendVideo)
- `VIDEO_MEDIA_HOSTS` (for editorial catalog media and posters)
- `APPLECMS_SOUAVZY_URL`
- `APPLECMS_APIYUTU_URL`
- `APPLECMS_LBAPI9_URL`
- `APPLECMS_SLAPIBF_URL`
- `APPLECMS_JIPINVIP1_URL`

KV bindings:
- `LOGIN_REPLAY` — Telegram login replay protection.
- `VIDEO_CATALOG` — separately managed editorial catalog.

The AppleCMS adapters do not require KV for provider catalogs; they fetch JSON on demand and use the Worker Cache API for short-lived response caching. Do not reuse KV namespaces from unrelated projects.

## Security and rollout

- Provider base URLs are fixed to the five approved HTTPS hostnames and the AppleCMS path; requests cannot supply arbitrary upstream URLs.
- Video playlists and segments are returned as direct HTTPS URLs; no generic proxy, scraping, download, or stream relay route exists.
- Admin source health requires the signed Telegram session and Telegram user allowlist.
- Public provider browsing is read-only.
- Rate limiting should also be configured at Cloudflare edge before public traffic is scaled; the per-isolate request queue is a best-effort upstream courtesy throttle, not a global rate limiter.
- The source probe report records permission confirmation from the site operator. Provider API health and real playback still need re-verification before production rollout.

No Cloudflare Worker deployment, DNS change, billing action, merge, or Production change is performed by this source-only branch.

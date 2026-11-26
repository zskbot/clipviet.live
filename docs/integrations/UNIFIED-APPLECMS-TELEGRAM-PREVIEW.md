# Unified ClipViet Preview integration — 2026-11-26

## Branch boundary
Based on preview/unified-api-compat-2026-11-26. Preview source only. No main, Production,
DNS, domains, Netlify, Supabase, existing storage or existing Workers are modified.

## File-by-file disposition

| Source | Reuse decision | Required conversion / blocker |
|---|---|---|
| zskbot/clipviet/worker/telegram-api/src/applecms.js | Reuse provider IDs, exact host allowlist, AppleCMS V10 query contract and metadata mapping. | Original includes isolate-local throttling, retries, playlist parsing and playback URLs. New module uses Workers fetch, caches.default, AbortSignal.timeout, env bindings and strips playback URLs. |
| zskbot/clipviet/worker/telegram-api/src/index.js | Reuse only isolated Telegram webhook/auth concepts after review. | Separate Telegram admin API with cookies, Telegram login, KV and admin controls; not the public catalog gateway. |
| zskbot/clipviet/lib/legal-video-providers.js | Reuse normalized metadata mapping concepts only. | Uses process.env and Node/Next fetch options; needs Worker env bindings and provider-specific authorization. |
| zskbot/clipviet/lib/telegram-importer.js | Reuse rights checklist and metadata schema as reference only. | Not directly portable: process.env, Buffer, Supabase REST/storage, 20 MB Bot API download cap and cleanup path. Supabase is excluded from this Preview. A future Cloudflare implementation needs dedicated R2 + D1/KV, webhook authentication, size limits and independently verified source rights. |
| zskbot/clipviet/lib/provider-rights-gate.mjs | Reuse deny-by-default provider/video split. | Existing default reads process.env; Worker-native checks are implemented in _lib/applecms-worker.js. |
| Provider Registry backend | Reuse review workflow design, not runtime approval state yet. | Separate D1 Worker; no authenticated read-only contract, service identity or binding to this Pages project verified. Do not infer rights from branch-local JSON. |

## Added Cloudflare-compatible path
- functions/_lib/applecms-worker.js: AppleCMS V10 adapter, exact HTTPS host/path allowlist, bounded query inputs, timeout, redirect rejection, Cache API, provider-level and per-video metadata rights checks.
- functions/api/providers/applecms.js: read endpoint and provider status view.
- Metadata only. AppleCMS playlist and playback URLs are stripped.
- Missing, malformed, expired or incomplete rights records deny access.

## Worker environment contract
Configure only in an isolated Preview Worker after review; never commit values:
- APPLECMS_SOUAVZY_URL
- APPLECMS_APIYUTU_URL
- APPLECMS_LBAPI9_URL
- APPLECMS_SLAPIBF_URL
- APPLECMS_JIPINVIP1_URL
- VIDEO_PROVIDER_RIGHTS_JSON
- VIDEO_VIDEO_RIGHTS_JSON

AppleCMS URL values must be exact HTTPS API roots:
https://<approved-host>/api.php/provide/vod/
Rights JSON must satisfy the checks in the Worker module. Do not configure until evidence is independently reviewed.

## Current limitations / acceptance gates
1. Provider Registry is not cryptographically connected to this API. Worker env rights records are a temporary integration seam, not a substitute for Registry technical/legal review. Do not enable live providers until a signed, authenticated Registry read contract is implemented and tested.
2. No AppleCMS endpoint reachability or credentials were tested.
3. Telegram importer is not ported; original requires Supabase and Node APIs. No Telegram bot token, channel, D1 database or R2 bucket was configured.
4. No playback endpoint is enabled. official_embed, owner_hosted_stream and redistribution require separate per-video authorization and a dedicated resolver.
5. Add unit and Worker integration tests before Preview deployment. Verify unauthorized, expired, malformed, unapproved, redirecting and non-HTTPS providers are denied.
6. Deploy only to a separately named Cloudflare Preview Worker/Pages project after no-cost resource checks and explicit deployment approval.

## Validation status
Source integration only. No secrets configured, no external provider requests made, no data migrated,
no CI run, no Preview deployment and no Production changes.

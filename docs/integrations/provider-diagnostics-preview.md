# Provider Diagnostics + Rights Ledger (Preview only)

## What this adds
- A dedicated D1 migration creates an append-only diagnostic run table and seeds the five configured AppleCMS providers as `PENDING`.
- Seed records contain only known API endpoints and exact API hostnames. `media_hosts_json` is intentionally `[]`; rights holder, license reference, evidence URL and expiry are intentionally blank. No CDN host, media URL or license is fabricated.
- Authenticated technical/admin routes run and read diagnostics. Diagnostic results are stored with timestamp and immutable run ID.
- The provider state transition to `VERIFIED` now requires a persisted diagnostic run with status `PASS` for that exact provider and run ID.
- Existing legal rights and per-clip rights routes remain separate. Technical API health never implies permission to display, embed, stream or redistribute.

## Routes (dedicated Preview Worker only)
- `GET /providers` — list provider records and state.
- `POST /providers/:providerId/diagnostics/run` — technical/admin only; probe the fixed provider API endpoint.
- `GET /providers/:providerId/diagnostics` — list last 20 diagnostic runs.
- `GET /providers/:providerId/content-rights` and existing POST/approve/revoke routes — per-clip rights ledger.
- `GET /audit` — admin-only append-only audit log.

## Diagnostic behavior
- API fetch is restricted to the five exact configured API hostnames; HTTPS only, no userinfo/port, redirects rejected, 10-second timeout, response body capped at 1 MiB.
- Tests HTTP status, JSON parse, AppleCMS `code=1` and `list[]`, pagination metadata, and presence of core video metadata fields.
- Extracts candidate media hostnames from `vod_play_url` without returning full media URLs.
- A media request with `Range: bytes=0-0` and MIME inspection is attempted only if its exact hostname is already in that provider's explicit media host allowlist. The seeded allowlists are empty, so these checks correctly remain `UNVERIFIED`; arbitrary or wildcard hosts are never probed.
- Diagnostic states: `PASS`, `FAIL`, `UNVERIFIED`. Network/DNS/redirect errors are not mislabeled as provider outages.
- A `PASS` run is a technical gate only. It does not create or approve any rights record.

## Migration and deployment boundary
1. Apply migrations `0001_init.sql`, `0003_content_rights_gate.sql`, then `0004_provider_diagnostics_seed.sql` to a **new dedicated Preview-only D1 database**. Apply any existing intervening migration in its documented order if present.
2. Bind only that database as `PROVIDER_DB` on the separately named `clipviet-provider-registry-preview` Worker.
3. Configure Cloudflare Access JWT validation, exact Access group IDs, MFA policy and exact CORS origin before exposing the Worker.
4. Deploy only this Preview Worker after verifying the Cloudflare account remains on a no-payment Free plan. Do not bind any existing production database and do not deploy `clipviet-live`.
5. Production remains locked until technical and legal gates are independently complete.

## Current blockers
- No CDN media host allowlists are populated.
- No provider rights documents or per-clip licenses are recorded.
- DNS/network reachability may be unavailable from the execution environment; such outcomes remain `UNVERIFIED`.

## Pages Preview routing
- Exact branch: `preview/playback-api-diagnostics-20261127`.
- This branch is enabled in the Cloudflare Pages Preview branch allowlist for the independent Preview project.
- Production deployments remain disabled; no DNS or custom-domain changes are part of this Preview.

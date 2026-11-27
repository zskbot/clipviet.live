# Provider Preview Admin Console

The dedicated Preview Worker serves a mobile-first, same-origin admin console at `/admin` and a read-only health endpoint at `/health`.

## Routes
- `GET /admin` — Cloudflare Access-protected diagnostics console for iPhone and desktop.
- `GET /health` — Access-protected service and D1 health summary (provider count, diagnostic run count, provider-state counts).
- `GET /providers` — existing provider registry list.
- `GET /metadata-intakes` — admin/legal-only, read-only list of the latest 100 public metadata submissions, including evidence references and review status. It cannot approve or mutate any record.
- `POST /providers/:providerId/diagnostics/run` — technical/admin diagnostic action.
- `GET /providers/:providerId/diagnostics` — last 20 persisted diagnostic runs.

The UI uses same-origin requests and no third-party scripts, stylesheets, fonts or analytics. All controls use square corners. It is served from the dedicated Preview Worker, not the static GitHub Pages site, so it does not depend on a Next.js route being published.

## Safety boundary
- Cloudflare Access protects the console, health endpoint and API.
- Metadata intake submissions are visible only to authenticated `admin` or `legal` roles; technical-only roles receive HTTP 403.
- The review queue is read-only. A submission remains `PENDING_REVIEW` until the independent legal/technical workflow is completed.
- Health is read-only. Diagnostic runs contact only the fixed API hostnames and persist diagnostic results in the dedicated Preview D1.
- Diagnostic PASS is not a rights approval and does not enable playback.
- All five seeded providers remain `PENDING`; media host allowlists remain empty.
- No Production Worker, Production Pages deployment, DNS record or rollback target is changed.

# ClipViet Provider Registry — isolated Preview backend

## Architecture
This Worker is a separate Preview-only API backed by Cloudflare D1. It is not the existing `clipviet-live` Worker and does not modify the public site, production Worker, DNS, or existing video feeds.

- `POST /providers`: Admin creates a provider in `PENDING`.
- `GET /providers`: Admin, technical reviewer, or legal reviewer lists providers.
- `PATCH /providers/:id/transition`: role-gated state transition.
- `GET /audit`: Admin-only audit log.

## State machine
- `PENDING → VERIFIED`: technical reviewer token; requires API reachability, schema validation, media probe, redirect rejection, exact-host allowlist and a test-run reference.
- `VERIFIED → APPROVED`: legal reviewer token; requires distribution-rights review, age/consent review and a legal review reference.
- `APPROVED → ENABLED`: admin token only; backend rechecks license expiry.
- No direct transition, deletion, auto-activation or provider execution is implemented.

The review evidence fields are reviewer attestations. They are not proof by themselves: the technical and legal review procedures must be completed and their evidence retained outside this registry.

## Security
- The Worker rejects all requests unless `REGISTRY_ENV=preview` and the request host matches the dedicated `clipviet-provider-registry-preview.*.workers.dev` hostname.
- Admin access requires a Cloudflare Access JWT in `Cf-Access-Jwt-Assertion`, validated by signature against the team-domain JWKS, exact issuer, configured audience, expiry and not-before claims. Admin/Technical/Legal roles map to Access group IDs. Technical and Legal may additionally use separate service bearer tokens; there is no Admin bearer-token fallback.
- Enforce MFA in the Cloudflare Access application policy for every Admin group member. The Worker validates identity and group membership; the Access policy is responsible for MFA enforcement and must be reviewed before deployment. This is service-token authentication, not SSO/MFA; do not expose the Worker to browser users until Cloudflare Access (with MFA enforced) or an equivalent verified identity layer is implemented.
- Browser requests with an Origin header are rejected unless the exact origin is listed in CORS_ALLOWED_ORIGINS. CORS is not authentication; non-browser clients still require a role token.
- Request body size is capped at 16 KiB; malformed JSON is a 400, oversized input is a 413, and unexpected backend errors return a generic 500 without leaking internal exception text.
- API credentials must be strings no longer than 4096 characters. Invalid credential types and oversized values are rejected rather than silently truncated.
- Optional provider API credentials use AES-256-GCM envelope format `v1:kid:iv:ciphertext`, with provider-specific additional authenticated data. Supply `REGISTRY_ENCRYPTION_KEYS` as a Worker secret containing JSON `{ "activeKid": "k2", "keys": { "k1": "BASE64_OLD_32_BYTE_KEY", "k2": "BASE64_NEW_32_BYTE_KEY" } }`. Keep old keys until every row has been rotated and verified. The API never returns ciphertext or plaintext. URL query parameters commonly used for secrets are rejected.
- Admin-only `POST /maintenance/rotate-credentials` rotates at most 25 records per call and returns a cursor. Continue with `{ "afterId": "<nextCursor>" }` until `complete:true`. Each changed record and batch is audited. Keep the old key in the ring during migration; remove it only after a full backup/restore test and verification that no ciphertext uses the old key. Legacy PR #48 ciphertext can be decrypted with `REGISTRY_ENCRYPTION_KEY` during the migration window.
- Provider API/media hosts must be exact valid DNS hostnames; HTTP, userinfo, custom ports, IP literals and local hostnames are rejected.
- No provider API fetch, scraping, stream proxy or media download is performed by this registry. Optional API credentials are stored only as AES-GCM ciphertext; this is not a dedicated secret manager and key rotation is not implemented.
- Audit records are append-only through the API and written in the same D1 batch as each state change. The public API has no audit update/delete route.
- D1 uses parameterized statements. Request bodies are capped at 16 KiB. Responses are no-store.
- This branch adds Cloudflare Access JWT validation and versioned key rotation helpers. MFA still must be enforced in the Cloudflare Access policy; robust distributed rate limiting, DNS resolution/IP egress controls, and independent legal verification remain incomplete. Provider API URLs are stored but never fetched by this Worker; therefore DNS rebinding and outbound SSRF protections are still mandatory before any future server-side provider fetch.
- The technical and legal evidence values are submitted by role tokens and recorded as attestations. The backend does not independently prove reachability, media ownership, license authenticity, age/consent, or territorial rights.
- The final APPROVED → ENABLED transition is an administrative state change only. It must remain unavailable operationally until identity/MFA, rate limiting, key rotation, outbound network controls, evidence review and a security test suite have all passed.

## Preview setup
1. Create a dedicated D1 database named `clipviet-provider-registry-preview` on the Cloudflare Free plan only; do not upgrade the account. Cloudflare D1 Free includes up to 10 databases, 5 million rows read/day, 100,000 rows written/day and 5 GB total storage across the account. Stop if the account is on a paid plan and the new database would incur any charge.
2. Apply `migrations/0001_init.sql` to that new database only.
3. Copy `wrangler.example.toml` to `wrangler.toml` and insert the returned database ID. Do not bind any existing production database.
4. Set Worker secrets `REGISTRY_ADMIN_TOKEN`, `REGISTRY_TECH_TOKEN`, `REGISTRY_LEGAL_TOKEN`, and `REGISTRY_ENCRYPTION_KEY` if provider credentials will be stored; set `REGISTRY_ENV=preview`; set `CORS_ALLOWED_ORIGINS` to the exact Preview origin.
5. Deploy only the separately named Preview Worker. Never change or deploy `clipviet-live`.

No database has been provisioned and no Worker has been deployed by this change.

## Preview security acceptance gate

Do not provision a database, set secrets, deploy the Worker, activate a provider, or connect playback until all of the following are verified:
- [ ] Cloudflare account is confirmed to remain on a no-payment Free plan, with sufficient D1 daily and aggregate storage headroom.
- [ ] Dedicated ClipViet-only D1 database is provisioned; no existing project database is reused.
- [ ] Cloudflare Access/SSO JWT is cryptographically validated by the Worker and MFA is enforced by the Access policy.
- [ ] Distributed rate limiting is configured and tested without exceeding the D1 Free write quota.
- [ ] Encryption key identifiers, multi-key decryption and a tested re-encryption/rollback rotation procedure are implemented.
- [ ] Any future outbound fetch resolves and validates every A/AAAA result, blocks private/reserved/loopback/link-local ranges, rejects redirects, and resists DNS rebinding.
- [ ] Technical and legal evidence is independently reviewed and retained; role attestations alone are insufficient.
- [ ] Unit, integration, abuse, authorization, concurrency and migration tests pass on a non-production Preview.
- [ ] Preview hostname and D1 binding are verified; Production resources remain untouched.

Current implementation status: request validation and CORS-origin checks are hardened in this branch. All unchecked items remain blockers. GitHub Actions runner startup failures previously prevented CI evidence; source syntax checks alone are not a passing test suite.

## Required Preview-only secrets and variables

Set only after the no-payment Free account is confirmed and the dedicated Preview Worker is approved for deployment:
- Variables: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_ADMIN_GROUP_ID`, `ACCESS_TECH_GROUP_ID`, `ACCESS_LEGAL_GROUP_ID`, `REGISTRY_ENV=preview`, exact `CORS_ALLOWED_ORIGINS`.
- Secrets: `REGISTRY_TECH_TOKEN`, `REGISTRY_LEGAL_TOKEN`, `REGISTRY_ENCRYPTION_KEYS`; retain `REGISTRY_ENCRYPTION_KEY` temporarily only if migrating legacy ciphertext.
- Cloudflare Access policy: require MFA and restrict the Admin application to the intended Admin group. Do not rely on CORS for authorization.
- Do not place tokens or encryption material in GitHub source, repository variables, frontend code, or chat.

The screenshots supplied for the current mobile site show a legacy unstyled feed with default blue underlined links, excessive vertical spacing and broken/short thumbnail strips. The updated static frontend uses a responsive dark card catalog, compact horizontally scrollable category filters, accessible focus states and reduced-motion handling. It does not scrape or embed the external page shown in the screenshots.

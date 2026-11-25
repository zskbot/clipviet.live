# ClipViet × OCodeJS Admin Suite

## Current implementation

- A dedicated OCodeJS Control page at `/admin/ocodejs`.
- A server-only proxy at `GET /api/admin/ocodejs`, protected by the existing `ADMIN_CMS_TOKEN` guard.
- OCodeJS credentials are read only from server environment variables.
- Monitoring requests are restricted to a fixed GET-only endpoint allowlist:
  - `/health/live`
  - `/health/ready`
  - `/services`
  - `/agents`
  - `/providers`
  - `/runtime/status`
  - `/mcp/connections`
- Response payloads redact values under keys containing token, secret, password, authorization, API key, credential, or cookie.
- Each request has an 8-second timeout, no redirects, no browser exposure of the OCodeJS token, and no-store caching.

## Configure

Set these secrets in the hosting provider's Preview environment:

- `ADMIN_CMS_TOKEN`: existing ClipViet CMS access token.
- `OCODEJS_API_BASE_URL`: defaults to `https://ocodejs.id.vn`.
- `OCODEJS_API_TOKEN`: OCodeJS API credential.

Use the Preview environment first. Do not place credentials in Git, browser storage, query strings, or chat messages.

## Remaining rollout phases

### Phase 1 — API contract and authentication verification
- Verify the current OCodeJS OpenAPI document and authentication scheme against the live staging service.
- Confirm status codes, schemas, pagination, rate limits, and permission scopes for every read endpoint.
- Keep the current monitoring proxy GET-only until the contract is verified.

### Phase 2 — Unified admin security
- Replace the shared static CMS token with individual sessions and server-side RBAC.
- Add roles: owner, administrator, editor, reviewer, and read-only operator.
- Add CSRF protection for cookie-authenticated mutations, session expiry, login throttling, and audit events.
- Never grant privilege changes through natural-language commands without a separate confirmation.

### Phase 3 — Website and content adapters
- Verify the website's actual administration API and authentication mechanism.
- Implement adapters only for documented endpoints and supported operations.
- Add products, posts, categories, menus, media, orders, and reviews only where the connected backend exposes them.
- Preserve the existing ClipViet video catalogue and licensing workflow.

### Phase 4 — Block Studio
- Read and display the actual page/block schema before enabling editing.
- Support draft configuration, validation, preview, version snapshots, undo/redo, and explicit publish confirmation.
- Do not infer CSS selectors or write arbitrary page HTML from the static interface documentation alone.

### Phase 5 — OCodeJS operations
- Add service/agent/provider configuration changes only after API contract and permission verification.
- Require role checks, dry-run previews, explicit confirmation, idempotency keys where supported, and audit records.
- Destructive actions remain disabled until the backend's documented behavior is verified.

### Phase 6 — Release
- Run lint, unit tests, production build, and API security tests.
- Deploy to Preview and verify health, unauthenticated 401, token secrecy, CORS, and read-only behavior.
- Promote to production only after a human review of the Preview deployment.

## Known integration boundary

The previously supplied OCodeJS API documentation endpoint was not consistently retrievable during initial discovery. The endpoint names above are treated as the agreed monitoring surface, not proof that every endpoint is currently enabled or returns a particular schema. This implementation reports per-endpoint failures without pretending that unavailable routes are healthy.

The current ClipViet CMS uses a shared bearer token and Supabase service-role access. That is not yet a user/role system and must not be described as complete RBAC. The existing PHP API uses a separate admin token. These systems must be unified only through a deliberate migration, not by silently changing existing authentication.

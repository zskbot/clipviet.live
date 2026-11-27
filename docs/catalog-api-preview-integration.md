# ClipViet Catalog API Preview integration

## Scope

The isolated Cloudflare Pages Preview frontend uses the read-only Catalog API Worker:

`https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev`

Production hostnames do not use this Preview Worker. The project keeps production deployments disabled.

## Read-only endpoints used by the frontend

- `GET /api/providers` — provider configuration and rights state.
- `GET /api/catalog/categories` — categories from the primary eligible provider, with the Worker’s existing failover behavior.
- `GET /api/catalog/videos?page=1&limit=30` — catalog page, with optional `keyword`, `categoryId`, and `sourceId`.

The Worker also exposes `GET /health` for health checks. Provider-specific routes remain available for category, list, and detail lookups.

## Playback behavior

- The frontend only displays returned catalog metadata; it does not invent demo records.
- A video is playable only when the API returns explicit, verified, unexpired playback approval and a valid HTTPS source.
- HLS/MP4 is loaded directly from the provider host. ClipViet does not proxy, relay, download, or rewrite media.
- The video element may load metadata, but playback starts only after the viewer explicitly presses Play.
- Safari iPhone uses native HLS where supported.

## Rights gate

Provider presence or a returned stream URL does not itself prove distribution rights. Providers and titles without valid metadata/playback authorization remain pending or locked. AdultEmbed remains a separate pending adapter and is not added to the five AppleCMS providers.

## Verification still required

The Preview deployment must be checked against the live Worker for:
- CORS from the generated `.clipviet-live-independent-preview.pages.dev` hostname.
- `/health`, `/api/providers`, categories, and first catalog page.
- Provider counts, page totals, metadata normalization, and pagination.
- Actual permitted HLS/MP4 sources on iPhone Safari after a user-initiated Play action.

No production deployment, DNS change, domain migration, data write, or provider rights approval is performed by this integration.

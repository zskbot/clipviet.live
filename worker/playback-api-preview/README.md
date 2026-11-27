# ClipViet Playback API — Preview

Dedicated read-only Worker for real video playback authorization.

## Endpoint

`GET /api/playback/providers/{providerId}/videos/{videoId}`

Example:

`https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev/api/playback/providers/souavzy/videos/12345`

A successful response returns the approved source lines and a short rights expiry. The endpoint does not proxy, download, store, or redistribute media bytes.

## Fail-closed requirements

A direct stream is returned only when all conditions are satisfied:

- Provider status is APPROVED or ENABLED and its provider-level license is valid.
- Connector status is APPROVED with playback mode `owner_hosted_stream`.
- The individual video rights record is APPROVED and unexpired.
- The licensed use includes `owner_hosted_stream` or `redistribute`.
- Source, ownership, performer-age and performer-consent verification flags are all set.
- Both content and connector region lists include the request country or GLOBAL.
- The evidence URLs are HTTPS and the provider has an explicit media-host allowlist.
- Every returned media URL is HTTPS and matches that allowlist.

The Worker returns 403 with a stable `code` when any requirement is not met. It never falls back to a sample or guessed URL. The catalog/metadata endpoints remain separate and never expose playback lines.

## Preview configuration

`wrangler.toml` binds only the Preview D1 database `clipviet-provider-registry-preview`. Do not bind a Production database, add a custom domain, or attach a Production route.

## Playback/CORS note

The upstream media host must permit browser playback from the Preview Pages origins. HLS.js requires CORS on manifests and segments; native Safari playback still depends on a valid media URL and supported stream format.

# AdultEmbed adapter — Preview integration

## Status

- Provider: `adultembed`
- API base supplied by the project: `https://adultembed.com/api/v1`
- Public documentation advertises `/search`, `/videos/{id}`, `/videos/{id}/related`, `/videos/{id}/status`, and `/categories`.
- OpenAPI document currently declares a different server URL (`https://pornalizer.app/api/v1`). Do not silently rewrite the base URL or treat the two hosts as interchangeable. The adapter is pinned to the user-supplied AdultEmbed host and remains disabled pending a successful, authorized Preview contract test.
- Provider state: `PENDING`; metadata permission: `UNVERIFIED`; playback: `DISABLED`.

## Safety and rollout

The adapter normalizes metadata only. It never returns embed HTML, embed URLs, mirror URLs, direct media URLs, API keys, or playback tokens. Every normalized record is stamped `rightsStatus: PENDING` and `playbackEnabled: false`.

Metadata fetching is deliberately not enabled by default. Before enabling it, obtain written permission for metadata reuse and confirm the provider's applicable terms. Before any public listing or playback, verify distribution rights per title, performer age and consent, territorial scope, expiration, complaints, and takedown workflow. An API's own 18+ statement is not independent verification for ClipViet.

Requests must be server-side, read-only, bounded to at most 20 records per page, use timeouts, and never crawl all pages in one build. No scraping, downloading, stream proxying, mirror fallback, DRM/paywall bypass, or geoblock bypass is implemented.

## Contract

`GET /search?query=&page=1&per_page=20&sort=newest&quality=complete`

Expected response shape: `{ page, per_page, total, pages, results: [...] }`.

The normalizer is covered by local unit tests. It is not a claim that the remote API is reachable or that the provider has granted ClipViet rights.


Preview deployment trigger: branch `feat/adultembed-preview-adapter` is allowlisted only on the isolated Pages Preview project.

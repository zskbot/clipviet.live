# api.video integration — Preview only

Reviewed 2026-11-27.

## Repository assessment

| Repository | What it contains | Integration use |
|---|---|---|
| [zskbot/api-video](https://github.com/zskbot/api-video) | API Evangelist's independent third-party profile and machine-readable API artifacts. Its README explicitly says it is not the provider's software and contains no runnable software. | Supplemental API-discovery/OpenAPI reference only; not a runtime dependency or source of credentials. |
| [zskbot/api.video-documentation](https://github.com/zskbot/api.video-documentation) | Fork of the official documentation repository. | Compared with upstream `apivideo/api.video-documentation`: identical, 0 commits ahead/behind. Link to canonical docs instead of copying the docs site into ClipViet. |
| [apivideo/api.video-documentation](https://github.com/apivideo/api.video-documentation) | Official api.video documentation source. | Canonical developer documentation and API reference. |
| [zskbot/api.video-player-sdk](https://github.com/zskbot/api.video-player-sdk) | MIT-licensed fork of the official Player SDK. | Compared with upstream `apivideo/api.video-player-sdk`: identical, 0 commits ahead/behind. Use the published `@api.video/player-sdk@1.2.33` package rather than maintaining a duplicate source copy. |

## Implemented in ClipViet

- Optional API.video Player SDK component, loaded only for a video carrying an `apiVideoId`.
- Server-side playback allowlist: `APIVIDEO_APPROVED_VIDEO_IDS_JSON`. The default is empty and playback is denied unless an ID is explicitly approved.
- API key presence/status endpoint. `APIVIDEO_API_KEY` is read only on the server; its value is never returned to the browser.
- Player uses api.video's hosted player for api.video video IDs. It does not convert or ingest arbitrary AppleCMS HLS URLs.
- Existing native HTML5/HLS playback remains the separate path for authorized direct media URLs.

## Preview environment configuration

Set these as server-side environment variables in the Preview environment only:

- `APIVIDEO_API_KEY`: optional api.video API key. Keep it in the hosting provider's secret manager; never commit it.
- `APIVIDEO_APPROVED_VIDEO_IDS_JSON`: JSON array of IDs that have passed ClipViet's independent rights review, e.g. `[{"id":"YOUR_VIDEO_ID","live":false}]`.
- `APIVIDEO_APPROVED_SOURCE_HOSTS_JSON`: JSON array of exact HTTPS hostnames approved for ingestion after rights review, e.g. `["media.example.com"]`.

The current allowlist is empty unless explicitly configured. Do not add a video ID until the content owner, distribution territory, performer age, consent, and platform rights are verified.

## Endpoints

- `GET /api/integrations/apivideo/status`: returns only configuration booleans, approved ID count, and validation state.
- `GET /api/integrations/apivideo/playback?id=...`: returns a player ID only when it is in the server-side allowlist; otherwise returns 404.
- `POST /api/admin/integrations/apivideo/videos`: admin-authenticated, sandbox-first creation of a private api.video object from an approved HTTPS source URL. Requires explicit rights confirmation and an exact source-host allowlist match. Production writes are locked unless an additional server flag is explicitly enabled.

## Important compatibility boundary

The api.video Player SDK controls api.video's hosted HTML5 player by video ID. It is not a generic HLS.js replacement and cannot play arbitrary third-party `.m3u8` URLs. ClipViet must keep its existing native Safari HLS / hls.js route for authorized external media.

## Validation

- Unit tests cover deny-by-default, allowlist parsing, duplicate IDs, live-stream flag, malformed configuration, and secret non-disclosure.
- No api.video account key was supplied or configured during this change.
- The API create route defaults to the api.video Sandbox environment; Sandbox videos are watermarked and deleted after 24 hours per provider documentation.
- The create route was not called. No video was uploaded, ingested, transcoded, published, or played through the external service.
- No Production, DNS, custom domain, D1, R2, or existing media data was changed.

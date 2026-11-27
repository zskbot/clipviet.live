# ClipViet Provider API v1 (Preview)

Tài liệu hợp đồng dùng chung cho `zskbot/clipviet` và `zskbot/clipviet.live`.
Môi trường triển khai: Cloudflare Pages/Workers **Preview only**. Các endpoint không thay thế quy trình phê duyệt quyền nội dung.

## 1. Provider registry

| ID | Vai trò | API base cố định | Biến URL trong Preview |
|---|---|---|---|
| `souavzy` | Main | `https://api.souavzy.vip/api.php/provide/vod/` | `APPLECMS_SOUAVZY_URL` |
| `apiyutu` | Backup 1 | `https://apiyutu.com/api.php/provide/vod/` | `APPLECMS_APIYUTU_URL` |
| `lbapi9` | Backup 2 | `https://lbapi9.com/api.php/provide/vod/` | `APPLECMS_LBAPI9_URL` |
| `slapibf` | Backup 3 | `https://slapibf.com/api.php/provide/vod/` | `APPLECMS_SLAPIBF_URL` |
| `jipinvip1` | Backup 4 | `https://jipinvip1.com/api.php/provide/vod/` | `APPLECMS_JIPINVIP1_URL` |

The URL variables are configuration, not proof of authorization. Set them only in the isolated Cloudflare Preview environment. Never put credentials or evidence in source code or client JavaScript.

All candidates use the AppleCMS V10 collection convention. Use `ac=list` for categories and `ac=detail` for video rows/details. The pagination response fields `page`, `pagecount`, `total`, and `limit` are authoritative; do not assume that every provider returns the same page size.

## 2. Provider state model

`GET /api/providers/applecms/status`

Returns one record per provider without making upstream requests or revealing credentials.

| Field | Meaning |
|---|---|
| `configured` | A fixed-host API URL is present in the Preview environment |
| `rightsApproved` | Provider-level evidence, expiry, territory and approval flags passed validation |
| `status` | `NOT_CONFIGURED`, `PENDING_RIGHTS`, `METADATA_ONLY`, or `PLAYBACK_APPROVED` |
| `operationalState` | `NOT_CHECKED` until an endpoint performs a real request; request results are `ACTIVE` or `ERROR` |

Technical availability is not a legal rights decision. `PLAYBACK_APPROVED` at provider level still requires a separate per-video approval.

## 3. Canonical endpoints

Base path: `/api/providers/applecms`

| Method | Path | Purpose |
|---|---|---|
| GET | `/status` | Provider configuration and rights state |
| GET | `/categories?sourceId=souavzy` | Category tree; response contains leaf categories |
| GET | `/videos?sourceId=souavzy&page=1&limit=30&categoryId=12&keyword=...` | Paginated, rights-approved metadata |
| GET | `/videos/{videoId}?sourceId=souavzy` | One video's approved metadata; contains no media URLs |
| GET | `/videos/{videoId}/playback?sourceId=souavzy` | Separate playback information endpoint; forbidden until provider and video have matching rights |

The public catalog compatibility routes may keep their existing response envelope, but provider-specific integrations should use the canonical endpoints above.

### Categories

Upstream request: `GET {BASE}?ac=list`

Response:
```json
{
  "success": true,
  "provider": { "id": "souavzy", "name": "Souavzy", "status": "METADATA_ONLY", "operationalState": "ACTIVE" },
  "categories": [{ "id": "12", "parentId": "2", "name": "Category" }],
  "rightsGate": { "policy": "deny-by-default", "metadataOnly": true }
}
```

Root categories are grouping nodes. The API returns leaf categories so the UI does not link users to empty parent categories.

### Video list

Upstream request: `GET {BASE}?ac=detail&pg=1&t=12&wd=keyword`

Supported query parameters: `sourceId` (required), `page` (default 1), `limit` (1–100), `categoryId`, `keyword`.

The adapter maps `vod_id`, `vod_name`, `type_id`, `type_name`, `vod_pic`, `vod_year`, `vod_area`, `vod_lang`, `vod_duration`, `vod_content`, `vod_pubdate`, `vod_time`, and `vod_hits`. Every item is source-scoped and must have a valid per-video metadata record.

Metadata responses deliberately omit `vod_play_url`, parsed lines, HLS/MP4 URLs, and embed URLs.

### Video detail

Upstream request: `GET {BASE}?ac=detail&ids={videoId}`

The detail response uses the same metadata schema as the list. It includes a `playbackEndpoint` reference and flags `playbackEnabled=false` and `playbackRightsApproved=false`; it never includes stream URLs.

### Playback info

`GET /videos/{videoId}/playback?sourceId={providerId}`

Possible modes:
- `metadata_only`: returns HTTP 403 with `PLAYBACK_RIGHTS_PENDING`.
- `official_embed`: returns only a separately supplied official embed URL whose hostname exactly matches the provider's `embedHosts` allowlist.
- `owner_hosted_stream`: returns direct browser URLs only when the per-video record explicitly grants `owner_hosted_stream` and every URL hostname exactly matches `mediaHosts`.

No server-side stream proxy, downloader, segment relay, rehosting, referrer bypass, or fallback around a provider's access restrictions is part of this API. Browser playback is direct to the authorized host.

## 4. Rights record contract

Provider-level approval in `VIDEO_PROVIDER_RIGHTS_JSON` requires:
- `approved=true`, `enabled=true`;
- `rightsHolder`, `licenseReference`;
- HTTPS `evidenceUrl` and `documentationUrl`;
- future `expiresAt`, `regions` containing `VN` or `GLOBAL`;
- `authMode` in `none | api_key | oauth2 | signed_request`;
- `playbackMode` in `metadata_only | official_embed | owner_hosted_stream`.

Per-video approval in `VIDEO_VIDEO_RIGHTS_JSON` is keyed by `{providerId}:{videoId}` (legacy key `{videoId}` is accepted only when `providerId` matches). It requires a source content ID, creator, rights holder, license reference, source and evidence URLs, future expiry, region, and explicit checks for source, ownership, performer age and performer consent. `permittedUses` must explicitly include the requested use.

Provider approval does not approve every item returned by the provider. Do not fill either registry with inferred or fabricated values. The five supplied candidates currently remain pending because no such approvals are on file.

## 5. Error contract

Errors are JSON:
```json
{ "success": false, "code": "PROVIDER_RIGHTS_PENDING", "error": "Provider rights are pending review." }
```

Stable codes include `UNKNOWN_PROVIDER`, `SOURCE_ID_REQUIRED`, `PROVIDER_NOT_CONFIGURED`, `PROVIDER_CONFIG_INVALID`, `PROVIDER_RIGHTS_PENDING`, `PROVIDER_NETWORK_ERROR`, `PROVIDER_UPSTREAM_ERROR`, `PROVIDER_INVALID_RESPONSE`, `VIDEO_NOT_FOUND`, `VIDEO_RIGHTS_PENDING`, `PLAYBACK_RIGHTS_PENDING`, `OFFICIAL_EMBED_NOT_AVAILABLE`, and `MEDIA_HOST_NOT_APPROVED`.

`GET` and `HEAD` are read-only. Other methods return `405`. Responses are `application/json; charset=utf-8`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. Raw provider credentials and raw upstream error bodies are never returned.

## 6. Browser and media acceptance

Only run media probes for URLs returned by the authorized playback endpoint after a matching per-video approval. The Preview Diagnostics page checks:

1. provider status, list and detail API responses;
2. media URL reachability and browser CORS acceptance;
3. HLS manifest content type, first media playlist/segment and segment MIME;
4. MP4 `Content-Type`, `Range: bytes=0-0`, HTTP `206`, `Content-Range`, and exposed `Accept-Ranges`;
5. the current device's native HLS support and `HTMLVideoElement.loadeddata` / decoded frame dimensions.

A diagnostic page reporting `PENDING` means there is no authorized media sample to test; it is not a passing HLS/MP4 result. A real iPhone Safari test must be run in Safari on the device. Unit tests cannot certify provider CDN CORS, MIME or byte-range behavior.

## 7. Preview deployment boundary

- Deploy only the branch Preview for review.
- Do not merge this branch, change `main`, Production deployments, DNS, custom domains, or persistent databases.
- Do not activate a provider or edit rights records until legal evidence is reviewed.

## Preview media diagnostics

The dedicated Playback Worker exposes:

`GET /api/playback/providers/{providerId}/videos/{videoId}/diagnostics`

It is gated by the same provider + connector + per-video license, territory, source, ownership, performer-age and performer-consent checks as playback. Pending rights return 403 before any upstream request.

For up to four approved media entries:
- HLS: manifest status, Apple HLS MIME, browser CORS and first allowlisted media resource reachability/CORS.
- MP4: ranged GET status, `video/mp4` MIME, CORS, `Range: bytes=0-1`, HTTP 206 and `Content-Range`.
- The report omits raw URLs and manifest content.

No actual provider media has been certified while the supplied provider records remain pending. A passing fixture-based test proves the diagnostic logic, not the remote CDN or Safari playback.

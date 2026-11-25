# hsex.men / hsex.tv provider review

**Decision: BLOCKED / REVIEW REQUIRED.** This is a static source-code review of HTML supplied for analysis. It is not a live API verification, media playback test, legal opinion, or authorization to redistribute content.

## Evidence observed in the supplied HTML

- The earlier public-site check observed `hsex.men` redirecting to `hsex.tv`. Treat these as separate origins; do not silently follow or trust cross-origin redirects.
- The page is an HTML listing site. Navigation includes `list-1.htm`, `top7_list-1.htm`, `top_list-1.htm`, `hot_list-1.htm`, and `search.htm?search=...&sort=new`. These are page routes, not a documented JSON API.
- The page preloads Video.js 8.22.0 and `/static/js/fastest_cdn.js?8`. A preload is not proof that a player instance is initialized, nor does it identify the media protocol.
- Thumbnail URLs use `https://i.hdcdn.store/thumb/<id>.webp`. These are image resources, not video streams.
- No direct MP4, WebM, HLS playlist (`.m3u8`), DASH manifest, player embed URL, or JSON API endpoint is present in the supplied homepage HTML.
- Third-party advertising / redirect resources include `go.whitetrafsa.com` and `go.tscprts.com`. They must not be treated as trusted media hosts.
- A page script unregisters a same-origin `/sw.js` registration and deletes every CacheStorage entry for that origin if a matching registration exists. Do not copy this behavior into ClipViet; broad cache deletion is destructive to unrelated origin caches.
- The HTML includes adult-content labeling and a site warning for 18+. That declaration alone does not prove the age, consent, provenance, or distribution rights for each item.

## Compatibility with ClipViet Admin

The current static Admin accepts an HTTPS JSON endpoint returning an array or an object containing `results`, `videos`, or `data`. It maps common title, thumbnail, and media URL fields. The supplied page exposes HTML routes, not that API contract. Therefore it cannot be configured as a working provider based on this evidence.

## Required gates before any provider activation

1. Obtain written authorization / license for the exact metadata, thumbnails, embeds, and media that would be displayed or played.
2. Obtain official API documentation and a provider-issued test endpoint. Do not scrape HTML, reverse-engineer hidden endpoints, download, proxy, or re-host streams.
3. Verify adult-age and consent safeguards for all content, with a process to report and remove suspected non-consensual, underage, or otherwise unlawful material. Any uncertainty is a hard stop.
4. Require HTTPS and exact hostname allowlists. Reject redirects; do not permit wildcard suffix matching or userinfo in URLs.
5. Validate JSON schema, response size, content type, timeouts, and item count. Do not send cookies. Keep credentials server-side, never in browser storage or frontend bundles.
6. Validate poster and media origins independently. Confirm media MIME type, byte-range behavior, CORS, and supported playback protocol only against authorized test assets.
7. Keep the provider disabled until all gates pass and an isolated Preview test succeeds.

## Current state

- Provider: not configured; no endpoint, token, or media host is stored.
- Integration: not implemented; no scraping, embed, playback, proxy, or download behavior added.
- Deployment: no Pages, Netlify, Cloudflare, DNS, Worker, or Production changes.
- Recommendation: do not activate this provider from the supplied HTML alone.

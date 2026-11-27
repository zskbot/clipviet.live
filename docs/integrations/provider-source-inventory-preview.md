# ClipViet provider source inventory — Preview only

## AppleCMS API candidates

| Provider ID | API endpoint | State |
| --- | --- | --- |
| souavzy | https://api.souavzy.vip/api.php/provide/vod/ | PENDING_RIGHTS |
| apiyutu | https://apiyutu.com/api.php/provide/vod/ | PENDING_RIGHTS |
| lbapi9 | https://lbapi9.com/api.php/provide/vod/ | PENDING_RIGHTS |
| slapibf | https://slapibf.com/api.php/provide/vod/ | PENDING_RIGHTS |
| jipinvip1 | https://jipinvip1.com/api.php/provide/vod/ | PENDING_RIGHTS |

Use `ac=list` for catalog/category listing and `ac=detail&ids=<vod_id>` for a selected item's detail. Metadata must pass provider and per-title rights approval. Playback is separate and remains disabled unless independently approved.

## User-supplied website references

These URLs are external references only: hsex.men listing pages and sort variants; sexonline.blog; sexvn.co/sex-trung-quoc; buomtv.biz homepage/video/latest/discover/category pages; xnhau.plus homepage/genres/channels/latest clips; viet69.be homepage/articles/tags; javhay.onl/vi-vn; 3lg7zcu3.garymorgan3490.icu; tb7nri7d.91tao.us.ci; 1dwa60ri.taopian91.us.ci; b8rwrbxc.shanxiuyigdd.icu; www.91taopian.com.

These HTML pages are not documented APIs. This Preview does not crawl, scrape, reverse-engineer hidden endpoints, embed, proxy, download, or play them. Obtain official API documentation and written authorization before adding an adapter.

## Empty catalog behavior

`GET /api/videos` now aggregates only configured AppleCMS providers whose provider rights are approved, and only items with per-title metadata approval. It returns `catalogState`, provider statuses and a clear explanation when no items are eligible. No demo items are injected. Metadata approval alone never enables playback.

## Preview acceptance

- Confirm catalog listing uses `ac=list` and detail uses `ac=detail&ids=...`.
- Keep all five providers pending until licensing and provenance are reviewed.
- Confirm the catalog API distinguishes rights-pending, provider errors and a genuinely empty result.
- Confirm no upstream media URL or credential is exposed in metadata.
- Keep Preview isolated from Production, custom domains and DNS.

## Isolated Pages Preview

The Cloudflare Pages project `clipviet-live-independent-preview` now explicitly includes branch `preview/clipviet-catalog-integration-20261128` in its Preview branch allowlist. The project production branch remains `main` and automatic Production deployments remain disabled.

## Catalog, detail and player routes

- `GET /api/videos?page=N&limit=100` reads the same upstream page N from each rights-approved provider and merges those page results. It does not slice the merged page a second time. `hasMore` is derived from provider page counts for the existing HomeFeed pagination loop.
- The catalog response includes the explicit empty-state reason, per-provider rights/operational state, provider errors and a deny-by-default rights summary.
- HomeFeed displays a provider-review or outage explanation rather than presenting an unexplained blank grid. Metadata category names are normalized for filtering.
- `GET /api/providers/applecms/diagnostics` contacts only providers whose configuration and provider-level rights are approved. Pending/unconfigured providers are not probed.
- The watch page resolves provider ID + source content ID through the AppleCMS detail route. The Play action separately requests the playback endpoint after a user gesture; only an approved official embed or allowlisted owner-hosted HTTPS media URL is rendered. Safari uses the native video element for HLS/MP4 and reports playback errors.

## SEO

The Preview includes a sitemap and robots policy. Administrative and API routes are excluded from crawling. No analytics tag or Search Console verification is fabricated; Lion AI reporting requires an authorized workspace and bound GA4/Search Console connections.

## Next.js application integration

The public site uses the Next.js App Router API at `app/api/videos/route.js`; Cloudflare Pages Functions alone do not own this route. The Preview now connects the App Router directly to the same AppleCMS adapter and rights registry.

- The five supplied AppleCMS API endpoints are configured as defaults, but remain `PENDING_RIGHTS`; configuration does not authorize metadata or playback.
- The homepage no longer falls back to bundled demo records when no approved source returns content.
- `GET /api/videos` returns explicit `catalogState`, provider status, provider errors and pagination. Metadata responses omit upstream stream/embed URLs.
- `GET /api/videos?id=maccms:<provider>:<vod_id>` returns metadata only.
- `GET /api/videos/<encoded-id>/playback` performs a separate per-video rights check after the user presses Play.
- `GET /api/providers` lists AppleCMS and documented legal provider states.
- `GET /api/providers/applecms/diagnostics` only probes configured sources after provider-level rights approval.
- The watch page uses the native HTML video element with HLS MIME handling for Safari/iPhone and reports media errors. Browser-level device playback still requires a real permitted stream and iPhone verification.

The separate Cloudflare Pages Functions routes remain available for the Pages Preview environment. The Next.js routes are the active path used by the current React homepage.

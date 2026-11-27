# ClipViet source review — user-supplied URLs

This inventory is for review only. The URLs below are source webpages, not verified API endpoints or direct media URLs.

The user stated in the conversation that the sources are authorized for use and distribution. That statement is recorded as user-provided context, not independent evidence. Before public playback, record source-level and per-title rights evidence in the Provider Registry, including ownership/license reference, permitted uses, territories, expiry, performer age and consent verification, and takedown/complaint process.

## 91Porna detail pages

- https://91porna.com/comic/index/detail?video_key=177440
- https://91porna.com/comic/index/detail?video_key=60849
- https://91porna.com/comic/index/detail?video_key=210955
- https://91porna.com/comic/index/detail?video_key=35181
- https://91porna.com/comic/index/detail?video_key=216043

Five other 91Porna detail URLs were part of the earlier ten-link message but their exact video_key values were not available when this inventory was prepared. They are intentionally not guessed.

## Other supplied source pages

- https://hsex.men/video-768828.htm
- https://hsex.men/
- https://vlxx.net/
- https://vlxx.net/phim-sex-hay/
- https://xnhau.plus/the-loai/vietnam/
- https://ditvaolon.pro/
- https://phimsex79.com/
- https://vi.xhstream.com/#fa-9oCf2JebhtiOnpebhpmC2JiTgg
- https://vhhsvnn.com/
- https://viet69.be/

## Integration status

- API documentation / endpoint: not identified for these URLs.
- Direct HLS/MP4 playback URL: not identified.
- Official embed permission / iframe policy: not verified.
- Public playback: disabled.
- Stream proxying, scraping, DRM/paywall bypass and access-control bypass: not implemented.

The existing ClipViet player can play a direct HTTPS HLS or MP4 URL. For iPhone Safari, HLS should be assigned directly to the native video element. A webpage URL must not be passed to the media player as if it were a stream.

## Next technical contract

For each provider, obtain a documented and authorized API contract with:
- HTTPS API base URL and endpoint documentation;
- authentication method and server-side credential scope;
- stable video ID, title, poster, duration and category fields;
- an authorized embed URL or direct HLS/MP4 URL;
- CORS / iframe / playback restrictions and allowed hostnames;
- pagination, rate limits, cache policy, regions and takedown contact.

Store credentials only as Cloudflare Worker secrets. Keep public browser requests read-only. Enable a provider or title only after the rights registry approves it.


## Additional source batch supplied on 2026-11-28

The following URLs were supplied for possible ClipViet integration. They are recorded as **unverified candidates only**. No page crawling, API requests, catalog extraction, media download, embedding, proxying, or playback has been performed.

### Website pages

- https://hsex.men/list-1.htm
- https://hsex.men/list-1000.htm
- https://hsex.men/list-1.htm?sort=hot
- https://sexonline.blog
- https://sexvn.co/sex-trung-quoc
- https://buomtv.biz
- https://buomtv.biz/video
- https://buomtv.biz/latest/all
- https://buomtv.biz/discover/movie-category
- https://buomtv.biz/category/bo-suu-tap-phim-sex-nong-bong/85?type=long
- https://buomtv.biz/category/jav-vietsub/3?type=long
- https://buomtv.biz/category/phim-sex-trung-quoc/4?type=long
- https://xnhau.plus
- https://xnhau.plus/the-loai/
- https://xnhau.plus/channels/
- https://xnhau.plus/clip-sex-moi/
- https://viet69.be
- https://viet69.be/bai-viet/
- https://viet69.be/tag/clip/
- https://viet69.be/tag/clip/all
- https://javhay.onl/vi-vn/
- https://3lg7zcu3.garymorgan3490.icu
- https://tb7nri7d.91tao.us.ci
- https://1dwa60ri.taopian91.us.ci
- https://b8rwrbxc.shanxiuyigdd.icu
- https://www.91taopian.com

### AppleCMS / MacCMS-style API candidates

These endpoint-shaped URLs were supplied by the user. Their path format alone does not establish that the endpoints are official, stable, authorized, or licensed for redistribution.

- https://api.souavzy.vip/api.php/provide/vod/
- https://apiyutu.com/api.php/provide/vod/
- https://lbapi9.com/api.php/provide/vod/
- https://slapibf.com/api.php/provide/vod/
- https://jipinvip1.com/api.php/provide/vod/

Environment variable names supplied for a future server-side Preview configuration:

- `APPLECMS_SOUAVZY_URL`
- `APPLECMS_APIYUTU_URL`
- `APPLECMS_LBAPI9_URL`
- `APPLECMS_SLAPIBF_URL`
- `APPLECMS_JIPINVIP1_URL`

These are endpoint URLs, not secrets. Do not add API keys/tokens to the repository or browser bundle. Do not assume any endpoint is approved just because its URL is configured.

### Review gate for this batch

- Initial state: `PENDING_REVIEW`; `rights_status=PENDING`; `playback_enabled=0`.
- API contract: require provider-owned documentation, authentication scope, pagination/rate limits, field schema, CORS/player rules and allowed media hosts.
- Rights: require written distribution/embedding permission, per-title license evidence, territories, expiry, performer age/consent verification, and takedown contact/process.
- Technical validation after authorization: bounded health checks against documented endpoints, schema-only metadata validation, rate-limited pagination, stable-ID deduplication, and quarantine of incomplete records.
- No endpoint may be polled, crawled, indexed, or used to create public catalog entries until its provider authorization and applicable rights review are recorded.
- A source webpage or metadata API response is not a media license. Metadata discovery does not authorize copying, rehosting, proxying, or public playback.
- The supplied Preview URL `https://dc7e4ff9.clipviet-live-independent-preview.pages.dev/?utm_source=chatgpt.com` is a test destination only, not a provider or source of video records.


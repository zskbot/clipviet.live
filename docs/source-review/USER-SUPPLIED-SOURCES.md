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

# ClipViet Media & Text Repository Integration

Preview branch: `preview/integrate-media-text-modules`

## Upstream repositories audited
- `zskbot/music-player` — Flutter desktop/mobile app using `media_kit`, file picker and platform-specific plugins. Audited upstream HEAD: `4cbfd21eeeb9455a7315dad865ec11d2e63ceeb2`.
- `zskbot/video-player` — Flutter desktop/mobile app using `media_kit_video`, file picker and platform-specific plugins. Audited upstream HEAD: `f57fcab4ef70e518a498ab8896127409a5279372`.
- `zskbot/weird.text` — text collection repository. Audited upstream HEAD: `6ab214b31af27f7a794df38eb52f783102073df6`.

## Integration approach
- The two Flutter applications are retained as independent upstream projects. Their current dependency and platform usage is not suitable for direct embedding into the static Cloudflare Pages website.
- ClipViet adds original browser-native audio/video player pages using HTMLMediaElement. No Flutter source files are copied.
- Text Library provides curated links to selected upstream files. Text is not copied into ClipViet because no LICENSE file was found in the upstream repository at audit time.
- Potentially harmful or sensitive collections (including self-harm, psychopath test and dangerous-search challenge material) are deliberately excluded from public navigation.

## Routes
- `/music/` — browser audio player (HTTPS URL or local audio file).
- `/video/` — browser video player (HTTPS URL or local video file; HLS support depends on browser).
- `/library/` — curated upstream text collection links.

## Security and limitations
- URL playback is client-side only. The page does not proxy, scrape or download third-party media.
- Only HTTPS URLs without embedded credentials are accepted.
- Playback depends on browser codec support, server MIME types, CORS and provider authorization.
- The browser player is not a substitute for a native Flutter desktop/mobile build.
- Obtain and document upstream licenses before copying or redistributing any source code or text.
- Admin authentication and provider registry are unchanged in this integration.
- No GitHub Actions workflow is invoked. Cloudflare Pages Preview is the deployment target; Production deployments remain disabled.

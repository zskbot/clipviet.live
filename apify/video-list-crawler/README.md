# ClipViet Video List Crawler (source mirror)

This directory is the repository source for the metadata-only crawler. It does not resolve or download media, extract embed/stream URLs, bypass access controls, or publish content.

## Inputs
- `startUrls`: listing pages supplied by the operator.
- `maxPages`: maximum listing pages followed per source (1–100; default 2).
- `maxRequestsPerCrawl`: hard request cap (default 100).
- `allowedDomains`: exact host allowlist. Defaults to the verified domains below.

## Site support status
- `hsex.men`: listing pagination `list-N.htm`; video pages `video-N.htm`.
- `sexonline.blog`: WordPress-style `/page/N/`; candidate video pages are root-level slugs.
- `sexvn.co`: root-level slug candidates; taxonomy paths excluded.
- `viet69.be`: `/tag/.../page/N/`; candidate video pages include root slugs and `/bai-viet/<slug>/`.
- `javhay.onl`: root-level slug candidates; taxonomy paths excluded.
- `buomtv.biz`, `xnhau.plus`: unverified/timeouts in the supplied test notes; do not mark healthy until separately tested.

The crawler checks robots.txt before queuing listing pages and pagination links, restricts navigation to the same host, enforces request limits, and requires HTTPS for start URLs. Candidate links are not proof that a page is a video or that distribution is authorized. Every output record has `rightsStatus: "PENDING"`.

## Run
Use the Apify Console or Apify CLI with the dependencies in this directory. Do not commit API tokens. Example input:

```json
{
  "startUrls": [{"url": "https://hsex.men/list-1.htm"}],
  "maxPages": 2,
  "maxRequestsPerCrawl": 20
}
```

## Output schema
`videoUrl`, `canonicalUrl`, `videoId`, `sourceDomain`, `title`, `discoveredFrom`, `discoveredAt`, `rightsStatus`. No playback URL fields are emitted.

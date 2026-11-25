# ClipViet.live — repository integration review

Reviewed on 2026-11-24. This document records repository capabilities and integration gates; it does not copy third-party source code or activate external media feeds.

## Repository matrix

| Repository | Observed capability | Integration decision |
|---|---|---|
| [KaigeCai/live](https://github.com/KaigeCai/live) | IPTV/M3U/M3U8 playlist repository; no README/license metadata surfaced | Playlist format reference only. Do not ingest streams until each item has a documented distribution right and source validation. |
| [YYYIKES/porn-description-generator](https://github.com/YYYIKES/porn-description-generator) | Python 3, Markovify and Flask; README describes a dataset of descriptions from 2007–2016 | Optional metadata text service only after dataset provenance, license and output moderation review. Not a video source. |
| [HertzAdvisor78/Uncensored-ai](https://github.com/HertzAdvisor78/Uncensored-ai) | Repository size 0; README contains only a heading | No code/API available. Do not add an integration. |
| [JustalK/PORNHUB-API](https://github.com/JustalK/PORNHUB-API) | Node scraper; README documents search/page parsing and download URLs | Do not deploy scraper/downloader by default. Review license, target-site terms, rate limits and data rights before considering a metadata-only adapter. |
| [rlleshi/phar](https://github.com/rlleshi/phar) | Python/PyTorch human-action recognition; README describes tagging and timestamps | Optional isolated backend service. Requires model weights, compute, endpoint security and rights to process input videos. |
| [LucasLeandro1204/pornsearch](https://github.com/LucasLeandro1204/pornsearch) | TypeScript multi-site search library; archived repository; MIT license metadata | Reference only; avoid a production dependency on archived code. |

## Application boundaries

- site/ is the static GitHub Pages frontend. It can serve HTML/CSS/JS/JSON only.
- The Next.js application and app/api/ routes require a server-capable runtime. GitHub Pages does not execute those routes.
- site/admin/ is a browser-side API tester, not an authenticated admin console. A token entered there is not a server-side secret store.
- A future provider adapter must normalize metadata and enforce HTTPS, timeouts, response-size limits, host allowlists, safe embeds and cache policy.
- Playback must only use direct media/embed URLs that ClipViet is authorized to distribute or display. No automatic scraping, downloading, playlist importing or proxying is enabled by this registry.
- Adult-content access controls must be appropriate to applicable law and platform policy. An age self-attestation dialog is not identity or age verification. Do not ingest non-consensual, privacy-invasive or unauthorized material.

## Deployment guardrails

This branch is for review only. It does not change main, Production, DNS, GitHub Pages settings, or the existing Cloudflare Worker. No provider credentials or stream URLs are stored in this repository.
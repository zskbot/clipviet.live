# ClipViet provider discovery

## Purpose
This registry discovers and health-checks documented official provider entry points for Vietnam, China, Korea and other markets. The scheduled scanner checks documentation reachability only; it does not crawl undocumented endpoints, bypass login, extract private video URLs, or grant rights to redistribute media.

## Initial verified candidates
- **Global / VN / CN / KR:** YouTube Data API v3. Search and embed must follow YouTube API policies. The API does not grant permission to download or re-host audiovisual content.
- **China:** iQIYI Developer Platform. Video, channel, album, query and player APIs require a developer account and approval for the desired API.
- **China:** Youku Open Platform. Public docs expose upload workflows; upload API documentation is not proof of third-party search or redistribution rights.
- **China:** Douyin Open Platform. Creator data access requires app registration, OAuth and approved scopes.
- **China / other regions:** Tencent Cloud VOD is a media-library service for authorized asset owners, not a public video discovery feed.
- **Korea:** no Korean third-party public video-search API with confirmed re-distribution rights has been validated in this first pass. Keep Korea as a discovery gap rather than inventing an endpoint.
- **Vietnam:** use authorized creator/channel integrations and owner-submitted video libraries. A public endpoint does not grant blanket rights to republish user videos.

## Automated operation
Run `node scripts/discover-video-sources.mjs`. It writes `site/data/provider-discovery.json` with reachability, HTTP status, latency and access/rights gates. A reachable documentation page is only a technical signal.

## Ingestion gate
A provider may be activated for catalog ingestion only after all of the following are recorded:
1. Official API documentation and stable endpoint contract.
2. App registration, credentials and granted scopes where required.
3. Written rights to display/embed/distribute each media asset.
4. Adult-only assurance, documented informed consent and creator provenance.
5. Official player/embed compliance, attribution, geographic restrictions and takedown contact.
6. Duplicate detection, moderation, abuse reporting and audit trail.

## Important limits
"Self-shot" cannot be reliably established from a title, tag, country field, or thumbnail. Treat it as unverified until the uploader/rights-holder attests to provenance and the platform's authorization is checked. Never ingest leaked, secretly recorded, non-consensual intimate material, or any content involving minors.

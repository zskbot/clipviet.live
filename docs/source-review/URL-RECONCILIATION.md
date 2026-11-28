# ClipViet source URL reconciliation — Preview only

Generated: 2026-11-28  
Inputs: user-submitted URL list in [Issue #86](https://github.com/zskbot/clipviet.live/issues/86) and Clipform intake report.  
Method: string/URL canonicalization only. No requests were sent to source sites or API endpoints; no crawling, scraping, metadata fetch, playback, or external verification was performed.

## Reconciliation summary

| Group | Candidates | Canonical duplicates | Official API docs verified | Rights evidence verified | Eligible for Preview metadata queue |
|---|---:|---:|---:|---:|---:|
| Website / category URLs | 26 | 0 | N/A / not supplied | 0 | 0 |
| AppleCMS-shaped API URLs | 5 | 0 | 0 | 0 | 0 |
| **Total** | **31** | **0** | **0** | **0** | **0** |

Canonicalization used the PR normalizer rules: HTTPS only, lowercase host, remove fragments/tracking parameters, strip trailing slash except root, sort query parameters, preserve functional query parameters. The three hsex.men URLs remain distinct because `sort=hot` is functional; category and page paths remain distinct. No exact canonical duplicates were found in the 31 URLs in Issue #86.

## Website candidates (26)

1. `https://hsex.men/list-1.htm` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
2. `https://hsex.men/list-1000.htm` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
3. `https://hsex.men/list-1.htm?sort=hot` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
4. `https://sexonline.blog` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
5. `https://sexvn.co/sex-trung-quoc` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
6. `https://buomtv.biz` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
7. `https://buomtv.biz/video` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
8. `https://buomtv.biz/latest/all` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
9. `https://buomtv.biz/discover/movie-category` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
10. `https://buomtv.biz/category/bo-suu-tap-phim-sex-nong-bong/85?type=long` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
11. `https://buomtv.biz/category/jav-vietsub/3?type=long` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
12. `https://buomtv.biz/category/phim-sex-trung-quoc/4?type=long` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
13. `https://xnhau.plus` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
14. `https://xnhau.plus/the-loai` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
15. `https://xnhau.plus/channels` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
16. `https://xnhau.plus/clip-sex-moi` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
17. `https://viet69.be` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
18. `https://viet69.be/bai-viet` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
19. `https://viet69.be/tag/clip` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
20. `https://viet69.be/tag/clip/all` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
21. `https://javhay.onl/vi-vn` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
22. `https://3lg7zcu3.garymorgan3490.icu` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
23. `https://tb7nri7d.91tao.us.ci` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
24. `https://1dwa60ri.taopian91.us.ci` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
25. `https://b8rwrbxc.shanxiuyigdd.icu` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.
26. `https://www.91taopian.com` — `PENDING_REVIEW`; rights evidence not provided/verified; no ingestion or playback.

## AppleCMS API candidates (5)

1. `https://api.souavzy.vip/api.php/provide/vod` — `PENDING_REVIEW`; AppleCMS-shaped path only, API identity/schema/auth/docs not verified; no requests made.
2. `https://apiyutu.com/api.php/provide/vod` — `PENDING_REVIEW`; AppleCMS-shaped path only, API identity/schema/auth/docs not verified; no requests made.
3. `https://lbapi9.com/api.php/provide/vod` — `PENDING_REVIEW`; AppleCMS-shaped path only, API identity/schema/auth/docs not verified; no requests made.
4. `https://slapibf.com/api.php/provide/vod` — `PENDING_REVIEW`; AppleCMS-shaped path only, API identity/schema/auth/docs not verified; no requests made.
5. `https://jipinvip1.com/api.php/provide/vod` — `PENDING_REVIEW`; AppleCMS-shaped path only, API identity/schema/auth/docs not verified; no requests made.

## Evidence comparison

The Clipform response summary currently shows 3 completed submissions. All three self-declare a written distribution licence. That is a declaration, not independent evidence. The connector redacts the long-text answers containing source URLs, official documentation URLs, licence scope, and evidence URLs; therefore the exact documents cannot be examined from the connector output.

For all 31 candidates:
- Official provider identity: **not verified**
- Official API documentation: **not supplied in inspectable form**
- Written licence document and licensor authority: **not independently verified**
- Covered content IDs/catalogue: **unknown**
- Territory, platform, term/expiry: **unknown**
- Metadata display rights: **unverified**
- Embed/replay/redistribution rights: **unverified**
- Media host allowlist and API schema/auth/pagination/rate limits: **unknown**

**Decision:** no candidate meets the evidence gate for Preview metadata ingestion. Keep every candidate at `PENDING_REVIEW`, `rights_status=PENDING`, `metadata_ingest_allowed=false`, `playback_enabled=false`, and `published=false`. Do not infer that a website owns or licenses content merely because it is reachable or exposes an API-shaped path.

## Next evidence gate

For each source, obtain an inspectable machine-readable export or documents that establish (1) the legal provider/licensor identity and authority, (2) the official API documentation and permission to access it, and (3) explicit rights for the exact content, platform, territory, term, metadata use, and embedding/replay. Only then may an authorized reviewer consider a Preview-only, read-only API/schema check. Keep credentials out of Clipform/GitHub and use encrypted Preview secrets only after the authorization gate.

No Production, main branch, DNS, existing database rows, secrets, publication, or playback settings were changed.

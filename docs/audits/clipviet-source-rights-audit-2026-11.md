# ClipViet source rights audit — 2026-11-26

## Scope and safety
- Repository: zskbot/clipviet.live
- Audit branch: `audit/clipviet-source-rights-2026-11`, based on current `main`.
- Read-only source assessment; no source-site crawling, scraping, stream extraction, downloading, proxying, DRM/paywall/access-control bypass, or automatic publishing.
- No provider activation, database/D1 mutation, secret changes, DNS changes, Production deployment, or merge.
- All supplied sources remain `REVIEW_REQUIRED`; none is approved for ingestion, editing, hosting, or redistribution.

## Material repository finding
PR #23 (`feat(preview): add rights-gated VDClip handoff to Admin`) was merged into `main` on 2026-11-25 23:53 UTC (merge commit `7cb2fe303f59d9b1be171ba92a7068ccbc47199c`). Its implementation is a manual handoff only, not a verified direct VDClip API integration. The Admin packet's checkbox is an operator attestation, not legal verification and does not activate playback.

## Supplied source inventory
Every item below is unverified and blocked pending source-specific documentary evidence:
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
- https://www.91taopian.com
- 3lg7zcu3.garymorgan3490.icu
- tb7nri7d.91tao.us.ci
- 1dwa60ri.taopian91.us.ci
- b8rwrbxc.shanxiuyigdd.icu

A listing/category/homepage URL is not a direct media URL, an API contract, or proof of a right to reproduce or distribute content. Domain-level permission does not establish rights for every title, file, performer, poster, metadata item, territory, or downstream processor.

## Required evidence per title and asset
1. Identity of the rights holder and chain of title / authority to license.
2. Explicit written grant for reproduction, editing/transformation, hosting, public distribution on ClipViet, and processing by VDClip or other subprocessors.
3. Exact asset/title identifiers and separate rights for video, audio, thumbnail/poster, metadata, player/embed and performer likeness.
4. Documentary age verification and informed performer consent/releases, with records handled securely and access restricted.
5. Territory, effective term, expiry, sublicensing/processor rights, restrictions and permitted platforms.
6. Takedown contact, complaint workflow, response SLA, and evidence-retention policy.
7. Reviewer identity, review timestamp, evidence references, decision and periodic revalidation.

Do not accept a checkbox, user assertion, public availability, robots.txt, or a website's terms alone as proof of title-specific distribution rights.

## Technical gate
- Keep every supplied domain and all associated records in `PENDING/REVIEW_REQUIRED`.
- Keep public playback disabled and media-host allowlists empty until a legal reviewer approves each source and asset.
- Permit only owner/operator-supplied HTTPS direct media URLs after the rights record has passed review.
- No automatic crawl or scraping of the supplied adult-content sites.
- Do not submit any supplied URL to VDClip. VDClip is available on the connected account (Free tier, 30 credits), but no credits should be spent before rights approval and explicit job approval.

## PHP runtime note
The supplied PHP 8.5.12 extension inventory (PDO MySQL/SQLite, cURL, DOM/XML, Redis, Imagick, OpenSSL, etc.) is an environment claim only. It does not prove repository runtime compatibility, installed server configuration, security posture, or access to any provider API. Validate those separately in an isolated Preview after identifying the actual deployment target.

## Acceptance criteria
- A source-specific rights record is independently reviewed and approved.
- Adult-content safeguards and takedown process are verified.
- Provider/API contract is documented by the rights holder; endpoint ownership and authentication are verified.
- Preview build and authenticated Admin workflow pass without Production resources or data writes.
- iPhone Safari and desktop checks pass.
- Only then may an operator manually hand off an authorized direct media URL to VDClip. No automatic publication.

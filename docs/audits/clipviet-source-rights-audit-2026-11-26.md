# ClipViet source and rights audit — 2026-11-26

## Scope and safety

- Repository: `zskbot/clipviet.live`
- Audit branch: `audit/clipviet-source-rights-2026-11-26`
- Purpose: classify operator-supplied source URLs and establish per-title rights gates before any VDClip processing.
- This report is documentation-only. It does not fetch media, crawl pages, extract streams, download files, proxy content, invoke VDClip processing, enable providers, alter databases, or publish content.
- No Production, DNS, custom-domain, Worker secret, or existing deployment settings are changed.

## Executive finding

**No supplied source is cleared for processing or redistribution based on the evidence available in this audit.** A website URL, public listing page, player page, or domain-level statement is not a license for a specific title or asset. Every supplied source must remain `REVIEW_REQUIRED` / `PENDING` until an authorized reviewer verifies title-specific evidence and records it in the Provider Registry.

## Supplied source inventory

The following are source-page URLs, not verified direct media URLs or evidence of a distribution license:

| Source | Supplied URLs / paths | Audit status |
|---|---|---|
| hsex.men | `/list-1.htm`, `/list-1000.htm`, `/list-1.htm?sort=hot` | REVIEW_REQUIRED |
| sexonline.blog | homepage | REVIEW_REQUIRED |
| sexvn.co | `/sex-trung-quoc` | REVIEW_REQUIRED |
| buomtv.biz | homepage, `/video`, `/latest/all`, `/discover/movie-category`, `/category/bo-suu-tap-phim-sex-nong-bong/85?type=long`, `/category/jav-vietsub/3?type=long`, `/category/phim-sex-trung-quoc/4?type=long` | REVIEW_REQUIRED |
| xnhau.plus | homepage, `/the-loai/`, `/channels/`, `/clip-sex-moi/` | REVIEW_REQUIRED |
| viet69.be | homepage, `/bai-viet/`, `/tag/clip/`, `/tag/clip/all` | REVIEW_REQUIRED |
| javhay.onl | `/vi-vn/` | REVIEW_REQUIRED |
| 91taopian.com | homepage | REVIEW_REQUIRED |
| Unclassified hostnames | `3lg7zcu3.garymorgan3490.icu`, `tb7nri7d.91tao.us.ci`, `1dwa60ri.taopian91.us.ci`, `b8rwrbxc.shanxiuyigdd.icu` | REVIEW_REQUIRED — ownership, purpose and rights not established |

No source has been upgraded to APPROVED. No URL in this inventory is authorized for automated crawling or media extraction.

## Evidence required per title / asset

Before any VDClip handoff, require all of the following in a source-specific rights record:

1. Identity of the rights holder and verifiable authority to grant the license.
2. Exact title, direct media asset identifier, and evidence linking that asset to the grant.
3. Explicit permission for reproduction, editing/transformation, transcoding, hosting, and public distribution on ClipViet.live.
4. Separate permission for posters, thumbnails, artwork, performer likeness, descriptions and metadata.
5. Documented performer age verification and informed consent/releases, with a process to handle disputes.
6. Territory, start/end dates, sublicensing and processor permissions (including VDClip, if used).
7. Takedown contact, response SLA, revocation procedure, and evidence retention.
8. Reviewer identity, review timestamp, evidence URL, decision and expiry/re-review date.

A user/operator checkbox is an attestation only; it is not independent legal verification.

## Existing implementation review

The current `main` branch contains PR #23's manual VDClip handoff module:

- `docs/integrations/vdclip-rights-gated-preview.md`
- `site/admin/index.html`
- `site/admin/vdclip-workflow.mjs`

The documented and inspected behavior is a manual handoff packet, not a direct VDClip API integration. The module requires HTTPS media and evidence URLs, a Provider Registry rights-record ID, and operator attestation. It marks the packet `REVIEW_REQUIRED`, explicitly says independent verification was not performed, and sets public distribution disabled. It opens VDClip manually; it does not submit media automatically.

Important limitation: the front-end form's presence of a rights-record ID and evidence URL does not prove that the referenced record exists, is valid, covers the exact media asset, or was independently approved. Server-side enforcement and the actual Provider Registry record must be checked before processing.

## Repository / deployment observations

- Repository is public; connected GitHub permission is Admin; default branch is `main`.
- PR #23, titled “feat(preview): add rights-gated VDClip handoff to Admin”, is recorded as merged on 2026-11-25 at 23:53 UTC. This conflicts with the earlier Draft/unmerged status. This audit does not attempt to reverse or rewrite that merge.
- README identifies Cloudflare Pages/Workers as runtime and GitHub as source/docs only.
- Existing independent Preview project is documented as `clipviet-live-independent-preview`, branch `preview/cloudflare-independent`, with Production deployments disabled and no custom domain.
- Current Cloudflare account selection is ambiguous because multiple Cloudflare connections are available. No Cloudflare API mutation or deployment was attempted in this audit.
- The supplied PHP 8.5.12 extension inventory is not linked to this repository or a confirmed deployment target; it is not evidence that ClipViet currently runs on PHP. Repository `package.json` instead identifies Next.js 15 / Node.js and includes `dev`, `build`, `lint`, and `test` scripts.

## Validation status

| Check | Status | Notes |
|---|---|---|
| GitHub repository identity / permissions | PASS | `zskbot/clipviet.live`, Admin |
| Existing VDClip handoff documentation and module | REVIEWED | Manual handoff; not a verified direct API |
| Per-title licensing evidence for supplied URLs | NOT PROVIDED | All remain REVIEW_REQUIRED |
| Provider Registry rights-record database verification | NOT RUN | No D1 reads performed in this audit |
| Build / lint / tests | NOT RUN | No runtime or CI execution in this audit |
| Cloudflare Preview deployment | NOT RUN | Cloudflare account selection requires confirmation |
| Admin runtime / iPhone Safari | NOT VERIFIED | Source inspection is not runtime acceptance |
| Production / DNS / custom domains | UNCHANGED | No mutation performed |

## Gate decision

**STOP — no supplied domain or title is approved for VDClip processing.**

Continue only after each title has an independently verified Provider Registry rights record. Use only direct HTTPS media URLs supplied by the rights holder/operator and explicitly covered by that record. Keep public playback and provider activation disabled until the normal approval workflow passes.

## VDClip account boundary

The connected VDClip account is on the Free tier with 30 credits. This audit did not spend credits, create a project, upload media, render, or publish anything.

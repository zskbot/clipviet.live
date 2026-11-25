# VDClip integration — rights-gated Preview

## Status

This is a **manual handoff integration**, not a direct VDClip API integration. The connected VDClip capability in ChatGPT is an MCP connector; no supported public HTTP API contract for calling the user's VDClip account from ClipViet has been verified. Do not invent endpoints, embed MCP credentials in the browser, or proxy video through ClipViet.

## Flow

1. An operator opens the authenticated ClipViet Admin workspace.
2. The operator enters a direct HTTPS media URL, title, a Provider Registry rights-record ID, and a URL to the supporting rights evidence.
3. The browser builds a JSON handoff packet. It does not fetch, scrape, download, proxy, or publish the media.
4. The operator may open VDClip manually and submit the source there only after a separate authorized reviewer has independently verified the rights record and source-specific permission.
5. Any VDClip output must be reviewed and registered through the existing ClipViet rights/provider workflow before it can be considered for catalog publication.

## Rights gate

A website page URL, a public player URL, or a statement that a whole domain is licensed is not proof that a specific title, media file, thumbnail, performer likeness, or metadata may be processed and redistributed. Keep unverified sources in REVIEW_REQUIRED/PENDING. Require source-specific evidence covering:
- reproduction, editing/transformation, hosting, and public distribution on ClipViet.live;
- metadata, poster/thumbnail, and any embedded player rights;
- age verification and documented performer consent/releases where applicable;
- territory, term, sublicensing/processor permission, and takedown/contact process.

The Admin form's checkbox is an operator attestation only. It is not a legal verification, does not update Provider Registry, and does not enable public playback.

## Input constraints

- Only direct media URLs supplied by the rights holder/operator; HTTPS required.
- The supplied website listing/detail URLs are not treated as direct media URLs or API endpoints.
- No scraping, automatic crawling, stream extraction, DRM/paywall/access-control bypass, proxying, or automatic public publishing.
- No credentials or API tokens are stored in source code or browser storage.

## Deployment boundary

- Repository: `zskbot/clipviet.live`
- Branch: `feat/vdclip-rights-gated-preview`
- Preview only. Do not merge, deploy Production, change DNS/custom domains, modify D1 data, or enable any provider as part of this change.
- Existing Cloudflare Pages/Workers and provider state remain unchanged.

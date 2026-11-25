# VDClip Preview QA checklist

Target: `preview/vdclip-qa-hardening` on the isolated Cloudflare Pages project.

## Automated / deployment checks
- [ ] Cloudflare Pages deployment reports environment `preview`.
- [ ] Deployment build and deploy stages complete successfully.
- [ ] Admin route loads over HTTPS.
- [ ] Admin controls remain inert before server-verified Admin session.
- [ ] Admin controls become available only after `/api/admin/session` verification.
- [ ] VDClip module loads without console errors.
- [ ] No API token or source credential is written to browser storage or source.
- [ ] No media fetch, scraping, proxy, stream extraction, or automatic publishing occurs.

## Rights review per asset
- [ ] Unique rights-record ID exists in the trusted Provider Registry.
- [ ] Evidence identifies the exact title and media asset, not merely a source domain.
- [ ] Written grant covers reproduction, editing/transformation, hosting, and public distribution on ClipViet.live.
- [ ] Separate rights cover title, description, poster/thumbnail, performer likeness, and embedded player where applicable.
- [ ] Age verification and performer consent/releases are documented by the responsible rights holder.
- [ ] Territory, term, processor/sublicensing scope, expiry, and takedown contact are recorded.
- [ ] Authorized reviewer independently approves the record.
- [ ] Until all checks pass, state remains `REVIEW_REQUIRED` and provider remains disabled.

## iPhone Safari manual acceptance
Run on a physical iPhone using Safari after a successful Preview deployment:
- [ ] Sign-in and session verification work.
- [ ] Admin navigation scrolls and anchors reach the VDClip panel.
- [ ] Inputs, checkbox, and buttons fit the viewport with no horizontal overflow.
- [ ] JSON packet generation, copy, and manual VDClip link work.
- [ ] Reload and logout return the panel to the locked state.
- [ ] No playback/provider activation occurs as a side effect.

## Explicitly not verified by this document
No legal rights evidence has been supplied or reviewed for any individual URL in the original source list. This checklist is not a legal approval. No physical iPhone Safari session has been run by this commit.

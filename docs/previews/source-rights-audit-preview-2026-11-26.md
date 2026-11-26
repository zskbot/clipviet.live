# ClipViet independent Preview — source rights audit

This branch exists only to validate the already-merged source-rights audit documentation in the isolated Cloudflare Pages Preview environment.

## Guardrails
- Preview environment only; this branch is explicitly allowlisted for Preview deployment.
- Production deployments remain disabled.
- Do not merge this branch or change the production branch.
- No DNS or custom-domain changes.
- No D1 reads/writes/migrations or provider activation.
- No VDClip upload, processing, render, or publish.
- No crawling, scraping, stream extraction, media downloads, or proxying.

## Validation target
- Verify the audit documentation is served from the Preview deployment.
- Verify the Admin shell and access gate load without changing authentication configuration.
- Verify public provider state remains pending/disabled.
- Record runtime checks separately; a successful Pages build alone is not runtime acceptance.

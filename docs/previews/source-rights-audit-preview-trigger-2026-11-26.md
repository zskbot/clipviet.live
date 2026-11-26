# Preview trigger marker — 2026-11-26

The Preview branch allowlist has been updated for this branch. This commit intentionally triggers a new isolated Pages Preview build after the allowlist change.

Acceptance checks:
- Cloudflare Pages deployment environment must be `preview`.
- Build and deploy stages must succeed.
- The generated URL must use the project `pages.dev` hostname.
- No Production deployment, custom domain, DNS, D1 mutation, or provider activation is permitted.

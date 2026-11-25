# Cloudflare Pages — isolated preview

This repository remains the source of truth. Runtime hosting is external to GitHub.

## Preview target

- Cloudflare Pages project: `clipviet-live-independent-preview`
- Source repository: `zskbot/clipviet.live`
- Preview branch: `preview/cloudflare-independent`
- Static output directory: `site`
- Build command: none (static assets are already committed)
- Production branch: `main`
- Production deployments: disabled
- Custom domains: none; use the project `pages.dev` preview URL only

## Safety boundary

This project is an isolated Preview target. Do not enable production deployments, attach `clipviet.live`, change DNS, or modify the existing `clipviet-live-preview` project as part of this setup. Keep provider integrations pending until distribution rights and credentials are verified.

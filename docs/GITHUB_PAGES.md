# ClipViet.live — GitHub Pages static frontend

This repository contains a standalone static frontend in `site/` intended for GitHub Pages.

## Scope

- Static catalog, search, category filters, detail dialog, responsive layout and age self-attestation.
- Uses demo records in `site/data.js`; no video stream source is configured.
- The existing Next.js application remains in the repository.
- API route handlers, admin endpoints, Telegram webhooks, provider ingestion, server-side caching and PHP API services require a separate server runtime and are not hosted by GitHub Pages.

## Validation and deployment

- Pull requests run `.github/workflows/pages-preview.yml` to validate the static files and JavaScript modules. This is a validation check, not a hosted Preview URL.
- The single publishing workflow is `.github/workflows/deploy-clipviet-pages.yml`.
- Publishing is intentionally manual through **Actions → Deploy ClipViet.live static site to GitHub Pages → Run workflow**. It does not publish on PRs, pushes, or merge.
- The publishing workflow uploads only `./site`; it does not upload the Next.js app, PHP API, repository root, or other files.
- Before running it, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
- After the first successful deployment, verify the published URL and custom-domain status in **Settings → Pages** before enabling HTTPS.

## Domain and DNS

- `site/CNAME` contains `clipviet.live`; the file alone does not configure the GitHub Pages custom domain.
- Confirm `clipviet.live` is saved as the custom domain in **Settings → Pages**.
- Existing Cloudflare records should be checked against GitHub's current DNS guidance; do not create duplicates or delete unrelated records.
- Do not claim HTTPS is ready until GitHub Pages reports the certificate is provisioned and **Enforce HTTPS** is available.

## Important limitation

GitHub Pages serves only this static frontend. Video playback, API routes, admin endpoints, Telegram webhooks, provider ingestion, server-side caching, and PHP API services require a separate server runtime.

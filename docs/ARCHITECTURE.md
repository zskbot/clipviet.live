# ClipViet.live — Application architecture

This repository contains two separately deployable web surfaces and a PHP API source tree. They are not interchangeable hosting targets.

## 1. Static website: `site/`

- Entry point: `site/index.html`
- Browser modules and styles: `site/app.js`, `site/data.js`, `site/styles.css`
- Static admin utility: `site/admin/`
- No Node.js runtime, server routes, secrets, or database access.
- The static admin utility accepts a user-supplied HTTPS JSON endpoint in the browser. It is a local API tester, **not an authenticated CMS**. Never place privileged provider credentials in this page.
- The current catalogue data is demo data. A video API must be provided separately.

GitHub Pages publication uploads only `site/`. It does not serve the Next.js app or API routes.

## 2. Next.js application and backend: repository root

- App Router pages: `app/`
- API route handlers: `app/api/`
- React UI: `components/`
- Server-side provider, CMS and feed logic: `lib/`
- Tests: `tests/`
- Runtime dependencies are declared in the root `package.json` and locked in `package-lock.json`.

This application requires a compatible server runtime. A static Pages upload cannot execute Next.js route handlers, webhooks, server-side credentials, or persistent CMS operations.

## 3. PHP API

The independent PHP API is under `php-api/`. Its public document root is `php-api/public/`; keep source, SQL schema and environment files outside the public document root. Its deployment and database lifecycle are separate from both website surfaces.

## CI boundaries

The CI workflow validates the static website independently, then installs the root lockfile and runs Next.js lint, tests and build. PHP syntax validation is a separate job. A green static check does not imply that the Next.js backend or PHP API has been deployed.

## Preview and production safety

- Pull-request checks are validation only; they do not publish GitHub Pages or deploy a Worker.
- The GitHub Pages publisher is manual and uploads only `site/`.
- Do not connect production domains, modify DNS, promote a Worker, or deploy production as part of a Preview test.

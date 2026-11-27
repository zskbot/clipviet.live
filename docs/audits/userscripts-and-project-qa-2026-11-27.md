# Preview integration and project QA — 2026-11-27

## Scope

- Repositories: `zskbot/clipviet` and `zskbot/clipviet.live`
- Working branch: `preview/jzvd-android-sdk-view-button-20261127`
- Upstream userscript source: `CodeSenbot/UserScripts`
- Preview-only source changes; no Production deployment, DNS/domain edits, secrets, provider data or database writes.
- QA is performed independently from GitHub Actions/GitHub-hosted runners.

## Userscripts integration

- Expanded `site/userscripts/index.html` into a curated directory.
- Kept the ClipViet player helper as an opt-in local userscript.
- Added upstream install links for Scroll Button, YouTube Better Volume Control, YouTube Dynamic Video Grid and YouTube Helper.
- The upstream repository contains many unrelated scripts. Downloaders, auto-login helpers, adult-site scripts and scripts requiring broad network permissions are intentionally not embedded or auto-executed.
- Upstream code remains hosted at its source URL; the page attributes the source and tells users to inspect `@match`, `@grant` and `@require` before installing.

## Defects fixed in this change

1. Removed literal backslash-n text accidentally embedded in the homepage navigation markup.
2. Fixed the ClipViet player userscript's fullscreen fallback: Safari's `webkitEnterFullscreen()` is now invoked on the actual video element, not its container.
3. Fixed the play/pause toast race: the script now reports playback only after the `play()` promise resolves.
4. Expanded editable-target detection so keyboard shortcuts do not intercept input, buttons, links or contenteditable controls.
5. Removed unload cleanup that could leave the userscript UI detached after Safari restores a page from the back-forward cache.

## QA tooling added

- `scripts/audit-static-site.mjs` checks local HTML `href`, `src`, `poster` and `action` references, path traversal and escaped-newline markup.
- `tests/userscripts-safety.test.mjs` verifies the local userscript is valid JavaScript, restricted to ClipViet hosts, has no network/GM grants and only exposes curated upstream install links.
- These scripts are reusable in an independent Node environment; no new GitHub Actions workflow is used as the Preview build or QA dependency.

## Validation boundary

- JavaScript syntax was statically checked across all `site/` JavaScript modules in both repositories; no syntax errors were found in those checked files.
- The GitHub Pages Preview and external GitLab checks reported failures in recent runs, but the connector could not retrieve their job-log blobs. Their exact failure causes remain unverified; no green CI claim is made.
- Static link auditing and full `npm test` / `npm run lint` / Next.js build still need an independent Node environment run.
- A successful Pages deployment alone does not prove provider playback works on a physical iPhone.

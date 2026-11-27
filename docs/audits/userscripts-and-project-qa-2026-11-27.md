# Preview integration and project QA — 2026-11-27

## Scope

- Repositories: `zskbot/clipviet` and `zskbot/clipviet.live`
- Base branch: `main`
- Working branch: `preview/jzvd-android-sdk-view-button-20261127`
- Upstream userscript source: `CodeSenbot/UserScripts`
- No Production deployment, DNS/domain edits, secrets, provider data or database writes.

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

## Automated QA added

- `scripts/audit-static-site.mjs` checks local HTML `href`, `src`, `poster` and `action` references, path traversal and escaped-newline markup.
- `.github/workflows/preview-quality.yml` runs npm install, lint, unit tests, static-link audit, JavaScript syntax checks, Next.js build and PHP syntax checks on Preview branches and PRs.
- The GitLab relay now treats a missing `GITLAB_API_TOKEN` as a skipped external relay instead of a false project-code failure. The native Preview Quality Gate is the code-validation path.

## Known validation boundary

The previous GitHub Preview Artifact checks were reported as failed, but the connector could not retrieve their expired/unavailable job-log blobs. The new workflow is intended to produce fresh, actionable logs for the complete validation run. A green Pages deployment alone does not prove that provider playback works on a physical iPhone.

# Userscripts integration and static project audit — 2026-11-27

## Scope

- Repositories: `zskbot/clipviet` and `zskbot/clipviet.live`
- Working branch: `preview/jzvd-android-sdk-view-button-20261127`
- Upstream source: `CodeSenbot/UserScripts`
- Preview/source changes only. No Production deployment, DNS/domain edits, secrets, provider data or database writes.
- QA did not depend on GitHub Actions or GitHub-hosted runners.

## Userscripts integration

- Expanded `site/userscripts/index.html` into a curated Browser Tools directory.
- Kept ClipViet Player Tools as an opt-in local userscript.
- Added explicit upstream links for Scroll Button, YouTube Better Volume Control, YouTube Dynamic Video Grid and YouTube Helper.
- Permission notes: Scroll Button declares `@grant none` but matches all websites; the two YouTube layout/volume scripts are YouTube-scoped; YouTube Helper requests `GM_addStyle`.
- The upstream repository also contains unrelated downloader, auto-login, adult-site and broad-network scripts. Those are intentionally not embedded or auto-executed.
- Upstream scripts remain hosted at their source; the page tells users to inspect `@match`, `@grant`, `@require` and the source before installing.

## Defects fixed

1. Removed literal backslash-n text from homepage navigation markup.
2. Fixed Safari fullscreen handling: native iOS fullscreen enter/exit methods are invoked on the actual video element.
3. Fixed the play/pause toast race by waiting for the `video.play()` promise.
4. Expanded editable-target detection to avoid intercepting input, buttons, links and contenteditable controls.
5. Removed page-unload cleanup that could detach the helper UI after Safari restores a page from the back-forward cache.
6. Removed a stray escaped-newline sequence found in `site/admin/index.html`.

## Independent static audit results

- HTML: scanned 35 static HTML pages across both repositories and checked 312 local `href`, `src`, `poster` and `action` references. No missing local targets or path escapes remained after fixes.
- JavaScript syntax: parsed 197 JavaScript/ES-module files across both repositories, including the static site, API routes, Workers, scripts and tests. All 197 passed the syntax pass.
- 27 React JSX page/component files were not included in that parser pass because the independent runtime did not have the project's JSX compiler/transpiler.
- Added `scripts/audit-static-site.mjs` for repeatable local link/markup checks.
- Added `tests/userscripts-safety.test.mjs` for the local userscript's syntax, host restrictions, permissions and curated source links.

## Not yet verified

- `npm test`, `npm run lint`, full Next.js production build and JSX compilation were not run: the independent container could not resolve GitHub to clone the repositories, and no local Node project runtime was available.
- Recent pre-existing GitHub Preview Artifact / GitLab CI checks reported failures; their job-log blobs could not be retrieved, so their exact causes remain unverified. No claim of a fully green CI pipeline is made.
- Browser playback and userscript behavior still need a physical iPhone Safari check with an authorized playable stream.
- Both existing PRs remain unmerged and require conflict review before merge.

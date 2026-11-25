# ClipViet Desktop — Preview

A local desktop companion for downloading media that the operator owns or is explicitly licensed to download and distribute. It uses **N_m3u8DL-RE** as an external executable; the legacy N_m3u8DL-CLI is not bundled.

## Status and safety boundary

- Preview-only source implementation. No production service, DNS, Cloudflare Worker, D1, provider registry, or existing catalogue is modified.
- No provider host is pre-approved. The operator must add each exact media hostname to a local device allowlist and confirm rights for every download.
- HTTPS only; local/private network targets are rejected. Arguments are passed to the executable without a shell.
- No DRM, paywall, authentication bypass, or access-control circumvention is implemented or supported.
- Optional ClipViet integration calls only `GET /api/admin/videos` (read-only). Configure an API base URL and token locally. Token is encrypted with Electron safeStorage when the operating system supports it; it is not committed.
- Downloads run on the desktop machine and are saved locally. Nothing is uploaded or republished to ClipViet.

## Build

Requires Node.js 20+ and a desktop environment.

```sh
cd desktop
npm install
npm start
```

Package locally:

```sh
npm run pack
```

The packaged app does not bundle N_m3u8DL-RE. Install the matching release for your OS from https://github.com/nilaoda/N_m3u8DL-RE/releases and select its executable in the app.

## Preview test checklist

1. Launch the app and choose the N_m3u8DL-RE executable.
2. Optionally configure the ClipViet Preview API URL and read-only admin token; load catalogue to test connectivity.
3. Add an exact media hostname to the local allowlist only after verifying rights and origin.
4. Use a permitted test stream; confirm output remains on the local disk.
5. Confirm a denied host, non-HTTPS URL, missing rights confirmation, and missing executable are rejected.

## Known limitations

- No code signing or auto-updater.
- API integration is read-only and depends on the existing authenticated `GET /api/admin/videos` route; no task is written to the ClipViet server.
- This preview does not claim that a media provider or rights record has been verified.
- Windows/macOS/Linux packaging must be built and tested on the respective operating systems.

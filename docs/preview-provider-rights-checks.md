# ClipViet Provider Rights Preview Gate

This branch is a Preview-only validation lane.

## Build gate
Cloudflare Pages runs:

```sh
node --test tests/maccms-provider.test.mjs tests/provider-registry-rights-migration.test.mjs
npx next build
```

The test suite verifies:
- MacCMS video rows use `ac=detail&pg=1`; `ac=list` is reserved for category metadata.
- Category navigation returns leaf categories (`type_pid != 0`).
- A dollar sign inside a signed media URL is preserved after the first label/URL delimiter.
- Provider endpoints are opt-in and no upstream source is contacted by default.
- D1 provider enablement and external-source playback guards are present.

## Provider configuration
Do not configure a source unless distribution rights have been independently verified and the provider has a current rights record. The default provider list is empty. API hosts must be explicitly allowlisted.

## Playback boundary
Catalog metadata and playback authorization remain separate. No media proxy, crawler, autoplay, or rights bypass is introduced by this branch.

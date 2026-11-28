# Clipform source intake — Preview workflow

Clipform form: https://clipform.io/65f98b051  
GitHub tracking issue: https://github.com/zskbot/clipviet.live/issues/86

## Current operating model

Clipform collects source URLs and rights/API declarations. The form is not currently connected to an automated webhook-to-GitHub integration. An authenticated operator must export or otherwise obtain a supported machine-readable response before running the local normalizer. Do not scrape the Clipform UI or invent an undocumented API endpoint.

The individual-response connector may redact long text/media fields. If URL/evidence fields are redacted, use the Clipform dashboard's supported export or ask the submitter to provide a text-only response. Never infer missing URLs or evidence from a redacted placeholder.

## Normalize a URL list

Create a private UTF-8 text file with one public HTTPS URL per line, then run:

```sh
node scripts/normalize-source-intake.mjs ./source-urls.txt ./artifacts/source-intake/candidates.json
```

The tool:
- makes no HTTP requests and does not crawl any source;
- normalizes hostnames and removes common tracking parameters;
- preserves functional query parameters and deduplicates canonical URLs;
- rejects non-HTTPS URLs, embedded credentials, and secret-like query parameters;
- classifies AppleCMS-shaped paths as candidates only, not verified providers;
- emits one `PENDING_REVIEW` record per candidate;
- hard-codes rights approval, publication, and playback counts to zero.

Keep the input and generated artifact private if they contain non-public source or licensing details. Do not commit API secrets, cookies, access tokens, private stream URLs, or personal contact data.

## Required manual review

For every source, obtain and verify:
1. the provider's official API documentation and identity;
2. written authority to access the API and distribute the relevant content;
3. content-level rights, territory, platform, expiry, and permitted playback/embedding scope;
4. exact API authentication method and credential handling instructions.

Only after those checks may an authorized Preview-only read-only API/schema test be considered. Store credentials only as encrypted Cloudflare Worker Preview secrets. Do not add unknown hosts to an allowlist.

## Status meanings

- `PENDING_REVIEW`: received, not approved.
- `METADATA_ONLY`: metadata display explicitly licensed; no media playback.
- `APPROVED`: provider and individual content rights verified by an authorized reviewer.
- `REJECTED`: insufficient or invalid authority/evidence.
- `UPSTREAM_UNAVAILABLE`: authorized read-only health check failed.

Playback stays OFF until provider-level and per-item rights are verified. This tool does not publish, write to D1, proxy media, or enable playback.

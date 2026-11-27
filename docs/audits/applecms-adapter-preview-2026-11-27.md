# AppleCMS adapter — Preview-only

This module is a pure metadata/fixture adapter. It is not wired to the live catalog route, provider Worker, crawler, or player.

## Implemented
- Validate AppleCMS response envelopes.
- Normalize non-root category rows and deduplicate IDs.
- Map source-scoped metadata IDs and description fallback.
- Parse source lines and episode labels using the final dollar separator.
- Expose episode labels only; media URLs are intentionally discarded.
- Require an explicit approved-provider allowlist. An empty allowlist rejects all providers.
- Treat empty results as valid; fail over only after a thrown provider/API error.

## Safety state
All real providers remain PENDING. No live endpoint is configured or called by this module. Playback remains disabled. The existing API route continues returning the rights-pending response until title-level distribution rights, ownership, performer age, consent, and territory evidence are reviewed and approved.

The reported primary count (130,740) differs from the restoration target (130,921) by 181. The five reported source counts must not be summed without deduplication and rights review.

## Validation
Run npm test in a connected Preview build environment. The new tests use synthetic fixture data and do not contact any provider or media CDN.

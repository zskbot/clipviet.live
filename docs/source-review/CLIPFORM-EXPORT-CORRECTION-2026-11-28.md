# ClipViet intake export correction and CI / Worker build audit

Date: 2026-11-28  
Repository: `zskbot/clipviet.live`  
Scope: documentation-only correction; Preview and production resources were not modified.

## Authoritative Clipform export count

The complete user-supplied CSV and XLSX exports each contain **3 completed submissions**, and the same three records appear in both files. This export-backed count supersedes the earlier Clipform connector aggregate count of 4 used in PR #88.

All three respondents self-declared a written distribution licence. The exports do not contain independently inspectable signed contracts, licence identifiers, proof of rights-holder authority, per-title/content-ID coverage, territory, expiry, or explicit playback / redistribution grants. Repeated URL lists and pasted candidate JSON in free-text fields are not API documentation or rights evidence.

**Use 3 as the verified export-backed submission count.** If a later complete export contains more records, reconcile it as a new dated input rather than silently replacing this count.

## Candidate inventory and gate

The candidate manifest contains 31 unique URLs: 26 website/category candidates and 5 AppleCMS-shaped API candidates. No candidate source endpoint was contacted during this audit.

All 31 remain:
- `intake_status=PENDING_REVIEW`
- `rights_status=PENDING`
- `verification=NOT_CHECKED`
- `metadata_ingest_allowed=false`
- `playback_enabled=false`
- `published=false`

No candidate currently meets the evidence gate for metadata ingestion, embedding, playback, or publication.

## GitHub Actions audit

For PR #88 head commit `cc1c6c83fc4f645ffc9ba0ab4321427cccb10497`:
- Provider rights Preview checks run `46093207648`: failed; job `140818638671` returned no step records.
- OSSAR run `46093207695`: failed; job `140818638770` returned no step records.
- CodeQL Advanced run `46093207629`: failed; both jobs returned no step records.
- Downloading the Provider rights and OSSAR job logs returned GitHub `BlobNotFound` (404). The available evidence does not identify a source-code assertion or a runner error.

Therefore, GitHub Actions CI is **not verified successful**. Do not mark Preview tests complete based on these runs. Retry only when GitHub exposes job steps/logs or a separate reproducible local test run is recorded.

## Cloudflare Worker build audit

Cloudflare's GitHub bot comment for commit `cc1c6c8` reports a failed build for Worker `clipviet-catalog-api-preview`, with no Preview URL. Its dashboard link points to a path containing `/production/builds/`, so the environment label in the bot comment and the dashboard route are inconsistent; the exact environment cannot be confirmed from that comment alone.

Read-only Cloudflare inspection found:
- Worker script `clipviet-catalog-api-preview` exists in account `f9b95733a2be8ca3c74ae17151cd4e30`.
- Its latest deployment in the deployment history was created at `2026-11-27T19:15:54.077990Z`, before the reported failed build on 2026-11-28.
- The Cloudflare Workers Builds list for the script tag returned zero build records, so the failed build's detailed logs were not available through that API query.
- No deployment was created, retried, promoted, or modified during this audit.

This supports the conclusion that **no new Worker deployment is verified from the failed build event**. It does not establish the cause of the failure.

## Required next gates

1. Keep all 31 candidate sources quarantined until provider identity, official API documentation, and content-specific rights evidence are independently inspectable.
2. Correct downstream reporting to the 3-row export-backed count; preserve the earlier 4-row connector aggregate only as a superseded discrepancy.
3. Restore GitHub Actions job-step/log visibility and obtain a successful run for the provider-rights workflow before claiming CI success.
4. Obtain the exact Cloudflare build log from the dashboard or a build record that the API can read. Confirm whether the linked build is Preview or Production before taking any action.
5. Only after the above evidence gates pass, consider a read-only, documented, allowlisted Preview API/schema check. Keep playback and publication disabled until explicit rights cover the exact content and use.

## Change boundary

This correction does not change application code, `main`, Worker code/configuration, D1 data, secrets, DNS, Production deployments, source-site access, metadata ingestion, playback, or publication.

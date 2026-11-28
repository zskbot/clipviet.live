# ClipViet licensed bulk catalog intake

This is a **local review-artifact generator**, not a crawler, publisher, playback proxy, or database writer. It is designed to prepare a large owned/licensed catalog (up to 130,921 input rows) for controlled review.

## Accepted input

- JSON array of objects, or JSON object with an `items` array.
- CSV with a header row.
- Required fields: `title`, `media_url`, `rights_holder`, `license_reference`, `rights_evidence_url`, `license_expires_at`.
- Optional fields: `id`, `description`, `category`, `thumbnail_url`, `source_url`, `allowed_regions`, `playback_allowed`.

All media and evidence URLs must use HTTPS. Media hostnames must match the explicit `CLIPVIET_MEDIA_HOST_ALLOWLIST`. Do not add a hostname unless ClipViet is authorized to distribute/play the media hosted there.

## Run locally

```sh
CLIPVIET_MEDIA_HOST_ALLOWLIST="media.example.org,cdn.example.org" \
CLIPVIET_IMPORT_BATCH_SIZE=1000 \
node scripts/import-licensed-catalog.mjs ./licensed-catalog.csv
```

The default batch size is 1,000; it can be set up to 5,000. Output is written to `artifacts/clipviet-import-review/` as `batch-0001.json`, etc., plus `report.json`. Keep these artifacts private because they may contain media URLs and license evidence references.

## Safety gates

- Every row is initially `PENDING_REVIEW`; the script never approves rights.
- Missing/expired rights evidence, invalid HTTPS URLs, or non-allowlisted media hosts quarantine the row and remove its media URL from the review record.
- Duplicate IDs are counted and skipped.
- The report always records `published: 0`, `playbackEnabled: 0`, and `rightsApproved: 0`.
- The script performs no network requests and no database writes.
- Manual legal/rights review and a separate authorized publishing workflow are required before any video can become public or playable.

A target count of 130,921 is a processing ceiling, not proof that 130,921 licensed records exist. The final accepted count can only be reported after a real authorized dataset has been processed.

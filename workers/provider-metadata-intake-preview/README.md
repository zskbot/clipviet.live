# ClipViet Public Metadata Intake — Preview

Dedicated public Worker for submitting metadata distribution evidence.

- URL: `https://clipviet-metadata-intake-preview.huynhthuongg2505-f9b.workers.dev/metadata-intake`
- Root `/` serves the same form.
- No login, token, API key, cookie or admin secret is required.
- Bound only to `clipviet-provider-registry-preview` D1 using `PROVIDER_DB`.
- `ENVIRONMENT=preview`; no Production route or custom domain is attached.

## Public submission

The form accepts only the five fixed AppleCMS provider IDs and requires a rights holder, license reference, HTTPS evidence URL, HTTPS API documentation URL, future license expiry, territory and explicit metadata-only attestation.

Submissions are stored separately in `provider_metadata_intake` with `PENDING_REVIEW`. They do not mutate the provider registry, connectors, per-video rights ledger, catalog or playback state.

The endpoint rejects arbitrary providers, non-HTTPS evidence, expired licenses and invalid regions. It does not accept or store API credentials, stream URLs, media host allowlists or approval fields.

## Preview D1 migration

Apply `workers/provider-registry/migrations/0006_public_metadata_intake.sql` to the Preview D1 database before enabling submissions. The migration creates only the pending-intake table and index.

## Rights boundary

A public submission is not an approval. A reviewer must independently validate the evidence and complete the existing technical/legal process. Provider catalog visibility remains blocked until a valid metadata-only grant is approved. Playback remains disabled.

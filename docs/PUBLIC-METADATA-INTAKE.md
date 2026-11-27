# Public metadata-only provider intake (Preview)

Public setup page: `/metadata-intake` on the isolated `clipviet-provider-registry-preview` Worker.

## Public workflow

- No account, login, API token, API credential, or browser secret is required to submit a provider's metadata distribution evidence.
- The form only accepts one of the five fixed AppleCMS provider IDs already present in the registry.
- Required fields: rights holder, license reference, HTTPS evidence URL, HTTPS API documentation URL, future expiry date, and allowed region (`VN` or `GLOBAL`).
- The submission is stored in `provider_metadata_intake` with status `PENDING_REVIEW`.
- Public submissions do not create or update `provider_registry`, `provider_connectors`, or `provider_content_rights`; they cannot change provider status or approve any video.
- The intake endpoint does not accept API credentials, media URLs, playback URLs, approval flags, or stream host allowlists.
- No catalog ingestion is started by a submission. A human reviewer must independently verify the evidence and then use the existing technical/legal review workflow.

## API

- `GET /metadata-intake` — public HTML form.
- `POST /metadata-intake` — validates and stores a pending metadata-rights intake.
- Request body is limited to 12 KB; URLs must use HTTPS and may not contain credential-like query parameters.
- `metadataOnlyAttestation: true` is required.
- Response includes only an intake ID, `PENDING_REVIEW`, and `playbackEnabled: false`.

## Deploy / migration

Apply `workers/provider-registry/migrations/0006_public_metadata_intake.sql` to the dedicated Preview D1 database bound as `PROVIDER_DB`, then deploy the branch as a Preview Worker only. Do not bind Production D1, attach a custom domain, or change Production routing.

## Safety boundary

Public intake is intentionally frictionless for evidence submission, not for approval. Technical reachability does not establish distribution rights. Metadata visibility requires a reviewed provider-level metadata license and the existing content-level policy where applicable. Playback remains disabled for every provider and item in this intake flow.

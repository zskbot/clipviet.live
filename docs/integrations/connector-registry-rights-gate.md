# Connector Registry + Rights Verification Gate

## Purpose

The provider registry controls who may connect. The rights gate controls which individual clips may be played, for what use, and in which territory. Provider-level approval never grants blanket rights to every clip returned by an API.

This is an authorization/control plane only. It does not scrape, download, proxy, ingest, or publish video files.

## Components

1. Connector contract — stable connector ID, official documentation URL, auth mode (none, API key, OAuth2, signed request), approved scopes, supported territories and explicit playback mode.
2. Provider registry — existing D1 registry and state machine: PENDING → VERIFIED → APPROVED → ENABLED.
3. Per-clip rights ledger — migration 0003_content_rights_gate.sql records source platform/content ID, canonical source URL, creator, rights holder, license evidence, expiry, permitted uses, territories, provenance and performer age/consent attestations.
4. Playback decision — deterministic policy requires both provider ENABLED and clip rights APPROVED, unexpired licenses, exact permitted use, allowed territory, verified source/ownership and age/consent flags.

## Connector contract

Use validateConnectorContract() from workers/provider-registry/src/rights-gate.mjs. The connector must declare:
- connectorId: stable lower-case identifier.
- documentationUrl: official HTTPS documentation, without credentials in query parameters.
- authMode: none, api_key, oauth2 or signed_request.
- scopes: only scopes approved by the platform.
- regions: explicit supported regions (VN, CN, KR, OTHER, GLOBAL).
- playbackMode: official_embed, owner_hosted_stream, metadata_only or none.

Metadata-only search APIs cannot claim stream or redistribution rights by implication. The connector registry is not a secret store; API credentials continue to use the existing encrypted credential path and must never appear in browser code or logs.

## Per-clip review requirements

A content-rights record must identify the exact source item and include:
- canonical HTTPS source URL, source platform and stable source content ID;
- creator and rights holder;
- written license/evidence reference and expiry;
- explicit permitted use (official_embed, owner_hosted_stream, redistribute);
- explicit territory allowlist;
- provenance and ownership verification;
- performer age and consent verification.

The legal reviewer must independently inspect the evidence and attach review references before approval. A checkbox or API response alone is not legal evidence. If any field is missing, expired, disputed or unverifiable, the record remains PENDING or is rejected/revoked.

## Playback policy

playbackDecision() returns a deny-by-default decision. Playback is allowed only if:
- provider status is ENABLED;
- exact clip status is APPROVED;
- provider and clip licenses are both unexpired;
- requested use is explicitly licensed for the clip;
- requested territory is covered by the clip license;
- provenance, ownership, age and consent checks are all true.

The result returns the original source URL and declared playback mode, not a downloaded or proxied media URL. A caller must still use the source platform's approved player/embed flow. metadata_only and none connectors must never be used as direct media streams.

## Preview API routes

- GET /providers/:providerId/connector — list the provider connector contract (review roles only).
- POST /providers/:providerId/connector — register a connector contract (admin; starts PENDING).
- PATCH /providers/:providerId/connector/approve — approve official documentation, scopes and playback mode (legal reviewer; provider must already be VERIFIED).
- PATCH /providers/:providerId/connector/disable — immediately disable a connector (admin or legal reviewer; reason required).
- GET /providers/:providerId/content-rights — list clip-level rights records (review roles only).
- POST /providers/:providerId/content-rights — register an exact source clip and its rights evidence (admin; starts PENDING).
- PATCH /providers/:providerId/content-rights/:contentId/approve — legal approval with evidence references.
- PATCH /providers/:providerId/content-rights/:contentId/revoke — revoke clip rights immediately (admin or legal reviewer; reason required).
- GET /playback/authorize?providerId=...&contentId=...&use=...&region=... — deny-by-default authorization decision; returns the original source URL and allowed playback mode, never a proxied media URL.

All routes are Preview-only, role-protected and use no-store responses. The legal reviewer must independently inspect all evidence.

## State and safety

- Provider API reachability is not proof of rights.
- Public visibility, a playable URL, or a search result is not a redistribution license.
- Adult material requires independent age and consent verification for every relevant performer and source item; do not ingest material involving minors, non-consensual recordings, leaks or uncertain provenance.
- Rights expiry, complaint, takedown or dispute must deny playback immediately. A revoked/rejected item cannot be made playable by provider-level approval.
- No automatic provider activation, no automatic content publication and no global Internet scraping.
- This branch adds the connector contract endpoints, clip-level rights endpoints, deterministic playback decision, D1 schema and test coverage. The Preview Worker entrypoint is routed through rights-entry.mjs, which delegates existing provider routes to the current registry Worker. Apply migration 0003 only to a dedicated Preview D1 database before API-level end-to-end testing. No database or Worker is provisioned/deployed by this code-only PR.

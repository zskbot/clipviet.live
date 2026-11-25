# Qwen2.5-Sex provider — staging integration

## Scope

This change adds a server-side provider status adapter for
[ystemsrx/Qwen2.5-Sex](https://huggingface.co/ystemsrx/Qwen2.5-Sex).
It does **not** download model weights, host inference, or send user prompts to a
third party. The provider is disabled unless explicitly configured.

The model card describes this as a Qwen2.5-1.5B-Instruct fine-tune trained on
erotic literature and sensitive datasets, says its training data is primarily
Chinese, and labels it not-for-all-audiences / research and testing only.
Hugging Face currently lists no hosted inference provider for this model.
The published model files are several gigabytes, so model hosting is a separate
infrastructure decision and may incur compute/storage costs.

## Preview environment variables

Set these only in a dedicated Preview/Staging environment after selecting a
trusted, authorized inference host:

- `QWEN25_SEX_ENABLED=false` (default; keep false until review is complete)
- `QWEN25_SEX_API_URL=` (must be HTTPS; leave empty until a host exists)
- `QWEN25_SEX_API_KEY=` (server-side secret; never put in browser variables)

Do not place credentials in Git, source code, client-side bundles, or chat.
No environment variables are required for the disabled status endpoint.

## Status endpoint

`GET /api/ai/qwen-sex/status`

Returns provider configuration state without exposing endpoint credentials or
API keys. It never invokes inference.

## Product safeguards

- This integration is not an adult-content generation feature.
- Generation remains disabled; the status endpoint is informational only.
- Do not process sexual content involving minors, non-consensual sexual content,
  exploitation, or illegal material.
- Any content-risk result must be advisory and reviewed by a human; the model
  must never grant admin access, approve uploads, or override platform policy.
- Keep the existing 18+ gate; self-attestation is not identity or age verification.
- Only ingest and stream media with documented distribution rights and consent.

## Validation

Run `npm test`, `npm run lint`, and `npm run build` in CI.
The unit tests verify default-off behavior, HTTPS enforcement, and that secrets
are not returned in the status payload.

## Not included

- Model weight download or hosting
- Hugging Face Inference Endpoint provisioning
- GPU/CPU capacity allocation or billing
- Prompt/completion proxy
- Production environment changes or deployment

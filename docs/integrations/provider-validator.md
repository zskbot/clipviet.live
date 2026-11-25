# Admin Provider Validator

## Scope

The Admin validator is a browser-side, opt-in diagnostic for a provider endpoint supplied by an operator. It does not register, enable, publish, scrape, embed, proxy, download, or persist a provider.

## Checks performed

1. Requires HTTPS and exact hostname allowlists for API and media. Thumbnail hosts have a separate exact allowlist.
2. Rejects URL userinfo, custom ports, IP-literal hosts, reserved local/test hostnames, and common credential query parameters.
3. Sends a GET request with `credentials: omit`, `redirect: error`, `cache: no-store`, and a 15-second timeout. Cross-origin providers must explicitly permit browser CORS.
4. Requires a JSON content type and limits the response body to 1 MiB. The normalized response must contain an array or `results`, `videos`, or `data` array, with no more than 100 records.
5. Validates every returned media URL against the media allowlist and every poster URL against the poster allowlist.
6. Probes at most three media URLs with `Range: bytes=0-0`, a 10-second timeout, no cookies, and redirects rejected. It expects HTTP 206 and a video/HLS-compatible MIME type. The response body is cancelled immediately.

## Security boundaries and limitations

- This is a browser-side check, not a server-side security boundary. It does not resolve DNS, prove that an origin is safe, prevent DNS rebinding at a backend, or replace server-side egress controls.
- Browser CORS policy can prevent otherwise valid endpoints from being inspected. A failed CORS request is not proof that the provider is malicious.
- A provider may behave differently for other records, regions, users, or playback sessions. Only up to three media URLs are probed.
- Range behavior and MIME headers are indicators, not proof that the complete asset plays correctly in every browser.
- The rights checkbox is an operator attestation, not legal verification or age/consent verification.
- The provider token is cleared from the input after the check and is not written to localStorage. It is still sent to the endpoint supplied by the operator; only enter credentials issued for that provider.
- The existing API Connection section is separate and retains its prior device-local settings behavior. The new validator does not import or activate those settings.
- Do not put secrets in URL query strings. Do not use this browser tool to test sources without authorization.

## Activation gate

A technical pass is not an activation approval. A production provider still requires documented distribution rights, verified age/consent safeguards where applicable, server-side secret handling, server-side hostname/DNS/IP egress validation, schema validation at the backend, logging and rate limits, and an isolated Preview acceptance test. Provider activation remains disabled in this implementation.

## Manual Preview test matrix

- Valid HTTPS JSON API with CORS and exact allowlists: schema checks should pass.
- HTTP URL, IP literal, custom port, unlisted hostname, or redirect: reject.
- HTML response, invalid JSON, oversized response, or more than 100 items: reject.
- Media URL outside its allowlist or poster URL without a poster allowlist: reject.
- Media endpoint returning 200 instead of 206, redirecting, timing out, or returning a non-media MIME type: reject.
- Missing rights attestation: stop before network request.
- Confirm the token input is empty after completion and no provider record is saved or enabled.

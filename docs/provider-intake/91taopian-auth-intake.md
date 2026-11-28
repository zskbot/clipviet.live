# 91Taopian provider API and authentication intake

Status: PENDING_REVIEW
Target: isolated ClipViet Preview only
Website supplied: https://www.91taopian.com

This is a provider-completed integration intake. It is not an assumption that the website exposes an API. Do not probe hidden routes, scrape pages, infer API hosts, or reuse similarly named third-party endpoints.

## A. Provider identity and authority
- Legal entity / rights holder:
- Official technical contact and role:
- Official contact email on the provider's domain:
- API documentation URL (provider-controlled):
- Written authorization / contract reference:
- Authorized ClipViet use: metadata discovery / official embed / direct owner-hosted playback (select only what is explicitly granted):
- Authorized territories:
- Effective date and expiry:
- Takedown / rights complaint contact and SLA:

## B. API contract
- Exact HTTPS API base URL:
- Fixed API path(s) for category and metadata listing:
- Detail endpoint and stable content ID field:
- Pagination parameters and maximum page size:
- Rate limits and retry guidance:
- Response content type and example redacted JSON:
- CORS requirements (if browser access is explicitly intended):
- Permitted API hostnames:
- Permitted embed hostnames (if officially supported):
- Permitted media hostnames (only if direct playback is licensed):
- Test/sandbox endpoint and test content ID:

## C. Authentication contract — do not enter secret values here
Select exactly the provider-documented method:
- [ ] No authentication
- [ ] API key in request header (provide header name only):
- [ ] OAuth 2.0 client credentials (token URL, scopes, expiry):
- [ ] Signed request (algorithm, canonicalization, timestamp/nonce rules):
- [ ] Other (document exact protocol):

Also provide:
- Credential owner and issuing portal:
- Minimum required scopes/permissions:
- Token/key expiry and rotation procedure:
- IP allowlisting requirements:
- Revocation procedure:
- Whether credentials are restricted to metadata only or also permit playback:

Never put API keys, bearer tokens, client secrets, cookies, private signing keys, or session values in this document, GitHub issues, source code, browser JavaScript, or chat. Secrets must be entered directly by an authorized operator into Cloudflare Worker Preview encrypted Secrets after the provider contract is verified.

## D. Rights and content-level controls
For every item proposed for import, the provider must supply:
- Stable source content ID and canonical source page;
- Rights holder and license reference;
- Evidence URL/document reference;
- Explicit permitted uses (metadata, thumbnail, embed, direct playback, redistribution);
- Territory and license expiry;
- Source ownership verification;
- Performer age and consent verification where applicable;
- Takedown status/contact.

A provider-level API key or metadata feed does not itself grant rights to publish or play any title.

## E. Preview-only acceptance sequence
1. Review provider-controlled API docs and written authorization.
2. Validate the API host against the exact documented hostname; do not follow redirects to unapproved hosts.
3. Add only the documented auth scheme to the server-side adapter. Keep credential material in Cloudflare Worker Preview encrypted Secrets; never copy Production values.
4. Run one bounded, read-only authentication health request with a short timeout and redacted diagnostics.
5. Validate one provider-authorized test response against the documented schema. Do not fetch media bytes during this step.
6. Add source-level rights evidence and individual content rights records through the existing review process.
7. Test playback only with a provider-supplied test item that is explicitly licensed for ClipViet, and only after both provider and item approvals pass.
8. Keep Production, main, DNS, custom domains, and public playback unchanged until separately approved.

## F. Current decision
No API base URL, auth mode, credential name, provider adapter, or playback capability has been configured for 91taopian.com. The website URL alone is insufficient to establish any of those facts. Registry state remains PENDING_REVIEW, rights remain PENDING, and playback remains disabled.
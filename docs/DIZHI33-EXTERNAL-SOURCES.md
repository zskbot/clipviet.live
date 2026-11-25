# External sources integration — dizhi33.github.io

## Summary
This preview adds a separate static review page at `/sources.html` for the external address-directory repository `zskbot/dizhi33.github.io`.

## Why the upstream scripts are not copied
The upstream `publish.js` constructs randomized subdomains from a list of unrelated domains and presents external 91PORN destinations. The repository does not provide a clear license for reuse. Copying its scripts or activating those destinations would introduce unreviewed third-party navigation, tracking, and rights/safety risks.

## Preview behavior
- Adds a visible navigation entry to the review page.
- Does not embed upstream JavaScript, CSS, images, or third-party trackers.
- Does not automatically redirect or load external media.
- Keeps all external source URLs disabled pending per-domain review.
- States minimum checks for rights to distribute, consent/privacy, age controls, safe external-link handling, and clear destination disclosure.

## Before enabling any external source
1. Confirm the operator controls the domain and has authority to publish it.
2. Review content provenance, consent, privacy, copyright, and applicable local law.
3. Verify every destination individually; do not use randomized or rotating domains.
4. Add a source through a reviewed server-side allowlist and admin workflow.
5. Test age handling, link rel attributes, CSP, abuse reporting, and takedown handling.
6. Obtain an explicit approval before enabling the source in production.

GitHub Pages is static hosting and cannot enforce server-side access control or reliable identity/age verification. The current page is an informational review screen, not an age-verification mechanism.

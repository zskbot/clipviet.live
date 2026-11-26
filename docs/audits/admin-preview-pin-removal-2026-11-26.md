# Admin Preview PIN Removal — 2026-11-26

## Scope
- Remove the six-digit PIN login form and browser-side PIN/session verification flow from the Admin Preview UI.
- Open the workspace directly with an explicit Preview-only notice.
- Keep privileged Admin controls inert in the browser.
- Clear any legacy `clipviet.admin.session.v1` sessionStorage token when the CMS module loads.

## Server-side protection
- Worker-side session validation and authorization for privileged Admin/CMS API routes remain unchanged.
- No Worker Secrets, D1 schema/data, provider activation, DNS/custom domains, or Production deployment settings are changed.

## Validation status
- Static source checks confirm the PIN login gate and form are absent.
- Preview deployment and browser runtime checks must be completed before this change is considered verified.

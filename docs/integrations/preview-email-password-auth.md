# ClipViet Preview email/password authentication

## Scope

This change adds a dedicated email/password login to the isolated provider-registry Preview Worker. It does not modify Production, DNS, Pages routing, provider rights, or media host allowlists.

The login accepts a Gmail address as the account identifier and a ClipViet-specific password. It does **not** authenticate against Google and must never request or store a Google account password.

## Security model

- Passwords are derived with PBKDF2-HMAC-SHA-256 (310,000 iterations) and a per-user 16-byte random salt.
- Sessions use 256-bit random opaque tokens. Only SHA-256 token digests are stored in D1.
- Session cookie is Secure, HttpOnly, SameSite=Strict, Path=/, with a 12-hour expiry.
- Login failures are rate-limited per email/IP-derived bucket.
- No public self-registration is exposed. The first administrator is created through the one-time bootstrap flow.
- API authorization resolves the session role before the legacy Cloudflare Access JWT / technical-token fallback.
- Authentication responses are no-store and the login page has a restrictive CSP.

## Required Preview configuration

1. Apply `workers/provider-registry/migrations/0005_preview_auth.sql` to the dedicated Preview D1 database only.
2. Configure Worker secret `AUTH_BOOTSTRAP_TOKEN` using Cloudflare's secret manager. Never commit or paste it into source control.
3. Deploy the Preview Worker bundle with the existing `PROVIDER_DB` binding.
4. Keep Cloudflare Access in place during initial rollout. Validate bootstrap, sign-in, sign-out, expiry and protected API access from a real browser session.
5. Only after the owner confirms the new login works, remove the Cloudflare Access gate from this Preview hostname. Do not alter any Production Access application.

## First administrator

Open `/login`. If no user exists, the page shows the one-time setup form. Enter the intended Gmail address, a unique ClipViet password (12+ characters), and the Worker bootstrap token. After creation, the bootstrap endpoint refuses further account creation.

The Gmail address is currently a login identifier only. This release does not send email verification or password-reset messages. Do not claim mailbox ownership has been verified. Add a verified transactional email provider and a reviewed recovery flow before enabling self-service password reset or inviting more users.

## Validation checklist

- [ ] D1 migration applied to Preview database only.
- [ ] `AUTH_BOOTSTRAP_TOKEN` configured as a Worker secret.
- [ ] First admin bootstrap succeeds once; second bootstrap is rejected.
- [ ] Wrong password returns generic error and rate limit activates.
- [ ] Session cookie has Secure, HttpOnly and SameSite=Strict.
- [ ] Authenticated user can open `/admin`, `/health`, and provider diagnostics.
- [ ] Logout revokes the session and protected APIs return 401.
- [ ] All five providers remain PENDING; media allowlists remain empty.
- [ ] Production deployment lock and rollback remain unchanged.

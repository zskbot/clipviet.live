# Video embed and source security

The player uses a deny-by-default host policy. A URL being reachable over HTTPS does not establish ownership, distribution rights, or permission to embed it.

## Runtime allowlists

Configure comma-separated, exact hostnames in the server environment:

- `VIDEO_API_ALLOWED_HOSTS`: hosts allowed for `VIDEO_PROVIDER_API_URL` and the Admin Video API endpoint.
- `VIDEO_MEDIA_ALLOWED_HOSTS`: hosts allowed to serve direct MP4, WebM, or HLS media URLs.
- `VIDEO_EMBED_ALLOWED_HOSTS`: additional exact hosts allowed to serve embed players.

Do not include schemes, paths, wildcards, or parent domains. Example values:

```dotenv
VIDEO_API_ALLOWED_HOSTS=api.example.com
VIDEO_MEDIA_ALLOWED_HOSTS=cdn.example.com,stream.example.net
VIDEO_EMBED_ALLOWED_HOSTS=player.example.org
```

The official embed hosts enabled by default are `youtube-nocookie.com`, `www.youtube-nocookie.com`, `player.vimeo.com`, and `www.dailymotion.com`, with provider-specific player paths. Any additional embed host must be explicitly allowlisted. Direct media and API hosts have no defaults.

## Containment behavior

- Public Telegram posts remain visible as metadata/source links but their iframe embeds are disabled until rights and safety review is complete.
- Player iframes are sandboxed without popup or top-navigation permissions and use `no-referrer`.
- Generic provider, official provider, Telegram source, CMS, and Admin API requests reject HTTP redirects; Admin browser requests also omit cookies.
- Browser-native media playback may follow redirects issued by the allowlisted media host; the player cannot reliably inspect cross-origin redirect targets. A strict redirect guarantee would require a controlled media proxy.
- Direct media URLs require an exact media host allowlist. HTTPS alone is not sufficient.
- CMS publishing still requires rights holder, license reference, a future expiry date, and an approved embed URL.
- External source links require an explicit user click and use safe new-tab rel attributes.

The static GitHub Pages admin uses device-local exact host lists in browser storage; it does not inherit server environment variables. Its API/media allowlists must be entered explicitly on that device. This is a local safety gate, not proof of content rights.

## Verification

Run `npm test` and `npm run lint`. CI/Preview status must be checked independently; a green unit test does not prove provider rights or production playback.

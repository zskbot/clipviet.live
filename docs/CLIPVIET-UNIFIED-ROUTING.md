# ClipViet unified routing — Preview only

## Ownership

- `zskbot/clipviet` is the public-facing frontend source.
- `zskbot/clipviet.live` supplies docs, admin and secondary modules.
- Cloudflare Workers provide path routing and the Access-protected video metadata CMS.
- Cloudflare D1 stores Preview metadata. The existing OpenNext R2 cache bucket is not a media bucket.
- GitLab CI validates source; it is not the public website origin.

## Preview path map

| Path | Destination | Access |
|---|---|---|
| `/` | Primary Pages Preview from `zskbot/clipviet` | Public |
| `/docs` | Secondary repo API docs | Public |
| `/video` | Published video library | Public |
| `/tag` | Published video tags | Public |
| `/group` | Published video groups | Public |
| `/api/videos`, `/api/tags`, `/api/groups` | D1-backed public CMS API | Published records only |
| `/api/catalog/*` | Secondary Pages Functions rights gate | Deny by default |
| `/admin/*` | D1 metadata CMS | Cloudflare Access MFA |
| `/upload/*` | Disabled | No dedicated video R2 bucket |

## Metadata lifecycle

1. Admin creates or edits a draft in D1 Preview.
2. Rights review records an HTTPS evidence URL and review notes.
3. Publishing is allowed only after rights status is approved and the video host is in `MEDIA_HOST_ALLOWLIST`.
4. Public APIs return only published records.
5. Binary upload remains disabled until a dedicated R2 video bucket is approved and provisioned.

## Safety

- Preview Worker has only a `workers.dev` hostname; no zone route or custom domain.
- Do not attach `clipviet.live`, change DNS, promote Pages, or deploy Production.
- Admin is protected by Cloudflare Access; no PIN is embedded in source.
- Do not reuse `clipviet-live-opennext-cache` for media files.
- External provider catalog stays disabled until provider-level and per-video rights are verified.

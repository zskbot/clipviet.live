# ClipViet unified routing — Preview only

## Ownership

- `zskbot/clipviet` is the public-facing frontend source.
- `zskbot/clipviet.live` supplies the documentation and secondary modules.
- Cloudflare Workers provide the Preview path gateway and read-only catalog API.
- GitLab CI verifies source changes; it is not the public website origin.

## Preview path map

| Path | Preview destination | Access |
|---|---|---|
| `/` | Primary Pages frontend | Public |
| `/docs` | Secondary repository API documentation | Public |
| `/video` | Secondary video module | Public |
| `/tag` | Tag/category module | Public |
| `/group` | Group/category module | Public |
| `/api/catalog/*` | `clipviet-catalog-api-preview` | Read-only |
| `/admin/*` | Locked until Access + metadata CMS acceptance | Restricted |
| `/upload/*` | Disabled until a dedicated video storage bucket is approved | Disabled |

## Video update lifecycle

The current Preview can read provider metadata through the read-only catalog Worker. It does not write catalog records and does not upload video bytes. The existing R2 bucket is an OpenNext cache bucket, not a video bucket. Do not bind it to video uploads.

Before enabling writes, create a dedicated Preview metadata workflow with Cloudflare Access JWT validation, rights evidence fields, audit records, and a separate video storage decision. Public publishing must remain deny-by-default until distribution rights are verified.

## Safety

- This branch and Worker are Preview-only.
- Do not attach `clipviet.live` or change DNS/Worker routes.
- Do not deploy or promote Production.
- Do not expose the static admin utility as a privileged CMS.
- Do not use the existing cache bucket for media uploads.

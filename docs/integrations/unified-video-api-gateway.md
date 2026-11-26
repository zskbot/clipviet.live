# Unified Video API Gateway

## Canonical contract
ClipViet frontend uses one read-only endpoint:

- `GET /api/videos?page=1&limit=30&keyword=...`
- `GET /api/videos?id=...` (404 until the item exists in the rights-approved catalog)

The response normalizes catalog pagination and exposes the provider registry status without leaking credentials. `/api/catalog/videos` remains a legacy compatibility route during migration.

## Provider adapters
The current five AppleCMS API candidates are represented by stable IDs:

| ID | Role | State |
|---|---|---|
| `souavzy` | Primary | PENDING |
| `apiyutu` | Backup 1 | PENDING |
| `lbapi9` | Backup 2 | PENDING |
| `slapibf` | Backup 3 | PENDING |
| `jipinvip1` | Backup 4 | PENDING |

No source-specific authorization, distribution license, or approved per-video rights records were supplied in the source intake. Therefore all adapters are disabled, configured=false, rightsApproved=false, and the gateway makes no upstream requests. The API currently returns an empty normalized catalog with `pending=true`.

The previously supplied website URLs are source candidates, not documented API contracts. They are not scraped, crawled, proxied, or converted into API adapters by this change.

## Rights gate before enabling any adapter
1. Verify official API documentation, endpoint contract, ownership, scopes and credential handling.
2. Record a written license for the exact video and intended display/embed/distribution use.
3. Verify creator/rights-holder provenance, adult age and informed consent where applicable, territory, expiry and takedown path.
4. Obtain independent review and record provider-level approval plus per-video approval.
5. Enable only the approved connector and exact media/embed hosts; keep deny-by-default for everything else.

Provider approval alone never grants rights to every item returned by that provider. Metadata-only connectors cannot be used as media streams. No downloading, rehosting, generic proxying or stream relaying is implemented.

## Deployment boundary
This change is Preview-only. Do not enable Production deployments, attach `clipviet.live`, modify DNS, change D1, or activate any provider as part of this rollout.


Preview deployment trigger: branch is explicitly allowlisted in `clipviet-live-independent-preview`; verify the resulting deployment is tagged `preview` before testing. Production deployment remains disabled.

## Legacy frontend compatibility
The Pages Function accepts both canonical and existing frontend parameters:

- Search: `q`, `keyword`, or `search`
- Category: `category` and `categoryId`
- Page: `page` or `currentPage`
- Page size: `limit`, `pageSize`, or `per_page`

Canonical parameters take precedence when both forms are present. The response retains both `results` and `items`, along with `page`, `limit`, `total`, `pageCount`, and `hasMore`. Invalid pagination or overlong filters return HTTP 400; unknown IDs return 404; unsupported methods return 405 with an `Allow` header. HEAD returns headers without a body and OPTIONS advertises the supported methods.

The Preview runtime tests exercise the Pages Function handler directly. They do not imply that the public `api.clipviet.live` hostname is configured or available.

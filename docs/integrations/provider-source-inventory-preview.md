# ClipViet provider source inventory — Preview only

## AppleCMS API candidates

| Provider ID | API endpoint | State |
| --- | --- | --- |
| souavzy | https://api.souavzy.vip/api.php/provide/vod/ | PENDING_RIGHTS |
| apiyutu | https://apiyutu.com/api.php/provide/vod/ | PENDING_RIGHTS |
| lbapi9 | https://lbapi9.com/api.php/provide/vod/ | PENDING_RIGHTS |
| slapibf | https://slapibf.com/api.php/provide/vod/ | PENDING_RIGHTS |
| jipinvip1 | https://jipinvip1.com/api.php/provide/vod/ | PENDING_RIGHTS |

Use `ac=list` for catalog/category listing and `ac=detail&ids=<vod_id>` for a selected item's detail. Metadata must pass provider and per-title rights approval. Playback is separate and remains disabled unless independently approved.

## User-supplied website references

These URLs are external references only: hsex.men listing pages and sort variants; sexonline.blog; sexvn.co/sex-trung-quoc; buomtv.biz homepage/video/latest/discover/category pages; xnhau.plus homepage/genres/channels/latest clips; viet69.be homepage/articles/tags; javhay.onl/vi-vn; 3lg7zcu3.garymorgan3490.icu; tb7nri7d.91tao.us.ci; 1dwa60ri.taopian91.us.ci; b8rwrbxc.shanxiuyigdd.icu; www.91taopian.com.

These HTML pages are not documented APIs. This Preview does not crawl, scrape, reverse-engineer hidden endpoints, embed, proxy, download, or play them. Obtain official API documentation and written authorization before adding an adapter.

## Empty catalog behavior

`GET /api/videos` now aggregates only configured AppleCMS providers whose provider rights are approved, and only items with per-title metadata approval. It returns `catalogState`, provider statuses and a clear explanation when no items are eligible. No demo items are injected. Metadata approval alone never enables playback.

## Preview acceptance

- Confirm catalog listing uses `ac=list` and detail uses `ac=detail&ids=...`.
- Keep all five providers pending until licensing and provenance are reviewed.
- Confirm the catalog API distinguishes rights-pending, provider errors and a genuinely empty result.
- Confirm no upstream media URL or credential is exposed in metadata.
- Keep Preview isolated from Production, custom domains and DNS.

const IA_ENDPOINT = "https://archive.org/advancedsearch.php";
const BASE_QUERY = "collection:prelinger AND mediatype:movies AND licenseurl:http*publicdomain*";
const FIELDS = ["identifier","title","date","year","creator","description","subject","licenseurl","runtime"];
const PAGE_SIZE_DEFAULT = 30;
const MAX_PAGE_SIZE = 50;
const EXCLUDED_AGE_LABEL = /(?:under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy)|học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên)/i;

function json(data, status = 200, method = "GET") {
  return new Response(method === "HEAD" ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=180",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}
function cleanText(value, max = 2000) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim().slice(0, max);
}
function licenseValue(value) {
  return (Array.isArray(value) ? value : [value]).map(x => String(x || "").trim()).filter(Boolean);
}
function mapItem(doc) {
  const identifier = String(doc.identifier || "").trim();
  const title = cleanText(doc.title, 240);
  const licenses = licenseValue(doc.licenseurl);
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(identifier) || !title ||
      !licenses.some(value => /publicdomain/i.test(value))) return null;
  const yearMatch = String(doc.year || doc.date || "").match(/\b(18|19|20)\d{2}\b/);
  const description = cleanText(doc.description, 2000);
  if (EXCLUDED_AGE_LABEL.test([title, description, doc.subject].flat().join(" "))) return null;
  return {
    id: identifier,
    uid: "internet-archive:" + identifier,
    title,
    description,
    poster: "https://archive.org/services/img/" + encodeURIComponent(identifier),
    categoryName: "Prelinger Archives",
    category: "Prelinger Archives",
    year: yearMatch ? yearMatch[0] : "",
    duration: cleanText(doc.runtime, 40),
    sourceId: "internet-archive-prelinger",
    sourceName: "Internet Archive · Prelinger Archives",
    sourceUrl: "https://archive.org/details/" + encodeURIComponent(identifier),
    licenseLabel: "Public Domain (uploader-declared)",
    badgeLabel: "PUBLIC DOMAIN",
    licenseUrl: licenses[0],
    apiManaged: true,
    playbackEnabled: false,
    playbackRightsApproved: false,
    rightsStatus: "METADATA_ONLY",
    lines: []
  };
}
function safeKeyword(value) {
  return String(value || "").trim().slice(0, 100).replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}
async function fetchPage(page, limit, keyword) {
  const url = new URL(IA_ENDPOINT);
  url.searchParams.set("q", BASE_QUERY + (keyword ? ' AND "' + keyword.replace(/"/g, "") + '"' : ""));
  for (const field of FIELDS) url.searchParams.append("fl[]", field);
  url.searchParams.set("rows", String(limit));
  url.searchParams.set("page", String(page));
  url.searchParams.append("sort[]", "publicdate desc");
  url.searchParams.set("output", "json");
  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("Internet Archive HTTP " + response.status);
  const payload = await response.json();
  const responseData = payload && payload.response;
  if (!responseData || !Array.isArray(responseData.docs)) throw new Error("Invalid Internet Archive Advanced Search response");
  const items = responseData.docs.map(mapItem).filter(Boolean);
  return {
    items,
    total: Math.max(0, Number(responseData.numFound) || 0),
    page,
    limit,
    pageCount: Math.ceil(Math.max(0, Number(responseData.numFound) || 0) / limit)
  };
}
export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: "GET, HEAD, OPTIONS" } });
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405, request.method);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/api/catalog/categories") {
    return json({
      data: [{ id: "prelinger", name: "Prelinger Archives · Public Domain" }],
      count: 1,
      source: "Internet Archive"
    }, 200, request.method);
  }
  if (path !== "/api/catalog/videos") return json({ error: "Catalog route not found" }, 404, request.method);
  const rawPage = url.searchParams.get("page") || "1";
  const rawLimit = url.searchParams.get("limit") || "30";
  if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit)) return json({ error: "Invalid pagination" }, 400, request.method);
  const page = Math.max(1, Math.min(100000, Number(rawPage) || 1));
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(rawLimit) || PAGE_SIZE_DEFAULT));
  const keyword = safeKeyword(url.searchParams.get("keyword") || url.searchParams.get("q"));
  try {
    const result = await fetchPage(page, limit, keyword);
    return json({
      success: true,
      source: "Internet Archive · Prelinger Archives",
      licenseFilter: "uploader-declared Public Domain",
      items: result.items,
      total: result.total,
      page: result.page,
      limit,
      pageCount: result.pageCount,
      rightsGate: {
        policy: "metadata-only",
        metadataLicenseFilter: "publicdomain",
        playbackEnabled: false,
        playbackRightsApproved: false
      }
    }, 200, request.method);
  } catch (error) {
    return json({
      success: false,
      error: "Không thể tải catalog Public Domain từ Internet Archive.",
      detail: String(error?.message || "upstream unavailable"),
      items: [], total: 0, page, limit, pageCount: 0,
      rightsGate: { policy: "metadata-only", playbackEnabled: false }
    }, 502, request.method);
  }
}

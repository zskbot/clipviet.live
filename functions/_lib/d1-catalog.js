// D1-backed Preview catalog. No upstream requests are made here.
const json = (data, status = 200, method = "GET") => new Response(
  method === "HEAD" ? null : JSON.stringify(data),
  { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } }
);
const parseArray = value => {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : []; }
  catch { return []; }
};
const safeHttps = value => {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.toString() : ""; }
  catch { return ""; }
};
const mediaAllowed = (value, env) => {
  const url = safeHttps(value);
  if (!url) return "";
  const hosts = String(env.MEDIA_HOST_ALLOWLIST || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return hosts.some(allowed => host === allowed || host.endsWith("." + allowed)) ? url : "";
  } catch { return ""; }
};
const mapVideo = (row, env) => {
  const demo = Number(row.is_demo) === 1 || String(row.id).startsWith("demo-cv-");
  const approved = row.rights_status === "approved";
  const videoUrl = demo ? "" : (approved ? mediaAllowed(row.video_url, env) : "");
  const posterUrl = demo ? "" : (approved ? mediaAllowed(row.poster_url, env) : "");
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description || "",
    videoUrl, posterUrl, tags: parseArray(row.tags_json), groups: parseArray(row.groups_json),
    status: row.status, rightsStatus: row.rights_status, isDemo: demo,
    playbackEnabled: Boolean(videoUrl && approved && !demo),
    createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at || null
  };
};
async function rows(env, { admin = false } = {}) {
  if (!env?.DB) throw new Error("Preview D1 binding DB is unavailable");
  const sql = admin
    ? "SELECT * FROM clipviet_videos ORDER BY updated_at DESC, id ASC LIMIT 500"
    : "SELECT * FROM clipviet_videos WHERE status = 'published' AND (is_demo = 1 OR rights_status = 'approved') ORDER BY published_at DESC, created_at DESC LIMIT 500";
  const result = await env.DB.prepare(sql).all();
  return (result.results || []).map(row => mapVideo(row, env)).filter(item => item.isDemo || (item.rightsStatus === "approved" && item.videoUrl));
}
export async function videosResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed", allow: ["GET", "HEAD"] }, 405, request.method);
  const url = new URL(request.url), all = await rows(env);
  const id = url.searchParams.get("id");
  if (id) {
    const item = all.find(x => x.id === id || x.slug === id);
    return item ? json({ success: true, data: item, item, pending: item.isDemo || !item.playbackEnabled }, 200, request.method)
      : json({ success: false, error: "Video not found", code: "VIDEO_NOT_FOUND" }, 404, request.method);
  }
  const q = (url.searchParams.get("q") || url.searchParams.get("keyword") || url.searchParams.get("search") || "").trim().toLocaleLowerCase("vi");
  const tag = (url.searchParams.get("tag") || "").trim().toLocaleLowerCase("vi");
  const group = (url.searchParams.get("group") || "").trim().toLocaleLowerCase("vi");
  const filtered = all.filter(item =>
    (!q || (item.title + " " + item.description).toLocaleLowerCase("vi").includes(q)) &&
    (!tag || item.tags.some(x => x.toLocaleLowerCase("vi") === tag)) &&
    (!group || item.groups.some(x => x.toLocaleLowerCase("vi") === group))
  );
  const page = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || url.searchParams.get("pageSize") || "30", 10) || 30));
  const data = filtered.slice((page - 1) * limit, page * limit);
  return json({
    success: true, endpoint: "/api/videos", data, items: data, results: data,
    page, limit, total: filtered.length, pageCount: Math.ceil(filtered.length / limit),
    hasMore: page * limit < filtered.length, pending: data.some(x => x.isDemo || !x.playbackEnabled),
    rightsGate: { policy: "deny-by-default", providerApprovalRequired: true, perVideoApprovalRequired: true, externalFetchingEnabled: false, publicPlaybackEnabled: data.some(x => x.playbackEnabled) }
  }, 200, request.method);
}
export async function tagsResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405, request.method);
  const all = await rows(env), counts = new Map();
  for (const item of all) for (const name of item.tags) counts.set(name, (counts.get(name) || 0) + 1);
  const data = [...counts].map(([name, count]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, count })).sort((a,b) => a.name.localeCompare(b.name, "vi"));
  return json({ success: true, data, total: data.length, source: "clipviet-preview-d1" }, 200, request.method);
}
export async function groupsResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405, request.method);
  const all = await rows(env), counts = new Map();
  for (const item of all) for (const name of item.groups) counts.set(name, (counts.get(name) || 0) + 1);
  const data = [...counts].map(([name, count]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, count })).sort((a,b) => a.name.localeCompare(b.name, "vi"));
  return json({ success: true, data, total: data.length, source: "clipviet-preview-d1" }, 200, request.method);
}
export async function adminVideosResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Read-only endpoint", allow: ["GET", "HEAD"] }, 405, request.method);
  if (!env?.DB) return json({ error: "Preview D1 binding DB is unavailable" }, 503, request.method);
  const result = await env.DB.prepare("SELECT * FROM clipviet_videos ORDER BY updated_at DESC, id ASC LIMIT 500").all();
  const data = (result.results || []).map(row => mapVideo(row, env));
  return json({ success: true, data, count: data.length, mode: "public-read-only-preview", source: "clipviet-preview-d1" }, 200, request.method);
}
export async function adminProvidersResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Read-only endpoint", allow: ["GET", "HEAD"] }, 405, request.method);
  if (!env?.DB) return json({ error: "Preview D1 binding DB is unavailable" }, 503, request.method);
  const result = await env.DB.prepare("SELECT id, domain, homepage_url, status, source_type, rights_review_required, fetching_enabled, notes, created_at, updated_at FROM provider_candidates ORDER BY domain ASC").all();
  const data = result.results || [];
  return json({ success: true, data, count: data.length, mode: "pending-only-no-fetch" }, 200, request.method);
}

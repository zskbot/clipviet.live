const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  }
});

const encoder = new TextEncoder();
const decodePart = value => {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
};
const decodeJson = value => JSON.parse(new TextDecoder().decode(decodePart(value)));
const safeArray = value => {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};
const nowIso = () => new Date().toISOString();
const slugify = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);

function allowedMediaUrl(value, env) {
  if (!value) return true;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  const allow = String(env.MEDIA_HOST_ALLOWLIST || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  return allow.length > 0 && allow.some(domain => host === domain || host.endsWith("." + domain));
}

function validHttpsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port;
  } catch { return false; }
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item || "").trim().slice(0, 60)).filter(Boolean))].slice(0, 30);
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 65536) return null;
  const raw = await request.text();
  if (encoder.encode(raw).length > 65536) return null;
  try { return JSON.parse(raw || "{}"); } catch { return null; }
}

function videoRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url,
    posterUrl: row.poster_url,
    tags: safeArray(row.tags_json),
    groups: safeArray(row.groups_json),
    rightsStatus: row.rights_status,
    rightsEvidenceUrl: row.rights_evidence_url,
    rightsNotes: row.rights_notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}


async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path === "/health" && request.method === "GET") {
    return json({ ok: true, service: "clipviet-video-cms-preview", environment: "preview", storage: "D1 metadata only", videoUpload: "disabled-no-dedicated-r2" });
  }
  if (!env.DB) return json({ error: "Preview D1 binding is missing." }, 503);

  if (path === "/public/videos" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,slug,title,description,video_url,poster_url,tags_json,groups_json,created_at,updated_at,published_at FROM clipviet_videos WHERE status='published' ORDER BY published_at DESC LIMIT 100").all();
    return json({ data: (rows.results || []).map(row => ({
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      videoUrl: row.video_url, posterUrl: row.poster_url, tags: safeArray(row.tags_json),
      groups: safeArray(row.groups_json), createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at
    })), count: rows.results?.length || 0 });
  }

  if (path === "/public/tags" || path === "/public/groups") {
    const column = path.endsWith("/tags") ? "tags_json" : "groups_json";
    const rows = await env.DB.prepare("SELECT " + column + " AS values_json FROM clipviet_videos WHERE status='published'").all();
    const counts = new Map();
    for (const row of rows.results || []) for (const item of safeArray(row.values_json)) {
      const value = String(item || "").trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return json({ data: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name)), count: counts.size });
  }

  if (!path.startsWith("/admin/api/")) return json({ error: "Not found." }, 404);
  if (path === "/admin/api/videos" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,slug,title,description,video_url,poster_url,tags_json,groups_json,rights_status,status,created_at,updated_at,published_at FROM clipviet_videos ORDER BY updated_at DESC LIMIT 200").all();
    return json({ data: (rows.results || []).map(row => ({
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      videoUrl: row.video_url, posterUrl: row.poster_url, tags: safeArray(row.tags_json),
      groups: safeArray(row.groups_json), rightsStatus: row.rights_status, status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at
    })), count: rows.results?.length || 0 });
  }
  return json({ error: "Public Admin is read-only. Create, edit, review, publish and delete operations are disabled." }, 403);
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      console.error("clipviet_video_cms_error", error instanceof Error ? error.message : "unknown");
      return json({ error: "Video CMS is temporarily unavailable." }, 500);
    }
  }
};

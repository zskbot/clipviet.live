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

async function verifyAccess(request, env) {
  const token = request.headers.get("cf-access-jwt-assertion") || "";
  const parts = token.split(".");
  if (parts.length !== 3 || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  try {
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return false;
    const issuer = "https://" + env.ACCESS_TEAM_DOMAIN;
    if (claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(claims.exp) || claims.exp <= now) return false;
    if (claims.nbf && claims.nbf > now + 30) return false;
    const response = await fetch(issuer + "/cdn-cgi/access/certs", { headers: { accept: "application/json" }, cf: { cacheTtl: 300 } });
    if (!response.ok) return false;
    const jwks = await response.json();
    const jwk = (jwks.keys || []).find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    }, false, ["verify"]);
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodePart(parts[2]),
      encoder.encode(parts[0] + "." + parts[1])
    );
  } catch {
    return false;
  }
}

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

async function adminRequired(request, env) {
  return await verifyAccess(request, env);
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
  if (!await adminRequired(request, env)) return json({ error: "Cloudflare Access authentication required." }, 401);

  if (path === "/admin/api/videos" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM clipviet_videos ORDER BY updated_at DESC LIMIT 200").all();
    return json({ data: (rows.results || []).map(videoRow), count: rows.results?.length || 0 });
  }

  if (path === "/admin/api/videos" && request.method === "POST") {
    const body = await readBody(request);
    if (!body) return json({ error: "Invalid JSON or payload too large." }, 400);
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim().slice(0, 5000);
    const videoUrl = String(body.videoUrl || "").trim();
    const posterUrl = String(body.posterUrl || "").trim();
    if (title.length < 2 || title.length > 160 || !validHttpsUrl(videoUrl) || !validHttpsUrl(posterUrl)) {
      return json({ error: "Title or HTTPS media URL is invalid." }, 400);
    }
    const slug = slugify(body.slug || title) || crypto.randomUUID();
    const id = crypto.randomUUID(), now = nowIso();
    try {
      await env.DB.prepare("INSERT INTO clipviet_videos (id,slug,title,description,video_url,poster_url,tags_json,groups_json,rights_status,rights_evidence_url,rights_notes,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,slug,title,description,videoUrl,posterUrl,JSON.stringify(cleanList(body.tags)),JSON.stringify(cleanList(body.groups)),"pending",String(body.rightsEvidenceUrl || "").trim(),String(body.rightsNotes || "").trim().slice(0,2000),"draft",now,now,null).run();
    } catch {
      return json({ error: "Could not save draft. The slug may already exist." }, 409);
    }
    const row = await env.DB.prepare("SELECT * FROM clipviet_videos WHERE id=?").bind(id).first();
    return json({ ok: true, data: videoRow(row) }, 201);
  }

  const match = path.match(/^\/admin\/api\/videos\/([0-9a-f-]{36})(?:\/(review|publish))?$/i);
  if (!match) return json({ error: "Admin endpoint not found." }, 404);
  const [, id, action] = match;
  const existing = await env.DB.prepare("SELECT * FROM clipviet_videos WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "Video not found." }, 404);

  if (!action && request.method === "PUT") {
    if (existing.status === "published") return json({ error: "Published records are immutable in this Preview." }, 409);
    const body = await readBody(request);
    if (!body) return json({ error: "Invalid JSON or payload too large." }, 400);
    const title = String(body.title || existing.title).trim();
    const description = String(body.description ?? existing.description).trim().slice(0,5000);
    const videoUrl = String(body.videoUrl ?? existing.video_url).trim();
    const posterUrl = String(body.posterUrl ?? existing.poster_url).trim();
    if (title.length < 2 || title.length > 160 || !validHttpsUrl(videoUrl) || !validHttpsUrl(posterUrl)) return json({ error: "Title or HTTPS media URL is invalid." }, 400);
    const slug = slugify(body.slug || title) || existing.slug;
    const now = nowIso();
    try {
      await env.DB.prepare("UPDATE clipviet_videos SET slug=?,title=?,description=?,video_url=?,poster_url=?,tags_json=?,groups_json=?,updated_at=? WHERE id=?")
        .bind(slug,title,description,videoUrl,posterUrl,JSON.stringify(cleanList(body.tags ?? safeArray(existing.tags_json))),JSON.stringify(cleanList(body.groups ?? safeArray(existing.groups_json))),now,id).run();
    } catch { return json({ error: "Could not update draft. The slug may already exist." }, 409); }
    const row = await env.DB.prepare("SELECT * FROM clipviet_videos WHERE id=?").bind(id).first();
    return json({ ok: true, data: videoRow(row) });
  }

  if (action === "review" && request.method === "POST") {
    const body = await readBody(request);
    if (!body) return json({ error: "Invalid JSON." }, 400);
    const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "pending";
    const evidence = String(body.rightsEvidenceUrl || "").trim();
    const notes = String(body.rightsNotes || "").trim().slice(0,2000);
    if (decision === "approved" && (!validHttpsUrl(evidence) || evidence.length < 12 || notes.length < 10)) {
      return json({ error: "Rights approval requires an HTTPS evidence URL and at least 10 characters of review notes." }, 400);
    }
    await env.DB.prepare("UPDATE clipviet_videos SET rights_status=?,rights_evidence_url=?,rights_notes=?,updated_at=? WHERE id=?")
      .bind(decision,evidence,notes,nowIso(),id).run();
    const row = await env.DB.prepare("SELECT * FROM clipviet_videos WHERE id=?").bind(id).first();
    return json({ ok: true, data: videoRow(row) });
  }

  if (action === "publish" && request.method === "POST") {
    if (existing.rights_status !== "approved" || !existing.rights_evidence_url || !existing.video_url) {
      return json({ error: "Publishing requires approved distribution rights, evidence, and a video URL." }, 409);
    }
    if (!allowedMediaUrl(existing.video_url, env)) {
      return json({ error: "MEDIA_HOST_ALLOWLIST is not configured or the video host is not approved." }, 409);
    }
    if (existing.poster_url && !validHttpsUrl(existing.poster_url)) return json({ error: "Poster URL must use HTTPS." }, 400);
    const now = nowIso();
    await env.DB.prepare("UPDATE clipviet_videos SET status='published',published_at=?,updated_at=? WHERE id=?").bind(now,now,id).run();
    const row = await env.DB.prepare("SELECT * FROM clipviet_videos WHERE id=?").bind(id).first();
    return json({ ok: true, data: videoRow(row) });
  }

  if (!action && request.method === "DELETE") {
    if (existing.status === "published") return json({ error: "Published records cannot be deleted from this Preview." }, 409);
    await env.DB.prepare("DELETE FROM clipviet_videos WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
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

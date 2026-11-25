import { listProviders, getProviderCategories, listProviderVideos, getProviderVideo, checkAllProviderHealth } from "./applecms.js";
const COOKIE = "__Host-clipviet_tg_session";
const SESSION_TTL = 28800;
const LOGIN_MAX_AGE = 300;
const encoder = new TextEncoder();

function reply(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function originOK(request, env) { return Boolean(env.ALLOWED_ORIGIN && request.headers.get("Origin") === env.ALLOWED_ORIGIN); }
function cors(request, env) {
  if (!originOK(request, env)) return {};
  return { "access-control-allow-origin": env.ALLOWED_ORIGIN, "access-control-allow-credentials": "true", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "vary": "Origin" };
}
function answer(request, env, data, status = 200, headers = {}) { return reply(data, status, { ...cors(request, env), ...headers }); }
function hexBytes(hex) { if (!/^[a-f0-9]{64}$/i.test(hex || "")) return null; return new Uint8Array(hex.match(/.{2}/g).map(x => parseInt(x, 16))); }
function equal(a, b) { if (!a || !b || a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i++) n |= a[i] ^ b[i]; return n === 0; }
async function sign(keyBytes, value) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function b64url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function verifyLogin(data, token) {
  if (!data || typeof data.hash !== "string") return false;
  const fields = Object.entries(data).filter(([k, v]) => k !== "hash" && v !== undefined && v !== null).map(([k, v]) => [k, String(v)]).sort(([a], [b]) => a.localeCompare(b));
  const check = fields.map(([k, v]) => k + "=" + v).join("\n");
  const secret = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return equal(await sign(new Uint8Array(secret), check), hexBytes(data.hash));
}
async function makeSession(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  return body + "." + b64url(await sign(encoder.encode(secret), body));
}
async function session(request, env) {
  const cookie = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  if (!cookie || !env.SESSION_SECRET) return null;
  const parts = cookie.slice(COOKIE.length + 1).split(".");
  if (parts.length !== 2) return null;
  let data, sig;
  try { data = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]))); sig = fromB64url(parts[1]); } catch { return null; }
  if (!equal(await sign(encoder.encode(env.SESSION_SECRET), parts[0]), sig)) return null;
  if (!Number.isSafeInteger(data.id) || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
  return data;
}
function allowedUsers(env) { return new Set((env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map(x => x.trim()).filter(Boolean)); }
async function botCall(env, method, body) {
  const res = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true) { console.error("telegram_api_error", { method, status: res.status, code: data.error_code || null }); throw new Error("Telegram API failed"); }
  return data.result;
}
function validMediaUrl(raw, env) {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url; try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  const hosts = (env.MEDIA_HOST_ALLOWLIST || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return hosts.length > 0 && hosts.some(domain => host === domain || host.endsWith("." + domain));
}
async function channelPermissions(env, userId) {
  if (!env.TELEGRAM_CHANNEL_ID || !env.TELEGRAM_BOT_ID) throw new Error("Channel configuration missing");
  const results = await Promise.all([
    botCall(env, "getChatMember", { chat_id: env.TELEGRAM_CHANNEL_ID, user_id: Number(env.TELEGRAM_BOT_ID) }),
    botCall(env, "getChatMember", { chat_id: env.TELEGRAM_CHANNEL_ID, user_id: userId })
  ]);
  const bot = results[0], user = results[1];
  return {
    botCanPost: bot.status === "creator" || (bot.status === "administrator" && bot.can_post_messages === true),
    userCanManage: user.status === "creator" || user.status === "administrator"
  };
}
async function bodyJson(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 16384) throw new Error("Payload too large");
  return JSON.parse(raw);
}

function mediaHostAllowed(raw, env) {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url; try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  const hosts = (env.VIDEO_MEDIA_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return hosts.length > 0 && hosts.some(domain => host === domain || host.endsWith("." + domain));
}
async function readCatalog(env) {
  if (!env.VIDEO_CATALOG) throw new Error("Video catalog KV is not configured");
  const rows = await env.VIDEO_CATALOG.get("catalog:v1", "json");
  return Array.isArray(rows) ? rows : [];
}
async function writeCatalog(env, rows) {
  if (!env.VIDEO_CATALOG) throw new Error("Video catalog KV is not configured");
  if (rows.length > 1000) throw new Error("Catalog limit reached");
  await env.VIDEO_CATALOG.put("catalog:v1", JSON.stringify(rows));
}
function safeVideo(row) {
  return { id: row.id, title: row.title, description: row.description, poster_url: row.poster_url, genre: row.genre, country: row.country, duration: row.duration, created_at: row.created_at };
}
async function adminSession(request, env) {
  const current = await session(request, env);
  return current && allowedUsers(env).has(String(current.id)) ? current : null;
}

async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "OPTIONS") return originOK(request, env) ? new Response(null, { status: 204, headers: cors(request, env) }) : new Response(null, { status: 403 });
  if (path === "/health" && request.method === "GET") return reply({
    ok: true, service: "clipviet-telegram-api",
    configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.SESSION_SECRET && env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_BOT_ID && env.TELEGRAM_CHANNEL_ID && env.TELEGRAM_ALLOWED_USER_IDS && env.MEDIA_HOST_ALLOWLIST && env.LOGIN_REPLAY)
  });
  if (!originOK(request, env)) return answer(request, env, { error: "Origin not allowed" }, 403);
  if (path === "/auth/telegram" && request.method === "POST") {
    if (!env.TELEGRAM_BOT_TOKEN || !env.SESSION_SECRET || !env.LOGIN_REPLAY) return answer(request, env, { error: "Authentication is not configured" }, 503);
    let data; try { data = await bodyJson(request); } catch { return answer(request, env, { error: "Invalid JSON body" }, 400); }
    const now = Math.floor(Date.now() / 1000), authDate = Number(data.auth_date);
    if (!Number.isInteger(authDate) || authDate > now + 30 || now - authDate > LOGIN_MAX_AGE) return answer(request, env, { error: "Telegram login expired" }, 401);
    if (!await verifyLogin(data, env.TELEGRAM_BOT_TOKEN)) return answer(request, env, { error: "Invalid Telegram signature" }, 401);
    const id = Number(data.id);
    if (!Number.isSafeInteger(id) || !allowedUsers(env).has(String(id))) return answer(request, env, { error: "Telegram account is not allowlisted" }, 403);
    const replay = "login:" + data.hash;
    if (await env.LOGIN_REPLAY.get(replay)) return answer(request, env, { error: "Login payload already used" }, 409);
    await env.LOGIN_REPLAY.put(replay, "1", { expirationTtl: 600 });
    const token = await makeSession({ id, first_name: String(data.first_name || "").slice(0, 64), username: String(data.username || "").slice(0, 64), exp: now + SESSION_TTL }, env.SESSION_SECRET);
    console.log("telegram_login_success", { userId: id });
    return answer(request, env, { ok: true, user: { id, first_name: data.first_name || "", username: data.username || "" } }, 200, {
      "set-cookie": COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + SESSION_TTL
    });
  }
  if (path === "/auth/me" && request.method === "GET") {
    const current = await session(request, env);
    return current ? answer(request, env, { authenticated: true, user: { id: current.id, first_name: current.first_name, username: current.username } }) : answer(request, env, { authenticated: false }, 401);
  }
  if (path === "/auth/logout" && request.method === "POST") return answer(request, env, { ok: true }, 200, { "set-cookie": COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  if (path === "/channel/verify" && request.method === "GET") {
    const current = await session(request, env); if (!current) return answer(request, env, { error: "Authentication required" }, 401);
    try {
      const p = await channelPermissions(env, current.id);
      return answer(request, env, { ok: p.botCanPost && p.userCanManage, channel: env.TELEGRAM_CHANNEL_ID, botCanPost: p.botCanPost, userCanManage: p.userCanManage });
    } catch { return answer(request, env, { error: "Could not verify channel permissions" }, 502); }
  }
  if (path === "/channel/publish" && request.method === "POST") {
    const current = await session(request, env); if (!current) return answer(request, env, { error: "Authentication required" }, 401);
    let data; try { data = await bodyJson(request); } catch { return answer(request, env, { error: "Invalid JSON body" }, 400); }
    if (data.rights_confirmed !== true) return answer(request, env, { error: "Rights confirmation required" }, 400);
    if (!validMediaUrl(data.video_url, env)) return answer(request, env, { error: "Video host is not allowlisted" }, 400);
    try {
      const p = await channelPermissions(env, current.id);
      if (!p.botCanPost || !p.userCanManage) return answer(request, env, { error: "Channel administrator permissions required" }, 403);
      const caption = typeof data.caption === "string" ? data.caption.trim().slice(0, 900) : "";
      const sent = await botCall(env, "sendVideo", { chat_id: env.TELEGRAM_CHANNEL_ID, video: data.video_url, ...(caption ? { caption } : {}), supports_streaming: true });
      console.log("telegram_video_published", { userId: current.id, messageId: sent.message_id });
      return answer(request, env, { ok: true, message_id: sent.message_id, channel: env.TELEGRAM_CHANNEL_ID });
    } catch { return answer(request, env, { error: "Publishing failed; verify bot rights and Telegram media requirements" }, 502); }
  }


  if (path === "/api/providers" && request.method === "GET") {
    return answer(request, env, { data: listProviders(env), count: listProviders(env).length, protocol: "AppleCMS V10" });
  }
  if (path === "/api/providers/health" && request.method === "GET") {
    if (!await adminSession(request, env)) return answer(request, env, { error: "Admin authentication required" }, 401);
    const providers = await checkAllProviderHealth(env);
    return answer(request, env, { data: providers, checked_at: new Date().toISOString() });
  }
  if (path === "/api/catalog/categories" && request.method === "GET") {
    const explicitSource = url.searchParams.get("sourceId");
    const candidates = explicitSource ? [explicitSource] : ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];
    let lastError = null;
    for (const providerId of candidates) {
      try {
        const data = await getProviderCategories(providerId, env);
        return answer(request, env, { sourceId: providerId, data, count: data.length, failover: !explicitSource && providerId !== "souavzy" });
      } catch (error) {
        lastError = error;
        if (explicitSource) break;
      }
    }
    return answer(request, env, { error: "All eligible providers failed", providerId: lastError?.providerId || explicitSource || "souavzy" }, lastError?.status || 502);
  }
  if (path === "/api/catalog/videos" && request.method === "GET") {
    const explicitSource = url.searchParams.get("sourceId");
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const keyword = url.searchParams.get("keyword") || undefined;
    const page = url.searchParams.get("page") || "1";
    const candidates = explicitSource ? [explicitSource] : ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];
    let lastError = null;
    for (const providerId of candidates) {
      try {
        const result = await listProviderVideos(providerId, { page, categoryId, keyword }, env);
        return answer(request, env, { ...result, failover: !explicitSource && providerId !== "souavzy" });
      } catch (error) {
        lastError = error;
        if (explicitSource || categoryId) break;
      }
    }
    return answer(request, env, { error: "All eligible providers failed", providerId: lastError?.providerId || explicitSource || "souavzy" }, lastError?.status || 502);
  }
  const providerRoute = path.match(/^\/api\/providers\/([a-z0-9-]+)\/(categories|videos)(?:\/([0-9]+))?$/);
  if (providerRoute && request.method === "GET") {
    const [, providerId, resource, vodId] = providerRoute;
    try {
      if (resource === "categories") {
        const data = await getProviderCategories(providerId, env);
        return answer(request, env, { sourceId: providerId, data, count: data.length });
      }
      if (vodId) {
        const data = await getProviderVideo(providerId, vodId, env);
        return data ? answer(request, env, { data }) : answer(request, env, { error: "Video not found" }, 404);
      }
      const data = await listProviderVideos(providerId, {
        page: url.searchParams.get("page") || "1",
        categoryId: url.searchParams.get("categoryId") || undefined,
        keyword: url.searchParams.get("keyword") || undefined
      }, env);
      return answer(request, env, data);
    } catch (error) {
      return answer(request, env, { error: error.message, providerId }, error.status || 502);
    }
  }

  if (path === "/api/v1/videos" && request.method === "GET") {
    try {
      const rows = await readCatalog(env);
      const videos = rows.filter(row => row.status === "published").map(safeVideo);
      return answer(request, env, { data: videos, count: videos.length });
    } catch { return answer(request, env, { error: "Video catalog unavailable" }, 503); }
  }
  if (path.startsWith("/api/v1/videos/") && request.method === "GET") {
    try {
      const id = decodeURIComponent(path.slice("/api/v1/videos/".length));
      const row = (await readCatalog(env)).find(item => item.id === id && item.status === "published");
      return row ? answer(request, env, { data: { ...safeVideo(row), media_url: row.media_url } }) : answer(request, env, { error: "Video not found" }, 404);
    } catch { return answer(request, env, { error: "Video catalog unavailable" }, 503); }
  }
  if (path === "/api/v1/admin/videos" && request.method === "GET") {
    if (!await adminSession(request, env)) return answer(request, env, { error: "Admin authentication required" }, 401);
    try { const rows = await readCatalog(env); return answer(request, env, { data: rows, count: rows.length }); }
    catch { return answer(request, env, { error: "Video catalog unavailable" }, 503); }
  }
  if (path === "/api/v1/admin/videos" && request.method === "POST") {
    const current = await adminSession(request, env);
    if (!current) return answer(request, env, { error: "Admin authentication required" }, 401);
    let data; try { data = await bodyJson(request); } catch { return answer(request, env, { error: "Invalid JSON body" }, 400); }
    if (data.rights_confirmed !== true) return answer(request, env, { error: "Distribution rights confirmation required" }, 400);
    if (!mediaHostAllowed(data.media_url, env)) return answer(request, env, { error: "Media host is not allowlisted" }, 400);
    if (data.poster_url && !mediaHostAllowed(data.poster_url, env)) return answer(request, env, { error: "Poster host is not allowlisted" }, 400);
    const title = typeof data.title === "string" ? data.title.trim().slice(0, 160) : "";
    if (!title) return answer(request, env, { error: "Title is required" }, 400);
    const row = {
      id: crypto.randomUUID(), title, description: String(data.description || "").slice(0, 2000),
      media_url: data.media_url, poster_url: data.poster_url || "", genre: String(data.genre || "").slice(0, 80),
      country: String(data.country || "").slice(0, 80), duration: String(data.duration || "").slice(0, 40),
      status: data.status === "draft" ? "draft" : "published", rights_confirmed: true,
      created_by: current.id, created_at: new Date().toISOString()
    };
    try {
      const rows = await readCatalog(env); rows.unshift(row); await writeCatalog(env, rows);
      console.log("video_catalog_created", { id: row.id, userId: current.id, status: row.status });
      return answer(request, env, { data: row }, 201);
    } catch { return answer(request, env, { error: "Could not save video; catalog may not be configured or full" }, 503); }
  }
  if (path.startsWith("/api/v1/admin/videos/") && request.method === "DELETE") {
    const current = await adminSession(request, env);
    if (!current) return answer(request, env, { error: "Admin authentication required" }, 401);
    const id = decodeURIComponent(path.slice("/api/v1/admin/videos/".length));
    try {
      const rows = await readCatalog(env), next = rows.filter(item => item.id !== id);
      if (next.length === rows.length) return answer(request, env, { error: "Video not found" }, 404);
      await writeCatalog(env, next);
      console.log("video_catalog_deleted", { id, userId: current.id });
      return answer(request, env, { ok: true });
    } catch { return answer(request, env, { error: "Could not update video catalog" }, 503); }
  }

  return answer(request, env, { error: "Not found" }, 404);
}
export default { async fetch(request, env) {
  try { return await handle(request, env); }
  catch (error) { console.error("worker_error", error instanceof Error ? error.message : "unknown"); return reply({ error: "Internal server error" }, 500); }
} };

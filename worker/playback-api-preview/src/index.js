import { evaluatePlaybackRights, parsePlaybackLines } from "./policy.mjs";

const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf · Backup 3", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", host: "jipinvip1.com" }
];
const USER_AGENT = "ClipVietPlaybackPreview/1.0";
const TIMEOUT_MS = 12000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      ...headers
    }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return "";
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const exact = new Set(String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
    if (exact.has(origin)) return origin;
    const previewHost = host.endsWith(".clipviet-live-preview.pages.dev") ||
      host.endsWith(".clipviet-live-independent-preview.pages.dev");
    return previewHost && host.split(".").length === 4 ? origin : null;
  } catch {
    return null;
  }
}

async function loadApprovedRights(providerId, videoId, env, region) {
  if (!env.PROVIDER_DB) {
    return { allowed: false, reason: "provider_registry_unavailable", status: 503 };
  }
  const row = await env.PROVIDER_DB.prepare(`
    SELECT
      p.status AS provider_status,
      p.rights_holder AS provider_rights_holder,
      p.license_reference AS provider_license_reference,
      p.rights_evidence_url AS provider_rights_evidence_url,
      p.license_expires_at AS provider_license_expires_at,
      p.media_hosts_json AS media_hosts_json,
      c.status AS connector_status,
      c.playback_mode AS playback_mode,
      c.regions_json AS connector_regions_json,
      r.status AS content_status,
      r.rights_holder AS content_rights_holder,
      r.license_reference AS content_license_reference,
      r.source_url AS content_source_url,
      r.evidence_url AS content_evidence_url,
      r.license_expires_at AS content_license_expires_at,
      r.permitted_uses_json AS permitted_uses_json,
      r.regions_json AS content_regions_json,
      r.source_verified AS source_verified,
      r.ownership_verified AS ownership_verified,
      r.performer_age_verified AS performer_age_verified,
      r.performer_consent_verified AS performer_consent_verified
    FROM provider_registry p
    LEFT JOIN provider_connectors c ON c.provider_id = p.id
    LEFT JOIN provider_content_rights r
      ON r.provider_id = p.id AND r.source_content_id = ?
    WHERE p.id = ?
    ORDER BY r.updated_at DESC
    LIMIT 1
  `).bind(videoId, providerId).first();

  const decision = evaluatePlaybackRights(row, region);
  return { ...decision, status: decision.allowed ? 200 : (decision.reason === "provider_registry_unavailable" ? 503 : 403) };
}

async function fetchProviderVideo(provider, videoId) {
  const url = new URL("https://" + provider.host + "/api.php/provide/vod/");
  url.searchParams.set("ac", "detail");
  url.searchParams.set("ids", videoId);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error("Upstream provider returned HTTP " + response.status);
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 1 || !Array.isArray(payload.list)) throw new Error("Upstream provider returned an invalid AppleCMS response");
  return payload.list.find(item => String(item.vod_id) === videoId) || null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: "Preview origin not allowed", code: "ORIGIN_NOT_ALLOWED" }, 403);
  const headers = origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Accept, Content-Type",
    "access-control-max-age": "600",
    "vary": "Origin"
  } : {};

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET, OPTIONS", ...headers });

  if (path === "/health") {
    return json({
      ok: true,
      service: "clipviet-playback-api-preview",
      environment: "preview",
      providerRegistryConfigured: Boolean(env.PROVIDER_DB),
      playbackPolicy: "deny-by-default",
      requiredPlaybackMode: "owner_hosted_stream",
      urlPolicy: "https-only-and-approved-media-hosts"
    }, 200, headers);
  }

  if (path === "/api/providers") {
    return json({
      data: PROVIDERS.map(({ id, name }) => ({ id, name, protocol: "AppleCMS V10" })),
      count: PROVIDERS.length
    }, 200, headers);
  }

  const match = path.match(/^\/api\/playback\/providers\/([a-z0-9-]+)\/videos\/([0-9]+)$/);
  if (!match) return json({ error: "Not found", code: "NOT_FOUND" }, 404, headers);
  const [, providerId, videoId] = match;
  const provider = PROVIDERS.find(item => item.id === providerId);
  if (!provider) return json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" }, 404, headers);

  const region = String(request.cf?.country || "VN").toUpperCase();
  const rights = await loadApprovedRights(providerId, videoId, env, region);
  if (!rights.allowed) {
    const messages = {
      provider_not_approved: "Nhà cung cấp chưa được duyệt quyền.",
      connector_not_approved: "Kết nối nguồn chưa được duyệt.",
      content_rights_not_approved: "Video chưa có hồ sơ quyền phân phối được duyệt.",
      direct_stream_mode_not_approved: "Nguồn chưa được duyệt chế độ phát trực tiếp.",
      direct_playback_not_licensed: "Giấy phép không cho phép phát trực tiếp.",
      media_host_allowlist_empty: "Chưa cấu hình máy chủ media được phép.",
      video_rights_not_registered: "Chưa có bản ghi quyền cho video này."
    };
    return json({
      error: messages[rights.reason] || "Video chưa đủ điều kiện phát.",
      code: rights.reason,
      playbackEnabled: false
    }, rights.status || 403, headers);
  }

  let row;
  try {
    row = await fetchProviderVideo(provider, videoId);
  } catch {
    return json({ error: "Không thể truy vấn nguồn video hiện tại.", code: "UPSTREAM_UNAVAILABLE" }, 502, headers);
  }
  if (!row) return json({ error: "Video không còn tồn tại tại nguồn.", code: "SOURCE_VIDEO_NOT_FOUND" }, 404, headers);

  const lines = parsePlaybackLines(row.vod_play_url, row.vod_play_from, rights.mediaHosts);
  if (!lines.length) {
    return json({
      error: "Nguồn chưa trả luồng media thuộc host đã được phê duyệt.",
      code: "NO_APPROVED_MEDIA_URL",
      playbackEnabled: false
    }, 403, headers);
  }

  const data = {
    id: videoId,
    sourceId: providerId,
    sourceName: provider.name,
    title: String(row.vod_name || ""),
    poster: String(row.vod_pic || ""),
    duration: String(row.vod_duration || ""),
    lines,
    rightsStatus: "APPROVED",
    rightsVerified: true,
    rightsExpiresAt: rights.expiresAt,
    rightsPermittedUses: rights.permittedUses,
    playbackEnabled: true,
    playbackRightsApproved: true
  };
  return json({
    data,
    provider: { id: provider.id, name: provider.name },
    rightsGate: { policy: "deny-by-default", approved: true, region, playbackMode: "owner_hosted_stream" }
  }, 200, headers);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      console.error("playback_preview_error", error instanceof Error ? error.message : "unknown");
      return json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
    }
  }
};

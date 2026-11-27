import { evaluatePlaybackRights, parsePlaybackLines, isAllowedMediaUrl } from "./policy.mjs";

const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf · Backup 3", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", host: "jipinvip1.com" }
];
const USER_AGENT = "ClipVietPlaybackPreview/1.0";
const TIMEOUT_MS = 12000;

const MAX_API_BYTES = 1024 * 1024;

async function readJsonLimited(response, label) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(contentType)) {
    await response.body?.cancel();
    throw new Error(label + "_invalid_content_type");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error(label + "_empty_body");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_API_BYTES) {
      await reader.cancel();
      throw new Error(label + "_response_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error(label + "_invalid_json"); }
}

function parseJsonArray(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function providerRightsState(row) {
  if (!row) return { status: "NOT_CONFIGURED", playbackMode: "none", rightsApproved: false };
  const providerStatus = String(row.provider_status || "").toUpperCase();
  const connectorStatus = String(row.connector_status || "").toUpperCase();
  const mode = String(row.playback_mode || "none");
  const expiry = Date.parse(row.provider_license_expires_at || "");
  const licenseValid = ["APPROVED", "ENABLED"].includes(providerStatus) &&
    Boolean(String(row.provider_rights_holder || "").trim()) &&
    Boolean(String(row.provider_license_reference || "").trim()) &&
    Boolean(String(row.provider_rights_evidence_url || "").trim()) &&
    Number.isFinite(expiry) && expiry > Date.now();
  if (!licenseValid || connectorStatus !== "APPROVED") return { status: "PENDING_RIGHTS", playbackMode: mode, rightsApproved: false };
  if (mode === "metadata_only") return { status: "METADATA_ONLY", playbackMode: mode, rightsApproved: true };
  if (mode === "official_embed") return { status: "PLAYBACK_APPROVED", playbackMode: mode, rightsApproved: true };
  if (mode === "owner_hosted_stream" && parseJsonArray(row.media_hosts_json).length) {
    return { status: "PLAYBACK_APPROVED", playbackMode: mode, rightsApproved: true };
  }
  return { status: "PENDING_RIGHTS", playbackMode: mode, rightsApproved: false };
}

async function readProviderStatuses(env) {
  if (!env.PROVIDER_DB) throw new Error("provider_registry_unavailable");
  const result = await env.PROVIDER_DB.prepare(`
    SELECT p.id, p.status AS provider_status,
      p.rights_holder AS provider_rights_holder,
      p.license_reference AS provider_license_reference,
      p.rights_evidence_url AS provider_rights_evidence_url,
      p.license_expires_at AS provider_license_expires_at,
      p.media_hosts_json AS media_hosts_json,
      c.status AS connector_status, c.playback_mode AS playback_mode
    FROM provider_registry p
    LEFT JOIN provider_connectors c ON c.provider_id = p.id
  `).all();
  const rows = new Map((result.results || []).map(row => [row.id, row]));
  return PROVIDERS.map(provider => ({
    id: provider.id, name: provider.name, protocol: "AppleCMS V10",
    ...providerRightsState(rows.get(provider.id)),
    operationalState: "NOT_CHECKED"
  }));
}

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
      host.endsWith(".clipviet-live-qa.pages.dev") ||
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

async function diagnoseProvider(provider) {
  const started = Date.now();
  const url = new URL("https://" + provider.host + "/api.php/provide/vod/");
  url.searchParams.set("ac", "list");
  url.searchParams.set("pg", "1");
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      redirect: "error",
      signal: AbortSignal.timeout(9000)
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return {
        providerId: provider.id,
        reachable: false,
        httpStatus: response.status,
        latencyMs,
        apiProtocol: "AppleCMS V10",
        operationalState: "ERROR",
        playbackEnabled: false,
        reason: "upstream_http_error"
      };
    }
    let payload;
    try { payload = await readJsonLimited(response, "provider_diagnostics"); }
    catch (error) {
      return { providerId: provider.id, reachable: false, httpStatus: response.status,
        latencyMs: Date.now() - started, apiProtocol: "AppleCMS V10",
        operationalState: "ERROR", playbackEnabled: false, reason: error.message };
    }
    const valid = payload && Number(payload.code) === 1 && Array.isArray(payload.list);
    return {
      providerId: provider.id,
      reachable: valid,
      httpStatus: response.status,
      latencyMs,
      apiProtocol: "AppleCMS V10",
      appleCmsCode: Number.isFinite(Number(payload?.code)) ? Number(payload.code) : null,
      catalogCount: Array.isArray(payload?.list) ? payload.list.length : 0,
      operationalState: valid ? "ACTIVE" : "ERROR",
      playbackEnabled: false,
      reason: valid ? "metadata_api_reachable_rights_not_approved" : "invalid_applecms_response"
    };
  } catch {
    return {
      providerId: provider.id,
      reachable: false,
      httpStatus: null,
      latencyMs: Date.now() - started,
      apiProtocol: "AppleCMS V10",
      operationalState: "ERROR",
      playbackEnabled: false,
      reason: "upstream_unreachable_or_timeout"
    };
  }
}

async function readTextLimited(response, maxBytes = 256 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("media_manifest_empty");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("media_manifest_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function mediaCorsOk(response, origin) {
  if (!origin) return null;
  const allowed = response.headers.get("access-control-allow-origin");
  return allowed === "*" || allowed === origin;
}
async function diagnoseMediaUrl(rawUrl, requestOrigin, mediaHosts) {
  const parsed = new URL(rawUrl);
  const path = parsed.pathname.toLowerCase();
  const isHls = /\.m3u8$/.test(path);
  const isMp4 = /\.mp4$/.test(path);
  const base = { mediaType: isHls ? "hls" : isMp4 ? "mp4" : "unknown",
    httpStatus: null, mimeOk: false, corsOk: requestOrigin ? false : null,
    rangeSupported: null, manifestOk: null, firstResourceReachable: null, passed: false };
  if (!isHls && !isMp4) return { ...base, reason: "unsupported_media_type" };
  const headers = { accept: isHls ? "application/vnd.apple.mpegurl, application/x-mpegURL" : "video/mp4",
    "user-agent": USER_AGENT };
  if (requestOrigin) headers.origin = requestOrigin;
  try {
    if (isMp4) {
      // Probe with the same GET+Range pattern used by browser media clients.
      // Some CDNs reject HEAD while correctly serving byte-range GET requests.
      const ranged = await fetch(parsed.href, { method: "GET",
        headers: { ...headers, range: "bytes=0-1" }, redirect: "error", signal: AbortSignal.timeout(9000) });
      const contentType = String(ranged.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const mimeOk = contentType === "video/mp4";
      const contentRange = String(ranged.headers.get("content-range") || "");
      const rangeSupported = ranged.status === 206 && contentRange.toLowerCase().startsWith("bytes 0-1/");
      const corsOk = mediaCorsOk(ranged, requestOrigin);
      const httpStatus = ranged.status;
      try { await ranged.body?.cancel(); } catch { /* body cancellation is best-effort */ }
      return { ...base, httpStatus, mimeOk, corsOk, rangeSupported,
        passed: ranged.ok && mimeOk && corsOk !== false && rangeSupported,
        reason: !ranged.ok ? "mp4_range_request_failed" : !mimeOk ? "mp4_mime_invalid" :
          corsOk === false ? "media_cors_missing" : !rangeSupported ? "mp4_byte_range_not_supported" : "ok" };
    }
    const manifest = await fetch(parsed.href, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(9000) });
    const contentType = String(manifest.headers.get("content-type") || "").toLowerCase();
    const mimeOk = /^(application\/(?:vnd\.apple\.mpegurl|x-mpegurl)|audio\/(?:mpegurl|x-mpegurl))(?:\s*;|$)/i.test(contentType);
    const corsOk = mediaCorsOk(manifest, requestOrigin);
    const text = manifest.ok && mimeOk ? await readTextLimited(manifest) : "";
    const firstResource = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith("#"));
    let firstResourceReachable = false;
    let firstResourceCorsOk = requestOrigin ? false : null;
    if (firstResource) {
      const resourceUrl = new URL(firstResource, parsed);
      if (isAllowedMediaUrl(resourceUrl.href, mediaHosts)) {
        const resource = await fetch(resourceUrl.href, { method: "GET",
          headers: { ...headers, range: "bytes=0-1" }, redirect: "error", signal: AbortSignal.timeout(9000) });
        const resourceType = String(resource.headers.get("content-type") || "").toLowerCase();
        const resourceMime = resourceType.split(";")[0].trim();
        const resourceMimeOk = new Set(["video/mp2t", "video/mp4", "video/iso.segment", "audio/aac", "audio/mp4", "application/octet-stream", "application/mp2t", "application/vnd.apple.mpegurl", "application/x-mpegurl"]).has(resourceMime);
        firstResourceReachable = resource.ok && [200, 206].includes(resource.status) && resourceMimeOk;
        firstResourceCorsOk = mediaCorsOk(resource, requestOrigin);
        try { await resource.body?.cancel(); } catch { /* body cancellation is best-effort */ }
      }
    }
    return { ...base, httpStatus: manifest.status, mimeOk, corsOk,
      manifestOk: manifest.ok && mimeOk && Boolean(firstResource), firstResourceReachable,
      firstResourceCorsOk,
      passed: manifest.ok && mimeOk && corsOk !== false && firstResourceCorsOk !== false &&
        Boolean(firstResource) && firstResourceReachable,
      reason: !manifest.ok ? "hls_manifest_request_failed" : !mimeOk ? "hls_mime_invalid" :
        corsOk === false || firstResourceCorsOk === false ? "media_cors_missing" :
          !firstResource ? "hls_manifest_has_no_media_uri" :
            !firstResourceReachable ? "hls_first_resource_unreachable_or_unapproved" : "ok" };
  } catch (error) {
    const errorType = String(error?.name || "UnknownError").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    console.error("media_probe_failed", errorType || "UnknownError");
    return { ...base, reason: "media_probe_failed", errorType: errorType || "UnknownError" };
  }
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
  const payload = await readJsonLimited(response, "provider_detail");
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
    try {
      const data = await readProviderStatuses(env);
      return json({ data, count: data.length, statusModel: { status: "rights", operationalState: "technical_health" } }, 200, headers);
    } catch {
      return json({ error: "Provider registry unavailable", code: "PROVIDER_REGISTRY_UNAVAILABLE" }, 503, headers);
    }
  }

  if (path === "/api/providers/diagnostics") {
    try {
      const [statuses, diagnostics] = await Promise.all([
        readProviderStatuses(env),
        Promise.all(PROVIDERS.map(diagnoseProvider))
      ]);
      const statusMap = new Map(statuses.map(item => [item.id, item]));
      const data = diagnostics.map(item => ({
        ...statusMap.get(item.providerId), ...item,
        status: statusMap.get(item.providerId)?.status || "UNKNOWN"
      }));
      return json({ data, count: data.length,
        note: "Technical health is independent from legal rights. Diagnostics never grant playback or expose media URLs."
      }, 200, headers);
    } catch {
      return json({ error: "Provider registry unavailable", code: "PROVIDER_REGISTRY_UNAVAILABLE" }, 503, headers);
    }
  }

  const providerDiagnosticMatch = path.match(/^\/api\/providers\/([a-z0-9-]+)\/diagnostics$/);
  if (providerDiagnosticMatch) {
    const provider = PROVIDERS.find(item => item.id === providerDiagnosticMatch[1]);
    if (!provider) return json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" }, 404, headers);
    try {
      const [statuses, diagnostic] = await Promise.all([
        readProviderStatuses(env), diagnoseProvider(provider)
      ]);
      const state = statuses.find(item => item.id === provider.id);
      return json({ data: { ...state, ...diagnostic, status: state?.status || "UNKNOWN" } }, 200, headers);
    } catch {
      return json({ error: "Provider registry unavailable", code: "PROVIDER_REGISTRY_UNAVAILABLE" }, 503, headers);
    }
  }

  const diagnosticMatch = path.match(/^\/api\/playback\/providers\/([a-z0-9-]+)\/videos\/([0-9]+)\/diagnostics$/);
  if (diagnosticMatch) {
    const [, providerId, videoId] = diagnosticMatch;
    const provider = PROVIDERS.find(item => item.id === providerId);
    if (!provider) return json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" }, 404, headers);
    const region = String(request.cf?.country || "VN").toUpperCase();
    const rights = await loadApprovedRights(providerId, videoId, env, region);
    if (!rights.allowed) return json({ error: "Media diagnostics require approved provider and video rights.",
      code: rights.reason, playbackEnabled: false, diagnostics: "BLOCKED_BY_RIGHTS_GATE" }, rights.status || 403, headers);
    let row;
    try { row = await fetchProviderVideo(provider, videoId); }
    catch { return json({ error: "Provider detail request failed.", code: "UPSTREAM_UNAVAILABLE" }, 502, headers); }
    if (!row) return json({ error: "Video not found.", code: "SOURCE_VIDEO_NOT_FOUND" }, 404, headers);
    const lines = parsePlaybackLines(row.vod_play_url, row.vod_play_from, rights.mediaHosts);
    const probes = [];
    for (const line of lines) {
      for (const episode of line.episodes.slice(0, 4 - probes.length)) {
        probes.push({ line: line.lineName, episode: episode.name,
          ...(await diagnoseMediaUrl(episode.url, origin || "", rights.mediaHosts)) });
      }
      if (probes.length >= 4) break;
    }
    return json({ data: { providerId, videoId, playbackMode: "owner_hosted_stream",
      rightsStatus: "APPROVED", checked: probes.length, passed: probes.filter(item => item.passed).length,
      results: probes },
      note: "No media URLs are included in diagnostic results. Live checks run only after provider and video rights approval."
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

const API_VIDEO_ID = /^[A-Za-z0-9_-]{6,128}$/;

export function getApprovedApiVideoEntries(env = process.env) {
  const raw = env.APIVIDEO_APPROVED_VIDEO_IDS_JSON || "[]";
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("APIVIDEO_APPROVED_VIDEO_IDS_JSON must be valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("APIVIDEO_APPROVED_VIDEO_IDS_JSON must be an array.");
  const unique = new Map();
  for (const entry of parsed.slice(0, 500)) {
    const id = typeof entry === "string" ? entry.trim() : String(entry?.id || "").trim();
    if (!API_VIDEO_ID.test(id)) continue;
    unique.set(id, { id, live: typeof entry === "object" && entry?.live === true });
  }
  return [...unique.values()];
}

export function getApprovedApiVideoPlayback(id, env = process.env) {
  if (typeof id !== "string" || !API_VIDEO_ID.test(id)) return null;
  try { return getApprovedApiVideoEntries(env).find(entry => entry.id === id) || null; }
  catch { return null; }
}

export function getApprovedApiVideoSourceHosts(env = process.env) {
  const raw = env.APIVIDEO_APPROVED_SOURCE_HOSTS_JSON || "[]";
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("APIVIDEO_APPROVED_SOURCE_HOSTS_JSON must be valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("APIVIDEO_APPROVED_SOURCE_HOSTS_JSON must be an array.");
  return [...new Set(parsed
    .filter(value => typeof value === "string")
    .map(value => value.trim().toLowerCase())
    .filter(value => /^[a-z0-9.-]+$/.test(value) && value.includes(".") && !value.startsWith(".") && !value.endsWith(".")))].slice(0, 100);
}

export function validateApiVideoSourceUrl(value, env = process.env) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  let approvedHosts;
  try { approvedHosts = getApprovedApiVideoSourceHosts(env); } catch { return null; }
  if (!approvedHosts.includes(host)) return null;
  return url.toString();
}

export function getApiVideoApiBaseUrl(env = process.env) {
  return env.APIVIDEO_ENV === "production" ? "https://ws.api.video" : "https://sandbox.api.video";
}

export function getApiVideoIntegrationStatus(env = process.env) {
  let approvedPlaybackCount = 0;
  let configurationError = "";
  try {
    approvedPlaybackCount = getApprovedApiVideoEntries(env).length;
    getApprovedApiVideoSourceHosts(env);
  } catch (error) {
    configurationError = error instanceof Error ? error.message : "Invalid configuration";
  }
  return {
    configured: Boolean(String(env.APIVIDEO_API_KEY || "").trim()),
    apiKeyConfigured: Boolean(String(env.APIVIDEO_API_KEY || "").trim()),
    approvedPlaybackCount,
    approvedSourceHostCount: (() => { try { return getApprovedApiVideoSourceHosts(env).length; } catch { return 0; } })(),
    environment: env.APIVIDEO_ENV === "production" ? "production" : "sandbox",
    ingestionEnabled: env.APIVIDEO_INGEST_ENABLED === "true",
    configurationValid: !configurationError,
    configurationError
  };
}

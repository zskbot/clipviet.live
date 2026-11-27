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
  return getApprovedApiVideoEntries(env).find(entry => entry.id === id) || null;
}

export function getApiVideoIntegrationStatus(env = process.env) {
  let approvedPlaybackCount = 0;
  let configurationError = "";
  try { approvedPlaybackCount = getApprovedApiVideoEntries(env).length; }
  catch (error) { configurationError = error instanceof Error ? error.message : "Invalid configuration"; }
  return {
    configured: Boolean(String(env.APIVIDEO_API_KEY || "").trim()),
    apiKeyConfigured: Boolean(String(env.APIVIDEO_API_KEY || "").trim()),
    approvedPlaybackCount,
    configurationValid: !configurationError,
    configurationError
  };
}

const USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);
const MODES = new Set(["official_embed", "owner_hosted_stream", "metadata_only", "none"]);
const AUTH_MODES = new Set(["none", "api_key", "oauth2", "signed_request"]);

const parseObject = (raw, label) => {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error(`${label} must be a JSON object.`);
  }
};

const clean = value => typeof value === "string" ? value.trim() : "";
function validHttps(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
    if ([...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|auth)$/i.test(key))) return false;
    return true;
  } catch { return false; }
}
function validExpiry(value, now = Date.now()) {
  const expiry = Date.parse(value || "");
  return Number.isFinite(expiry) && expiry > now;
}
function validProviderApproval(record, now = Date.now()) {
  if (!record || record.approved !== true || record.enabled !== true) return false;
  if (!clean(record.rightsHolder) || !clean(record.licenseReference) || !validHttps(record.evidenceUrl) || !validExpiry(record.expiresAt, now)) return false;
  if (!validHttps(record.documentationUrl) || !AUTH_MODES.has(record.authMode) || !MODES.has(record.playbackMode)) return false;
  if (!Array.isArray(record.regions) || !record.regions.length) return false;
  const region = clean(record.region || "VN").toUpperCase();
  return record.regions.includes("GLOBAL") || record.regions.includes(region);
}
function validVideoApproval(record, now = Date.now()) {
  if (!record || record.approved !== true || record.enabled !== true) return false;
  if (!clean(record.rightsHolder) || !clean(record.licenseReference) || !clean(record.creator)) return false;
  if (!clean(record.sourceContentId) || !validHttps(record.sourceUrl) || !validHttps(record.evidenceUrl) || !validExpiry(record.expiresAt, now)) return false;
  if (record.sourceVerified !== true || record.ownershipVerified !== true ||
      record.performerAgeVerified !== true || record.performerConsentVerified !== true) return false;
  if (!Array.isArray(record.permittedUses) || !record.permittedUses.length ||
      record.permittedUses.some(use => !USES.has(use))) return false;
  if (!Array.isArray(record.regions) || !record.regions.length) return false;
  const region = clean(record.region || "VN").toUpperCase();
  return record.regions.includes("GLOBAL") || record.regions.includes(region);
}

export function isProviderRightsApproved(providerId, env = process.env) {
  if (!providerId) return false;
  const registry = parseObject(env.VIDEO_PROVIDER_RIGHTS_JSON, "VIDEO_PROVIDER_RIGHTS_JSON");
  return validProviderApproval(registry[providerId]);
}

export function getVideoRightsRecord(videoId, providerId, env = process.env) {
  if (!videoId || !providerId) return null;
  const registry = parseObject(env.VIDEO_VIDEO_RIGHTS_JSON, "VIDEO_VIDEO_RIGHTS_JSON");
  const record = registry[videoId];
  return record && record.providerId === providerId && validVideoApproval(record) ? record : null;
}

export function hasVideoPermittedUse(videoId, providerId, use, env = process.env) {
  if (!USES.has(use) || !isProviderRightsApproved(providerId, env)) return false;
  const provider = parseObject(env.VIDEO_PROVIDER_RIGHTS_JSON, "VIDEO_PROVIDER_RIGHTS_JSON")[providerId];
  const record = getVideoRightsRecord(videoId, providerId, env);
  if (!record || !record.permittedUses.includes(use)) return false;
  if (use === "metadata_only") return provider.playbackMode !== "none";
  if (use === "official_embed") return provider.playbackMode === "official_embed";
  if (use === "owner_hosted_stream" || use === "redistribute") return provider.playbackMode === "owner_hosted_stream";
  return false;
}

export function isVideoRightsApproved(videoId, providerId, env = process.env, use = "metadata_only") {
  return hasVideoPermittedUse(videoId, providerId, use, env);
}

export function filterRightsApprovedVideos(items, providerId, env = process.env) {
  if (!isProviderRightsApproved(providerId, env) || !Array.isArray(items)) return [];
  return items.flatMap(item => {
    if (!item || !isVideoRightsApproved(item.id, providerId, env, "metadata_only")) return [];
    const canEmbed = hasVideoPermittedUse(item.id, providerId, "official_embed", env);
    const canStream = hasVideoPermittedUse(item.id, providerId, "owner_hosted_stream", env) ||
      hasVideoPermittedUse(item.id, providerId, "redistribute", env);
    return [{
      ...item,
      embedUrl: canEmbed ? item.embedUrl || "" : "",
      videoUrl: canStream ? item.videoUrl || "" : "",
      playItems: canStream ? item.playItems || [] : []
    }];
  });
}

export function providerRightsStatus(providerId, env = process.env) {
  let approved = false;
  try { approved = isProviderRightsApproved(providerId, env); } catch {}
  return { id: providerId, status: approved ? "ENABLED" : "PENDING", enabled: approved, rightsApproved: approved };
}

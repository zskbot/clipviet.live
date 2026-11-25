const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const USES = new Set(["official_embed", "owner_hosted_stream", "redistribute"]);
const MODES = new Set(["official_embed", "owner_hosted_stream", "metadata_only", "none"]);
const REGIONS = new Set(["VN", "CN", "KR", "OTHER", "GLOBAL"]);

const clean = (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const httpsUrl = value => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return "";
    if (!HOST_RE.test(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) return "";
    if ([...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|auth)$/i.test(key))) return "";
    return url.href;
  } catch { return ""; }
};

export function validateConnectorContract(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Connector contract must be an object." };
  const connectorId = clean(input.connectorId, 80);
  const authMode = clean(input.authMode, 30);
  const playbackMode = clean(input.playbackMode, 40);
  const regions = Array.isArray(input.regions) ? [...new Set(input.regions.map(v => clean(v, 8).toUpperCase()))] : [];
  const scopes = Array.isArray(input.scopes) ? [...new Set(input.scopes.map(v => clean(v, 120)).filter(Boolean))].slice(0, 30) : [];
  const documentationUrl = httpsUrl(input.documentationUrl);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(connectorId)) return { error: "A stable lowercase connectorId is required." };
  if (!["none", "api_key", "oauth2", "signed_request"].includes(authMode)) return { error: "Unsupported authMode." };
  if (!MODES.has(playbackMode)) return { error: "Unsupported playbackMode." };
  if (!regions.length || regions.some(v => !REGIONS.has(v))) return { error: "At least one supported region is required." };
  if (!documentationUrl) return { error: "Official HTTPS documentationUrl is required." };
  if (authMode === "none" && scopes.length) return { error: "Scopes require an authenticated connector." };
  return { data: { connectorId, authMode, scopes, regions, playbackMode, documentationUrl } };
}

export function validateContentRights(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Content rights record must be an object." };
  const sourcePlatform = clean(input.sourcePlatform, 80);
  const sourceContentId = clean(input.sourceContentId, 180);
  const sourceUrl = httpsUrl(input.sourceUrl);
  const creator = clean(input.creator, 180);
  const rightsHolder = clean(input.rightsHolder, 180);
  const licenseReference = clean(input.licenseReference, 240);
  const evidenceUrl = httpsUrl(input.evidenceUrl);
  const licenseExpiresAt = clean(input.licenseExpiresAt, 40);
  const permittedUses = Array.isArray(input.permittedUses) ? [...new Set(input.permittedUses)] : [];
  const regions = Array.isArray(input.regions) ? [...new Set(input.regions.map(v => clean(v, 8).toUpperCase()))] : [];
  const sourceVerified = input.sourceVerified === true;
  const ownershipVerified = input.ownershipVerified === true;
  const performerAgeVerified = input.performerAgeVerified === true;
  const performerConsentVerified = input.performerConsentVerified === true;
  if (!sourcePlatform || !sourceContentId || !sourceUrl || !creator || !rightsHolder || !licenseReference || !evidenceUrl) {
    return { error: "Source identity, creator, rights holder, license reference and HTTPS evidence URL are required." };
  }
  if (!Number.isFinite(Date.parse(licenseExpiresAt)) || Date.parse(licenseExpiresAt) <= Date.now()) return { error: "A future license expiry is required." };
  if (!sourceVerified || !ownershipVerified || !performerAgeVerified || !performerConsentVerified) {
    return { error: "Source provenance, ownership, performer age and consent must be verified before legal review." };
  }
  if (!permittedUses.length || permittedUses.some(v => !USES.has(v))) return { error: "At least one explicit permitted use is required." };
  if (!regions.length || regions.some(v => !REGIONS.has(v))) return { error: "Explicit allowed territories are required." };
  return { data: { sourcePlatform, sourceContentId, sourceUrl, creator, rightsHolder, licenseReference, evidenceUrl, licenseExpiresAt, permittedUses, regions, sourceVerified, ownershipVerified, performerAgeVerified, performerConsentVerified } };
}

export function canApproveContentRights(record, role, evidence = {}) {
  if (role !== "legal" || record?.status !== "PENDING") return false;
  const refs = ["permissionReference", "ownershipReference", "ageReference", "consentReference", "reviewReference"];
  return refs.every(key => clean(evidence[key], 240).length > 0) &&
    record.source_verified === 1 && record.ownership_verified === 1 &&
    record.performer_age_verified === 1 && record.performer_consent_verified === 1 &&
    Number.isFinite(Date.parse(record.license_expires_at)) && Date.parse(record.license_expires_at) > Date.now();
}

export function playbackDecision({ provider, content, requestedUse, region, now = Date.now() }) {
  const deny = reason => ({ allowed: false, reason });
  if (!provider || !content) return deny("unknown_provider_or_content");
  if (provider.status !== "ENABLED") return deny("provider_not_enabled");
  if (content.status !== "APPROVED") return deny("content_rights_not_approved");
  if (!Number.isFinite(Date.parse(provider.license_expires_at)) || Date.parse(provider.license_expires_at) <= now) return deny("provider_license_expired");
  if (!Number.isFinite(Date.parse(content.license_expires_at)) || Date.parse(content.license_expires_at) <= now) return deny("content_license_expired");
  let uses = []; let regions = [];
  try { uses = JSON.parse(content.permitted_uses_json || "[]"); regions = JSON.parse(content.regions_json || "[]"); } catch { return deny("rights_metadata_invalid"); }
  if (!USES.has(requestedUse) || !uses.includes(requestedUse)) return deny("requested_use_not_licensed");
  if (provider.playback_mode === "metadata_only" || provider.playback_mode === "none") return deny("connector_does_not_support_playback");
  if (requestedUse === "official_embed" && provider.playback_mode !== "official_embed") return deny("connector_embed_mode_mismatch");
  if (requestedUse === "owner_hosted_stream" && provider.playback_mode !== "owner_hosted_stream") return deny("connector_stream_mode_mismatch");
  if (requestedUse === "redistribute" && provider.playback_mode !== "owner_hosted_stream") return deny("connector_redistribution_mode_mismatch");
  const target = clean(region, 8).toUpperCase();
  if (!target || !(regions.includes("GLOBAL") || regions.includes(target))) return deny("territory_not_licensed");
  if (Array.isArray(provider.connector_regions) && !(provider.connector_regions.includes("GLOBAL") || provider.connector_regions.includes(target))) return deny("connector_region_not_supported");
  if (content.source_verified !== 1 || content.ownership_verified !== 1 || content.performer_age_verified !== 1 || content.performer_consent_verified !== 1) return deny("provenance_or_consent_incomplete");
  return { allowed: true, use: requestedUse, region: target, sourceUrl: content.source_url, playbackMode: provider.playback_mode || "metadata_only" };
}

export const CONNECTOR_PLAYBACK_MODES = Object.freeze(["official_embed", "owner_hosted_stream", "metadata_only", "none"]);

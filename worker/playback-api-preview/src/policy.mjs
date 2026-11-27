const USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);

export function parseJsonArray(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeEvidenceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && url.hostname.includes(".") && url.hostname !== "localhost";
  } catch {
    return false;
  }
}

function normalizeHostRule(value) {
  let rule = String(value || "").trim().toLowerCase();
  if (!rule) return "";
  if (rule.startsWith("https://") || rule.startsWith("http://")) {
    try {
      const parsed = new URL(rule);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
      rule = parsed.hostname;
    } catch {
      return "";
    }
  }
  const wildcard = rule.startsWith("*.");
  if (wildcard) rule = rule.slice(2);
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(rule)) return "";
  return wildcard ? "*." + rule : rule;
}

export function isAllowedMediaUrl(value, mediaHosts) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    const rules = (Array.isArray(mediaHosts) ? mediaHosts : [])
      .map(normalizeHostRule).filter(Boolean);
    return rules.some(rule => {
      if (rule.startsWith("*.")) {
        const base = rule.slice(2);
        return host !== base && host.endsWith("." + base);
      }
      return host === rule;
    });
  } catch {
    return false;
  }
}

export function evaluatePlaybackRights(row, region = "VN", now = Date.now()) {
  const deny = reason => ({ allowed: false, reason });
  if (!row) return deny("video_rights_not_registered");
  if (!["APPROVED", "ENABLED"].includes(String(row.provider_status || "").toUpperCase())) return deny("provider_not_approved");
  if (String(row.connector_status || "").toUpperCase() !== "APPROVED") return deny("connector_not_approved");
  if (String(row.content_status || "").toUpperCase() !== "APPROVED") return deny("content_rights_not_approved");
  if (String(row.playback_mode || "") !== "owner_hosted_stream") return deny("direct_stream_mode_not_approved");

  const providerExpiry = Date.parse(row.provider_license_expires_at || "");
  const contentExpiry = Date.parse(row.content_license_expires_at || "");
  if (!Number.isFinite(providerExpiry) || providerExpiry <= now) return deny("provider_license_expired");
  if (!Number.isFinite(contentExpiry) || contentExpiry <= now) return deny("content_license_expired");

  const regionCode = String(region || "").trim().toUpperCase();
  const uses = parseJsonArray(row.permitted_uses_json).map(value => String(value));
  const contentRegions = parseJsonArray(row.content_regions_json).map(value => String(value).toUpperCase());
  const connectorRegions = parseJsonArray(row.connector_regions_json).map(value => String(value).toUpperCase());
  const mediaHosts = parseJsonArray(row.media_hosts_json).map(normalizeHostRule).filter(Boolean);

  if (![...uses].some(use => USES.has(use) && ["owner_hosted_stream", "redistribute"].includes(use))) return deny("direct_playback_not_licensed");
  if (!regionCode || !(contentRegions.includes("GLOBAL") || contentRegions.includes(regionCode))) return deny("content_territory_not_licensed");
  if (!(connectorRegions.includes("GLOBAL") || connectorRegions.includes(regionCode))) return deny("connector_region_not_supported");
  if (row.source_verified !== 1 || row.ownership_verified !== 1 ||
      row.performer_age_verified !== 1 || row.performer_consent_verified !== 1) return deny("provenance_or_consent_incomplete");

  if (!String(row.provider_rights_holder || "").trim() || !String(row.provider_license_reference || "").trim() ||
      !safeEvidenceUrl(row.provider_rights_evidence_url)) return deny("provider_license_evidence_incomplete");
  if (!String(row.content_rights_holder || "").trim() || !String(row.content_license_reference || "").trim() ||
      !safeEvidenceUrl(row.content_source_url) || !safeEvidenceUrl(row.content_evidence_url)) return deny("content_license_evidence_incomplete");
  if (!mediaHosts.length) return deny("media_host_allowlist_empty");

  return {
    allowed: true,
    permittedUses: uses,
    mediaHosts,
    expiresAt: new Date(Math.min(providerExpiry, contentExpiry)).toISOString()
  };
}

export function parsePlaybackLines(playUrl, playFrom, mediaHosts) {
  const names = String(playFrom || "").split("$$$");
  return String(playUrl || "").split("$$$").map((line, lineIndex) => ({
    lineName: String(names[lineIndex] || ("Nguồn " + (lineIndex + 1))).slice(0, 80),
    episodes: line.split("#").filter(Boolean).map((segment, index) => {
      const separator = segment.lastIndexOf("$");
      const name = separator >= 0 ? segment.slice(0, separator) : "";
      const url = separator >= 0 ? segment.slice(separator + 1) : segment;
      if (!isAllowedMediaUrl(url, mediaHosts)) return null;
      let type = "auto";
      try {
        const pathname = new URL(url).pathname.toLowerCase();
        if (/\.m3u8$/.test(pathname)) type = "hls";
        else if (/\.mp4$/.test(pathname)) type = "mp4";
      } catch {}
      return { index, name: String(name || ("Tập " + (index + 1))).slice(0, 120), url, type };
    }).filter(Boolean)
  })).filter(line => line.episodes.length);
}

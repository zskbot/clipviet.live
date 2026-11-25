const DEFAULT_EMBED_HOSTS = new Set([
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.dailymotion.com"
]);

function parseHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === "::1") return null;
    return url;
  } catch { return null; }
}

function configuredHosts(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  return new Set(entries.map(host => String(host).trim().toLowerCase()).filter(host =>
    host && /^[a-z0-9.-]+$/.test(host) && !host.startsWith(".") && !host.endsWith(".")
  ));
}

export function isAllowedEmbedUrl(value, configured = "") {
  const url = parseHttpsUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const allowed = new Set([...DEFAULT_EMBED_HOSTS, ...configuredHosts(configured)]);
  if (!allowed.has(host)) return false;
  if (host === "youtube-nocookie.com" || host === "www.youtube-nocookie.com") {
    return /^\/embed\/[A-Za-z0-9_-]{6,20}\/?$/.test(url.pathname);
  }
  if (host === "player.vimeo.com") return /^\/video\/\d+\/?$/.test(url.pathname);
  if (host === "www.dailymotion.com") return /^\/embed\/video\/[A-Za-z0-9]+\/?$/.test(url.pathname);
  return url.pathname.startsWith("/");
}

export function isAllowedMediaUrl(value, configured = "") {
  const url = parseHttpsUrl(value);
  return Boolean(url && configuredHosts(configured).has(url.hostname.toLowerCase()));
}

export function isAllowedApiUrl(value, configured = "") {
  const url = parseHttpsUrl(value);
  return Boolean(url && configuredHosts(configured).has(url.hostname.toLowerCase()));
}

export function getVideoSecurityConfig(env = process.env) {
  return {
    embedHosts: [...new Set([...DEFAULT_EMBED_HOSTS, ...configuredHosts(env.VIDEO_EMBED_ALLOWED_HOSTS)])].sort(),
    mediaHosts: [...configuredHosts(env.VIDEO_MEDIA_ALLOWED_HOSTS)].sort(),
    apiHosts: [...configuredHosts(env.VIDEO_API_ALLOWED_HOSTS)].sort()
  };
}

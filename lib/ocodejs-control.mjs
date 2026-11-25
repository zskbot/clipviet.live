const READ_ONLY_ENDPOINTS = [
  "/health/live",
  "/health/ready",
  "/services",
  "/agents",
  "/providers",
  "/runtime/status",
  "/mcp/connections",
];
const REDACT_KEY = /(token|secret|password|authorization|api[_-]?key|credential|cookie)/i;

function safeValue(value, depth = 0) {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => safeValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key, item]) => [
      key,
      REDACT_KEY.test(key) ? "[redacted]" : safeValue(item, depth + 1),
    ]));
  }
  if (typeof value === "string") return value.length > 2000 ? value.slice(0, 2000) + "…" : value;
  return value;
}

function getConfig() {
  const raw = process.env.OCODEJS_API_BASE_URL || "https://ocodejs.id.vn";
  const base = new URL(raw);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("OCODEJS_API_BASE_URL must be a clean HTTPS base URL.");
  }
  return { base, token: process.env.OCODEJS_API_TOKEN || "" };
}

export async function getOcodejsOverview() {
  const { base, token } = getConfig();
  if (!token) {
    return {
      configured: false,
      baseUrl: base.origin,
      message: "Thiếu OCODEJS_API_TOKEN trong secret/environment của server.",
      checks: READ_ONLY_ENDPOINTS.map((path) => ({ path, state: "not_configured" })),
    };
  }

  const checks = await Promise.all(READ_ONLY_ENDPOINTS.map(async (path) => {
    const url = new URL(path, base);
    if (url.origin !== base.origin) return { path, state: "blocked", error: "Endpoint origin mismatch." };
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      const raw = await response.text();
      if (raw.length > 65536) return { path, state: "error", status: response.status, error: "Response exceeds 64 KB." };
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; }
      catch { data = { message: raw.slice(0, 500) }; }
      return {
        path,
        state: response.ok ? "ok" : "error",
        status: response.status,
        data: response.ok ? safeValue(data) : undefined,
        error: response.ok ? undefined : "OCodeJS endpoint returned a non-success status.",
      };
    } catch (error) {
      return {
        path,
        state: "unreachable",
        error: error?.name === "TimeoutError" ? "Request timed out." : "Could not reach OCodeJS endpoint.",
      };
    }
  }));

  return {
    configured: true,
    baseUrl: base.origin,
    mode: "read_only",
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export const OCODEJS_READ_ONLY_ENDPOINTS = READ_ONLY_ENDPOINTS;

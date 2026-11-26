const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

function origin(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new Error(label + " must be an HTTPS origin.");
  }
}

function cleanPath(path) {
  if (path.includes("\\") || path.split("/").some(part => part === "." || part === "..")) return null;
  return path || "/";
}

function copyHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of ["host", "cookie", "authorization", "cf-access-jwt-assertion", "origin", "referer"]) {
    headers.delete(name);
  }
  headers.set("x-clipviet-preview-gateway", "1");
  return headers;
}

async function proxy(request, targetOrigin, targetPath) {
  const incoming = new URL(request.url);
  const target = new URL(targetPath + incoming.search, targetOrigin);
  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    return json({ error: "Read-only Preview gateway. Write operations are disabled." }, 405);
  }
  const upstream = new Request(target, {
    method,
    headers: copyHeaders(request),
    redirect: "manual"
  });
  const response = await fetch(upstream);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-clipviet-preview-route", "cloudflare-preview-gateway");
  headers.delete("set-cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = cleanPath(url.pathname);
    if (!path) return json({ error: "Invalid path." }, 400);

    if (path === "/health" || path === "/health/") {
      return json({
        ok: true,
        service: "clipviet-unified-preview-gateway",
        environment: "preview",
        routes: ["/", "/docs", "/video", "/tag", "/group", "/api/catalog/*"],
        admin: "locked-pending-access-policy",
        uploads: "disabled-no-video-r2-bucket"
      });
    }

    const method = request.method.toUpperCase();
    if (path === "/admin" || path.startsWith("/admin/")) {
      return json({
        error: "Admin Preview is locked until the dedicated Cloudflare Access policy and metadata CMS are verified.",
        code: "ADMIN_PREVIEW_LOCKED"
      }, 423);
    }

    if (path === "/upload" || path.startsWith("/upload/")) {
      return json({
        error: "Video file upload is not enabled. No dedicated video R2 bucket is configured.",
        code: "VIDEO_STORAGE_NOT_PROVISIONED"
      }, 501);
    }

    const catalogOrigin = origin(env.CATALOG_API_ORIGIN, "CATALOG_API_ORIGIN");
    if (path === "/api" || path.startsWith("/api/")) {
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        return json({ error: "Catalog API is read-only in Preview." }, 405);
      }
      if (path.startsWith("/api/admin/")) return json({ error: "Admin API is locked." }, 423);
      return proxy(request, catalogOrigin, path);
    }

    const modulesOrigin = origin(env.MODULES_ORIGIN, "MODULES_ORIGIN");
    const frontendOrigin = origin(env.FRONTEND_ORIGIN, "FRONTEND_ORIGIN");
    if (path === "/docs" || path.startsWith("/docs/")) {
      const suffix = path.slice("/docs".length);
      return proxy(request, modulesOrigin, "/api-docs/" + suffix.replace(/^\//, ""));
    }
    if (path === "/video" || path.startsWith("/video/")) {
      return proxy(request, modulesOrigin, path === "/video" ? "/video/" : path);
    }
    if (path === "/tag" || path.startsWith("/tag/")) {
      return proxy(request, modulesOrigin, path === "/tag" ? "/tag/" : path);
    }
    if (path === "/group" || path.startsWith("/group/")) {
      return proxy(request, modulesOrigin, path === "/group" ? "/group/" : path);
    }

    return proxy(request, frontendOrigin, path);
  }
};

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

function copyHeaders(request, preserveAccess = false) {
  const headers = new Headers(request.headers);
  for (const name of ["host", "cookie", "authorization", "origin", "referer"]) headers.delete(name);
  if (!preserveAccess) headers.delete("cf-access-jwt-assertion");
  headers.set("x-clipviet-preview-gateway", "1");
  return headers;
}

async function proxy(request, targetOrigin, targetPath, preserveAccess = false) {
  const incoming = new URL(request.url);
  const target = new URL(targetPath + incoming.search, targetOrigin);
  const method = request.method.toUpperCase();
  const allowed = preserveAccess ? ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"] : ["GET", "HEAD", "OPTIONS"];
  if (!allowed.includes(method)) return json({ error: "Method not allowed by Preview gateway." }, 405);
  const init = { method, headers: copyHeaders(request, preserveAccess), redirect: "manual" };
  if (preserveAccess && !["GET", "HEAD"].includes(method) && request.body) init.body = request.body;
  const upstream = new Request(target, init);
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
        routes: ["/", "/docs", "/video", "/tag", "/group", "/api/videos", "/api/tags", "/api/groups", "/api/catalog/*", "/admin/*"],
        admin: "cloudflare-access-mfa",
        uploads: "disabled-no-video-r2-bucket"
      });
    }

    const method = request.method.toUpperCase();
    const modulesOrigin = origin(env.MODULES_ORIGIN, "MODULES_ORIGIN");
    const videoCmsOrigin = origin(env.VIDEO_CMS_ORIGIN, "VIDEO_CMS_ORIGIN");
    const frontendOrigin = origin(env.FRONTEND_ORIGIN, "FRONTEND_ORIGIN");

    if (path.startsWith("/admin/api/")) {
      if (!["GET", "POST", "PUT", "DELETE", "OPTIONS"].includes(method)) return json({ error: "Method not allowed." }, 405);
      return proxy(request, videoCmsOrigin, path, true);
    }
    if (path === "/admin" || path.startsWith("/admin/")) {
      return proxy(request, modulesOrigin, path === "/admin" ? "/admin/" : path);
    }

    if (path === "/upload" || path.startsWith("/upload/")) {
      return json({
        error: "Video file upload is not enabled. No dedicated video R2 bucket is configured.",
        code: "VIDEO_STORAGE_NOT_PROVISIONED"
      }, 501);
    }

    if (path === "/api/videos") return proxy(request, videoCmsOrigin, "/public/videos");
    if (path === "/api/tags") return proxy(request, videoCmsOrigin, "/public/tags");
    if (path === "/api/groups") return proxy(request, videoCmsOrigin, "/public/groups");
    if (path === "/api/catalog" || path.startsWith("/api/catalog/")) {
      return proxy(request, modulesOrigin, path);
    }
    if (path === "/api" || path.startsWith("/api/")) {
      return json({ error: "API route not available in Preview." }, 404);
    }

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

// Preview-only, same-origin, read-only metadata endpoint.
// The D1 binding exists only in the Pages preview environment (wrangler.toml).
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  }
});

const safeArray = value => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "allow": "GET, HEAD, OPTIONS",
        "cache-control": "no-store"
      }
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Public Admin is read-only. Write operations are disabled." }, 403);
  }

  if (!env.DB) {
    return json({ error: "Preview D1 binding is unavailable on this deployment." }, 503);
  }

  try {
    const result = await env.DB.prepare(
      "SELECT id,slug,title,description,video_url,poster_url,tags_json,groups_json,rights_status,status,created_at,updated_at,published_at FROM clipviet_videos ORDER BY updated_at DESC LIMIT 200"
    ).all();

    const rows = (result.results || []).map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      videoUrl: row.video_url,
      posterUrl: row.poster_url,
      tags: safeArray(row.tags_json),
      groups: safeArray(row.groups_json),
      rightsStatus: row.rights_status,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at
    }));

    return json({ data: rows, count: rows.length });
  } catch (error) {
    console.error("clipviet_admin_read_error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unable to read Preview metadata from D1." }, 500);
  }
}

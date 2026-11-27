export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ success: false, error: "Read-only endpoint", allow: ["GET", "HEAD"] }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", allow: "GET, HEAD" }
    });
  }
  if (!env?.DB) {
    return new Response(JSON.stringify({ success: false, error: "Preview D1 binding unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const sql = `
    SELECT
      p.id,
      p.name,
      p.status AS provider_status,
      p.api_host,
      COALESCE(c.status, 'NOT_CONFIGURED') AS connector_status,
      (SELECT COUNT(*) FROM provider_content_rights r WHERE r.provider_id = p.id AND r.status = 'APPROVED') AS approved_content_rows,
      (SELECT COUNT(*) FROM provider_content_rights r WHERE r.provider_id = p.id AND r.status = 'PENDING') AS pending_content_rows,
      (SELECT COUNT(*) FROM provider_content_rights r WHERE r.provider_id = p.id AND r.status = 'REJECTED') AS rejected_content_rows
    FROM provider_registry p
    LEFT JOIN provider_connectors c ON c.provider_id = p.id
    ORDER BY p.id ASC
  `;
  const result = await env.DB.prepare(sql).all();
  const data = (result.results || []).map(row => ({
    id: row.id,
    name: row.name,
    providerStatus: row.provider_status,
    apiHost: row.api_host,
    connectorStatus: row.connector_status,
    approvedContentRows: Number(row.approved_content_rows || 0),
    pendingContentRows: Number(row.pending_content_rows || 0),
    rejectedContentRows: Number(row.rejected_content_rows || 0)
  }));
  const eligibleRows = data.reduce((sum, item) => sum + item.approvedContentRows, 0);
  const body = {
    success: true,
    mode: "read-only-preview",
    source: "clipviet-preview-d1-provider-registry",
    policy: "deny-by-default",
    providerCount: data.length,
    approvedProviders: data.filter(item => ["APPROVED", "ENABLED"].includes(String(item.providerStatus).toUpperCase())).length,
    approvedConnectors: data.filter(item => String(item.connectorStatus).toUpperCase() === "APPROVED").length,
    approvedContentRows: eligibleRows,
    eligiblePageCountAtPageSize30: Math.ceil(eligibleRows / 30),
    data
  };
  return new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

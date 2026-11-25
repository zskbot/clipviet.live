import registry from "./index.mjs";
import { resolveRole } from "./security.mjs";
import { validateConnectorContract, validateContentRights, canApproveContentRights, playbackDecision } from "./rights-gate.mjs";

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
const clean = (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
function equalSecret(a, b) {
  const x = new TextEncoder().encode(a || ""), y = new TextEncoder().encode(b || "");
  if (!x.length || x.length !== y.length) return false;
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16 * 1024) return { error: "Request body too large.", status: 413 };
  const raw = await request.text();
  if (raw.length > 16 * 1024) return { error: "Request body too large.", status: 413 };
  try { return { data: JSON.parse(raw || "{}") }; } catch { return { error: "Invalid JSON body.", status: 400 }; }
}
const previewOnly = request => {
  const host = new URL(request.url).hostname.toLowerCase();
  return /^clipviet-provider-registry-preview\.[a-z0-9-]+\.workers\.dev$/.test(host);
};
const rowToJson = row => ({
  id: row.id, providerId: row.provider_id, sourcePlatform: row.source_platform,
  sourceContentId: row.source_content_id, sourceUrl: row.source_url, creator: row.creator,
  rightsHolder: row.rights_holder, licenseReference: row.license_reference,
  evidenceUrl: row.evidence_url, licenseExpiresAt: row.license_expires_at,
  permittedUses: JSON.parse(row.permitted_uses_json), regions: JSON.parse(row.regions_json),
  status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const rightsRoute = (parts[0] === "providers" && (parts[2] === "content-rights" || parts[2] === "connector")) ||
      (parts[0] === "playback" && parts[1] === "authorize");
    if (!rightsRoute) return registry.fetch(request, env, ctx);
    if (env.REGISTRY_ENV !== "preview" || !previewOnly(request)) return json({ error: "Preview-only registry is disabled." }, 404);

    const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
    const origin = request.headers.get("origin") || "";
    if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403);
    const cors = {};
    if (origin) { cors["Access-Control-Allow-Origin"] = origin; cors.Vary = "Origin"; }
    cors["Access-Control-Allow-Methods"] = "GET,POST,PATCH,OPTIONS";
    cors["Access-Control-Allow-Headers"] = "Authorization,Content-Type";
    cors["Access-Control-Max-Age"] = "600";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const role = await resolveRole(request, env, equalSecret);
    if (!role) return json({ error: "Unauthorized" }, 401, cors);
    if (!env.PROVIDER_DB) return json({ error: "Preview D1 binding is not configured." }, 503, cors);
    const db = env.PROVIDER_DB;
    try {
      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "connector" && request.method === "GET") {
        if (!["admin", "technical", "legal"].includes(role)) return json({ error: "Forbidden" }, 403, cors);
        const connector = await db.prepare("SELECT * FROM provider_connectors WHERE provider_id=?").bind(parts[1]).first();
        return json({ connector: connector ? { connectorId:connector.connector_id, authMode:connector.auth_mode, scopes:JSON.parse(connector.scopes_json), regions:JSON.parse(connector.regions_json), playbackMode:connector.playback_mode, documentationUrl:connector.documentation_url, status:connector.status, evidenceReference:connector.evidence_reference } : null }, 200, cors);
      }

      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "connector" && request.method === "POST") {
        if (role !== "admin") return json({ error: "Admin role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const parsed = validateConnectorContract(parsedBody.data);
        if (parsed.error) return json({ error: parsed.error }, 400, cors);
        const provider = await db.prepare("SELECT id FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider) return json({ error: "Provider not found." }, 404, cors);
        const existing = await db.prepare("SELECT provider_id FROM provider_connectors WHERE provider_id=?").bind(parts[1]).first();
        if (existing) return json({ error: "Connector already exists for this provider; create a reviewed change request instead of replacing it." }, 409, cors);
        const c = parsed.data, now = new Date().toISOString(), eventId = crypto.randomUUID();
        await db.batch([
          db.prepare("INSERT INTO provider_connectors (provider_id,connector_id,auth_mode,scopes_json,regions_json,playback_mode,documentation_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(parts[1],c.connectorId,c.authMode,JSON.stringify(c.scopes),JSON.stringify(c.regions),c.playbackMode,c.documentationUrl,"PENDING",now,now),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
            .bind(eventId,parts[1],"CONNECTOR_REGISTERED",null,"PENDING",role,JSON.stringify({connectorId:c.connectorId,authMode:c.authMode,playbackMode:c.playbackMode,scopes:c.scopes,regions:c.regions}),now)
        ]);
        return json({ connector:{...c,status:"PENDING"} },201,cors);
      }

      if (parts[0] === "providers" && parts.length === 4 && parts[2] === "connector" && parts[3] === "approve" && request.method === "PATCH") {
        if (role !== "legal") return json({ error: "Legal reviewer role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const evidenceReference = clean(parsedBody.data.evidenceReference);
        if (!evidenceReference) return json({ error: "Connector documentation and scope review reference is required." },400,cors);
        const provider = await db.prepare("SELECT id,status FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider || !["VERIFIED","APPROVED","ENABLED"].includes(provider.status)) return json({ error: "Provider must pass technical verification before connector approval." },409,cors);
        const connector = await db.prepare("SELECT * FROM provider_connectors WHERE provider_id=?").bind(parts[1]).first();
        if (!connector || connector.status !== "PENDING") return json({ error: "Pending connector not found." },404,cors);
        const now = new Date().toISOString(), eventId = crypto.randomUUID();
        await db.batch([
          db.prepare("UPDATE provider_connectors SET status='APPROVED',evidence_reference=?,updated_at=? WHERE provider_id=? AND status='PENDING'").bind(evidenceReference,now,parts[1]),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) SELECT ?,?,?,?, ?,?,?,? WHERE EXISTS (SELECT 1 FROM provider_connectors WHERE provider_id=? AND status='APPROVED' AND updated_at=?)").bind(eventId,parts[1],"CONNECTOR_APPROVED","PENDING","APPROVED",role,JSON.stringify({connectorId:connector.connector_id,evidenceReference}),now,parts[1],now)
        ]);
        const updated = await db.prepare("SELECT * FROM provider_connectors WHERE provider_id=?").bind(parts[1]).first();
        if (!updated || updated.status !== "APPROVED") return json({ error: "Connector approval failed or conflicted." },409,cors);
        return json({ connector:{connectorId:updated.connector_id,authMode:updated.auth_mode,scopes:JSON.parse(updated.scopes_json),regions:JSON.parse(updated.regions_json),playbackMode:updated.playback_mode,documentationUrl:updated.documentation_url,status:updated.status,evidenceReference:updated.evidence_reference} },200,cors);
      }

      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "content-rights" && request.method === "GET") {
        if (!["admin", "technical", "legal"].includes(role)) return json({ error: "Forbidden" }, 403, cors);
        const result = await db.prepare("SELECT * FROM provider_content_rights WHERE provider_id=? ORDER BY created_at DESC LIMIT 500").bind(parts[1]).all();
        return json({ records: (result.results || []).map(rowToJson) }, 200, cors);
      }

      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "content-rights" && request.method === "POST") {
        if (role !== "admin") return json({ error: "Admin role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const parsed = validateContentRights(parsedBody.data);
        if (parsed.error) return json({ error: parsed.error }, 400, cors);
        const provider = await db.prepare("SELECT id,status FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider) return json({ error: "Provider not found." }, 404, cors);
        const data = parsed.data;
        const id = crypto.randomUUID(), eventId = crypto.randomUUID(), now = new Date().toISOString();
        await db.batch([
          db.prepare("INSERT INTO provider_content_rights (id,provider_id,source_platform,source_content_id,source_url,creator,rights_holder,license_reference,evidence_url,license_expires_at,permitted_uses_json,regions_json,source_verified,ownership_verified,performer_age_verified,performer_consent_verified,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id,parts[1],data.sourcePlatform,data.sourceContentId,data.sourceUrl,data.creator,data.rightsHolder,data.licenseReference,data.evidenceUrl,data.licenseExpiresAt,JSON.stringify(data.permittedUses),JSON.stringify(data.regions),1,1,1,1,"PENDING",now,now),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
            .bind(eventId,parts[1],"CONTENT_RIGHTS_CREATED",null,"PENDING",role,JSON.stringify({contentRightsId:id,sourcePlatform:data.sourcePlatform,sourceContentId:data.sourceContentId}),now)
        ]);
        const row = await db.prepare("SELECT * FROM provider_content_rights WHERE id=?").bind(id).first();
        return json({ record: rowToJson(row) }, 201, cors);
      }

      if (parts[0] === "providers" && parts.length === 5 && parts[2] === "content-rights" && parts[4] === "approve" && request.method === "PATCH") {
        if (role !== "legal") return json({ error: "Legal reviewer role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const evidence = parsedBody.data.evidence || {};
        const row = await db.prepare("SELECT * FROM provider_content_rights WHERE provider_id=? AND id=?").bind(parts[1],parts[3]).first();
        if (!row) return json({ error: "Content rights record not found." }, 404, cors);
        if (!canApproveContentRights(row, role, evidence)) return json({ error: "Approval denied: provenance, consent, license expiry or legal evidence is incomplete." }, 409, cors);
        const provider = await db.prepare("SELECT id,status,license_expires_at FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider || !["VERIFIED","APPROVED","ENABLED"].includes(provider.status) || !Number.isFinite(Date.parse(provider.license_expires_at)) || Date.parse(provider.license_expires_at) <= Date.now()) return json({ error: "Provider must be technically verified and have a current provider-level license." }, 409, cors);
        const eventId = crypto.randomUUID(), now = new Date().toISOString();
        const legalEvidence = JSON.stringify({
          permissionReference:clean(evidence.permissionReference), ownershipReference:clean(evidence.ownershipReference),
          ageReference:clean(evidence.ageReference), consentReference:clean(evidence.consentReference),
          reviewReference:clean(evidence.reviewReference), reviewedAt:now
        });
        await db.batch([
          db.prepare("UPDATE provider_content_rights SET status='APPROVED',legal_evidence_json=?,updated_at=? WHERE id=? AND provider_id=? AND status='PENDING'")
            .bind(legalEvidence,now,parts[3],parts[1]),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) SELECT ?,?,?,?, ?,?,?,? WHERE EXISTS (SELECT 1 FROM provider_content_rights WHERE id=? AND provider_id=? AND status='APPROVED' AND updated_at=?)")
            .bind(eventId,parts[1],"CONTENT_RIGHTS_APPROVED","PENDING","APPROVED",role,JSON.stringify({contentRightsId:parts[3],evidenceRecorded:true}),now,parts[3],parts[1],now)
        ]);
        const updated = await db.prepare("SELECT * FROM provider_content_rights WHERE id=? AND provider_id=?").bind(parts[3],parts[1]).first();
        if (!updated || updated.status !== "APPROVED") return json({ error: "Concurrent update or approval failed." }, 409, cors);
        return json({ record: rowToJson(updated) }, 200, cors);
      }

      if (parts[0] === "providers" && parts.length === 4 && parts[2] === "connector" && parts[3] === "disable" && request.method === "PATCH") {
        if (role !== "admin" && role !== "legal") return json({ error: "Admin or legal reviewer role required." },403,cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error },parsedBody.status,cors);
        const reason = clean(parsedBody.data.reason);
        if (!reason) return json({ error: "A disable reason is required." },400,cors);
        const connector = await db.prepare("SELECT * FROM provider_connectors WHERE provider_id=?").bind(parts[1]).first();
        if (!connector || connector.status === "DISABLED") return json({ error: "Active connector not found." },404,cors);
        const now = new Date().toISOString(), eventId = crypto.randomUUID();
        await db.batch([
          db.prepare("UPDATE provider_connectors SET status='DISABLED',updated_at=? WHERE provider_id=? AND status<>'DISABLED'").bind(now,parts[1]),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) SELECT ?,?,?,?, ?,?,?,? WHERE EXISTS (SELECT 1 FROM provider_connectors WHERE provider_id=? AND status='DISABLED' AND updated_at=?)").bind(eventId,parts[1],"CONNECTOR_DISABLED",connector.status,"DISABLED",role,JSON.stringify({connectorId:connector.connector_id,reason}),now,parts[1],now)
        ]);
        return json({ status:"DISABLED", reason },200,cors);
      }

      if (parts[0] === "providers" && parts.length === 5 && parts[2] === "content-rights" && parts[4] === "revoke" && request.method === "PATCH") {
        if (role !== "admin" && role !== "legal") return json({ error: "Admin or legal reviewer role required." },403,cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error },parsedBody.status,cors);
        const reason = clean(parsedBody.data.reason);
        if (!reason) return json({ error: "A takedown or revocation reason is required." },400,cors);
        const row = await db.prepare("SELECT * FROM provider_content_rights WHERE provider_id=? AND id=?").bind(parts[1],parts[3]).first();
        if (!row) return json({ error: "Content rights record not found." },404,cors);
        const now = new Date().toISOString(), eventId = crypto.randomUUID();
        await db.batch([
          db.prepare("UPDATE provider_content_rights SET status='REVOKED',updated_at=? WHERE id=? AND provider_id=? AND status<>'REVOKED'").bind(now,parts[3],parts[1]),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) SELECT ?,?,?,?, ?,?,?,? WHERE EXISTS (SELECT 1 FROM provider_content_rights WHERE id=? AND provider_id=? AND status='REVOKED' AND updated_at=?)").bind(eventId,parts[1],"CONTENT_RIGHTS_REVOKED",row.status,"REVOKED",role,JSON.stringify({contentRightsId:parts[3],reason}),now,parts[3],parts[1],now)
        ]);
        const updated = await db.prepare("SELECT status FROM provider_content_rights WHERE id=? AND provider_id=?").bind(parts[3],parts[1]).first();
        if (!updated || updated.status !== "REVOKED") return json({ error: "Rights revocation failed or conflicted." },409,cors);
        return json({ status:"REVOKED", reason },200,cors);
      }

      if (parts[0] === "playback" && parts[1] === "authorize" && request.method === "GET") {
        if (!["admin", "technical", "legal"].includes(role)) return json({ error: "Forbidden" }, 403, cors);
        const providerId = clean(url.searchParams.get("providerId"),80);
        const contentId = clean(url.searchParams.get("contentId"),80);
        const requestedUse = clean(url.searchParams.get("use"),40);
        const region = clean(url.searchParams.get("region"),8);
        if (!providerId || !contentId || !requestedUse || !region) return json({ allowed:false,reason:"missing_policy_input" },400,cors);
        const provider = await db.prepare("SELECT status,license_expires_at FROM provider_registry WHERE id=?").bind(providerId).first();
        const connector = await db.prepare("SELECT status,playback_mode,regions_json FROM provider_connectors WHERE provider_id=?").bind(providerId).first();
        const content = await db.prepare("SELECT * FROM provider_content_rights WHERE id=? AND provider_id=?").bind(contentId,providerId).first();
        if (!connector || connector.status !== "APPROVED") return json({allowed:false,reason:"connector_not_approved"},403,cors);
        const decision = playbackDecision({provider:{...provider,playback_mode:connector.playback_mode,connector_regions:JSON.parse(connector.regions_json)},content,requestedUse,region});
        return json(decision, decision.allowed ? 200 : 403, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch {
      return json({ error: "Internal rights-gate error." }, 500, cors);
    }
  }
};

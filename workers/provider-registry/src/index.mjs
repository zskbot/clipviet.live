import { resolveRole, encryptCredential, rotateCredentials } from "./security.mjs";
const MAX_BODY = 16 * 1024;
const STATES = new Set(["PENDING", "VERIFIED", "APPROVED", "ENABLED"]);
const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}
function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeHost(value) {
  const host = clean(value, 253).toLowerCase();
  if (!HOST_RE.test(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return "";
  return host;
}
function safeHttps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if ([...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|auth)$/i.test(key))) return null;
    if (!safeHost(url.hostname)) return null;
    return url;
  } catch { return null; }
}
function equalSecret(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length || !x.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
function validEvidenceUrl(value) {
  const url = safeHttps(value);
  return url ? url.toString() : "";
}
export function validateProviderInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "A JSON object is required." };
  if (input.apiCredential !== undefined && (typeof input.apiCredential !== "string" || input.apiCredential.length > 4096)) {
    return { error: "API credential must be a string no longer than 4096 characters." };
  }
  const name = clean(input.name, 100);
  const apiBaseUrl = safeHttps(input.apiBaseUrl);
  const rightsHolder = clean(input.rightsHolder, 180);
  const licenseReference = clean(input.licenseReference, 240);
  const rightsEvidenceUrl = validEvidenceUrl(input.rightsEvidenceUrl);
  const licenseExpiresAt = clean(input.licenseExpiresAt, 40);
  const apiHost = safeHost(input.apiHost || apiBaseUrl?.hostname || "");
  const mediaHosts = Array.isArray(input.mediaHosts) ? [...new Set(input.mediaHosts.map(safeHost).filter(Boolean))].slice(0, 20) : [];
  if (!name || !apiBaseUrl || !apiHost || apiBaseUrl.hostname.toLowerCase() !== apiHost) return { error: "Name and an HTTPS API URL on the exact apiHost are required." };
  if (!rightsHolder || !licenseReference || !rightsEvidenceUrl || !Number.isFinite(Date.parse(licenseExpiresAt)) || Date.parse(licenseExpiresAt) <= Date.now()) {
    return { error: "Rights holder, license reference, evidence URL and a future license expiry are required." };
  }
  if (input.distributionRightsAttested !== true) return { error: "Distribution-rights attestation is required." };
  if (!Array.isArray(input.mediaHosts) || !input.mediaHosts.length || mediaHosts.length !== input.mediaHosts.length) return { error: "At least one valid exact media hostname is required." };
  return { data: {
    name, apiBaseUrl: apiBaseUrl.toString(), apiHost, mediaHosts,
    rightsHolder, licenseReference, rightsEvidenceUrl, licenseExpiresAt,
    distributionRightsAttested: true,
    apiCredential: clean(input.apiCredential, 4096)
  }};
}
export function transitionAllowed(from, to, role, evidence = {}) {
  if (from === "PENDING" && to === "VERIFIED" && role === "technical") {
    return evidence.apiReachable === true && evidence.schemaValid === true &&
      evidence.mediaProbePassed === true && evidence.redirectsRejected === true &&
      evidence.exactHostAllowlist === true && clean(evidence.testRunId, 120).length > 0;
  }
  if (from === "VERIFIED" && to === "APPROVED" && role === "legal") {
    const references = [
      evidence.distributionPermissionReference,
      evidence.contentRightsReference,
      evidence.ageVerificationReference,
      evidence.consentRecordReference,
      evidence.complaintsProcessReference,
      evidence.takedownProcessReference,
      evidence.reviewReference
    ];
    return evidence.distributionPermissionReviewed === true &&
      evidence.contentRightsReviewed === true &&
      evidence.performerAgeVerified === true &&
      evidence.performerConsentVerified === true &&
      evidence.complaintsProcessVerified === true &&
      evidence.takedownProcessVerified === true &&
      references.every(value => clean(value, 240).length > 0);
  }
  if (from === "APPROVED" && to === "ENABLED" && role === "admin") {
    return evidence.explicitEnableConfirmation === true;
  }
  return false;
}
async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) throw new Error("Request body too large.");
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    const error = new Error("Request body too large.");
    error.status = 413;
    throw error;
  }
  try { return JSON.parse(raw || "{}"); } catch {
    const error = new Error("Invalid JSON body.");
    error.status = 400;
    throw error;
  }
}
function previewRequest(request, env) {
  const host = new URL(request.url).hostname.toLowerCase();
  return env.REGISTRY_ENV === "preview" &&
    /^clipviet-provider-registry-preview\.[a-z0-9-]+\.workers\.dev$/.test(host);
}
function providerRow(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, status: row.status, apiBaseUrl: row.api_base_url,
    apiHost: row.api_host, mediaHosts: JSON.parse(row.media_hosts_json),
    rightsHolder: row.rights_holder, licenseReference: row.license_reference,
    rightsEvidenceUrl: row.rights_evidence_url, licenseExpiresAt: row.license_expires_at,
    technicalEvidence: row.technical_evidence_json ? JSON.parse(row.technical_evidence_json) : null,
    legalEvidence: row.legal_evidence_json ? JSON.parse(row.legal_evidence_json) : null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}
async function listProviders(db) {
  const result = await db.prepare("SELECT * FROM provider_registry ORDER BY created_at DESC LIMIT 200").all();
  return (result.results || []).map(providerRow);
}
async function listAudit(db) {
  const result = await db.prepare("SELECT event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at FROM provider_audit ORDER BY created_at DESC LIMIT 300").all();
  return (result.results || []).map(row => ({
    eventId: row.event_id, providerId: row.provider_id, action: row.action,
    from: row.from_status, to: row.to_status, actorRole: row.actor_role,
    metadata: JSON.parse(row.metadata_json || "{}"), createdAt: row.created_at
  }));
}
async function createProvider(db, data, role, env) {
  const id = crypto.randomUUID();
  const encryptedCredential = await encryptCredential(data.apiCredential, env, id);
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO provider_registry
      (id,name,status,api_base_url,api_host,media_hosts_json,rights_holder,license_reference,rights_evidence_url,license_expires_at,api_credential_ciphertext,created_at,updated_at,last_event_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,data.name,"PENDING",data.apiBaseUrl,data.apiHost,JSON.stringify(data.mediaHosts),data.rightsHolder,data.licenseReference,data.rightsEvidenceUrl,data.licenseExpiresAt,encryptedCredential,now,now,eventId),
    db.prepare(`INSERT INTO provider_audit
      (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).bind(eventId,id,"PROVIDER_CREATED",null,"PENDING",role,JSON.stringify({rightsEvidenceProvided:true,credentialStored:Boolean(encryptedCredential),credentialEncryptedAtRest:Boolean(encryptedCredential)}),now)
  ]);
  return providerRow(await db.prepare("SELECT * FROM provider_registry WHERE id=?").bind(id).first());
}
async function transitionProvider(db, id, to, role, evidence) {
  if (!STATES.has(to)) return { error: "Unsupported provider state.", status: 400 };
  const current = await db.prepare("SELECT * FROM provider_registry WHERE id=?").bind(id).first();
  if (!current) return { error: "Provider not found.", status: 404 };
  if (!transitionAllowed(current.status, to, role, evidence)) return { error: "Transition denied: required reviewer role or evidence is missing.", status: 403 };
  if (to === "ENABLED") {
    const technical = current.technical_evidence_json ? JSON.parse(current.technical_evidence_json) : {};
    const legal = current.legal_evidence_json ? JSON.parse(current.legal_evidence_json) : {};
    const legalKeys = ["distributionPermissionReviewed","contentRightsReviewed","performerAgeVerified","performerConsentVerified","complaintsProcessVerified","takedownProcessVerified"];
    const legalRefs = ["distributionPermissionReference","contentRightsReference","ageVerificationReference","consentRecordReference","complaintsProcessReference","takedownProcessReference","reviewReference"];
    if (!current.rights_holder || !current.license_reference || !validEvidenceUrl(current.rights_evidence_url) ||
        !Number.isFinite(Date.parse(current.license_expires_at)) || Date.parse(current.license_expires_at) <= Date.now()) {
      return { error: "Cannot enable: written distribution license, rights holder and future expiry are required.", status: 409 };
    }
    if (!Array.isArray(JSON.parse(current.media_hosts_json || "[]")) || JSON.parse(current.media_hosts_json || "[]").length === 0) {
      return { error: "Cannot enable: exact media host allowlist is required.", status: 409 };
    }
    if (technical.apiReachable !== true || technical.schemaValid !== true || technical.mediaProbePassed !== true ||
        technical.redirectsRejected !== true || technical.exactHostAllowlist !== true || !clean(technical.testRunId, 120)) {
      return { error: "Cannot enable: technical verification evidence is incomplete.", status: 409 };
    }
    if (!legalKeys.every(key => legal[key] === true) || !legalRefs.every(key => clean(legal[key], 240))) {
      return { error: "Cannot enable: distribution, content, age, consent, complaint and takedown evidence is incomplete.", status: 409 };
    }
  }
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  const technical = to === "VERIFIED" ? JSON.stringify({
    apiReachable:true,schemaValid:true,mediaProbePassed:true,redirectsRejected:true,
    exactHostAllowlist:true,testRunId:clean(evidence.testRunId,120),checkedAt:now
  }) : current.technical_evidence_json;
  const legal = to === "APPROVED" ? JSON.stringify({
    distributionPermissionReviewed:true,
    contentRightsReviewed:true,
    performerAgeVerified:true,
    performerConsentVerified:true,
    complaintsProcessVerified:true,
    takedownProcessVerified:true,
    distributionPermissionReference:clean(evidence.distributionPermissionReference,240),
    contentRightsReference:clean(evidence.contentRightsReference,240),
    ageVerificationReference:clean(evidence.ageVerificationReference,240),
    consentRecordReference:clean(evidence.consentRecordReference,240),
    complaintsProcessReference:clean(evidence.complaintsProcessReference,240),
    takedownProcessReference:clean(evidence.takedownProcessReference,240),
    reviewReference:clean(evidence.reviewReference,240),
    reviewedAt:now
  }) : current.legal_evidence_json;
  await db.batch([
    db.prepare(`UPDATE provider_registry SET status=?,technical_evidence_json=?,legal_evidence_json=?,updated_at=?,last_event_id=?
      WHERE id=? AND status=?`).bind(to,technical,legal,now,eventId,id,current.status),
    db.prepare(`INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at)
      SELECT ?,id,?,?,?, ?,?,? FROM provider_registry WHERE id=? AND last_event_id=? AND status=?`)
      .bind(eventId,`STATUS_${to}`,current.status,to,role,JSON.stringify({evidenceRecorded:true}),now,id,eventId,to)
  ]);
  const updated = await db.prepare("SELECT * FROM provider_registry WHERE id=?").bind(id).first();
  if (!updated || updated.last_event_id !== eventId) return { error: "Provider changed concurrently; reload and retry.", status: 409 };
  const audit = await db.prepare("SELECT event_id FROM provider_audit WHERE event_id=?").bind(eventId).first();
  if (!audit) return { error: "Transition audit could not be verified.", status: 500 };
  return { provider: providerRow(updated) };
}
export default {
  async fetch(request, env) {
    if (!previewRequest(request, env)) return json({ error: "Preview-only registry is disabled." }, 404);
    const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
    const origin = request.headers.get("origin") || "";
    if (origin && !allowedOrigins.includes(origin)) return json({error:"Origin not allowed."},403);
    const headers = new Headers();
    if (origin && allowedOrigins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    const respond = (data, status = 200) => {
      const response = json(data, status);
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    };
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (!env.PROVIDER_DB) return respond({error:"Preview D1 binding is not configured."},503);
    const role = await resolveRole(request,env,equalSecret);
    if (!role) return respond({error:"Unauthorized"},401);
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/,"").split("/").filter(Boolean);
    try {
      if (request.method === "GET" && parts.length === 1 && parts[0] === "providers") {
        if (!["admin","technical","legal"].includes(role)) return respond({error:"Forbidden"},403);
        return respond({providers:await listProviders(env.PROVIDER_DB)});
      }
      if (request.method === "POST" && parts.length === 2 && parts[0] === "maintenance" && parts[1] === "rotate-credentials") {
        if (role !== "admin") return respond({error:"Admin SSO role required."},403);
        const body = await readJson(request);
        const result = await rotateCredentials(env.PROVIDER_DB,env,clean(body.afterId,80));
        return respond(result);
      }
      if (request.method === "GET" && parts.length === 1 && parts[0] === "audit") {
        if (role !== "admin") return respond({error:"Forbidden"},403);
        return respond({events:await listAudit(env.PROVIDER_DB)});
      }
      if (request.method === "POST" && parts.length === 1 && parts[0] === "providers") {
        if (role !== "admin") return respond({error:"Admin role required."},403);
        const parsed = validateProviderInput(await readJson(request));
        if (parsed.error) return respond({error:parsed.error},400);
        return respond({provider:await createProvider(env.PROVIDER_DB,parsed.data,role,env)},201);
      }
      if (request.method === "PATCH" && parts.length === 3 && parts[0] === "providers" && parts[2] === "transition") {
        const body = await readJson(request);
        const result = await transitionProvider(env.PROVIDER_DB,parts[1],clean(body.to,20),role,body.evidence || {});
        if (result.error) return respond({error:result.error},result.status);
        return respond({provider:result.provider});
      }
      return respond({error:"Not found"},404);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      const message = status < 500 && error instanceof Error ? error.message : "Internal registry error.";
      return respond({error:message},status);
    }
  }
};

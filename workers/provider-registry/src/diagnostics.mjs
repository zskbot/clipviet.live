const MAX_API_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10000;
const API_HOSTS = new Set(["api.souavzy.vip","apiyutu.com","lbapi9.com","slapibf.com","jipinvip1.com"]);
const safeHost = value => {
  if (typeof value !== "string" || value.length > 253) return "";
  const host = value.trim().toLowerCase();
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) return "";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  return host;
};
const urlHost = raw => { try { const u = new URL(raw); return u.protocol === "https:" && !u.username && !u.password && !u.port ? safeHost(u.hostname) : ""; } catch { return ""; } };
const hostAllowed = (raw, allowlist) => {
  const host = urlHost(raw);
  return Boolean(host && Array.isArray(allowlist) && allowlist.some(item => safeHost(item) === host));
};
async function readLimited(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = []; let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("response_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function sampleMediaUrls(rows) {
  const found = [];
  for (const row of rows.slice(0, 20)) {
    const raw = String(row?.vod_play_url || "");
    for (const line of raw.split("$$$")) for (const segment of line.split("#")) {
      const pos = segment.lastIndexOf("$");
      const candidate = pos >= 0 ? segment.slice(pos + 1) : segment;
      if (/^https:\/\//i.test(candidate)) found.push(candidate);
      if (found.length >= 10) return found;
    }
  }
  return found;
}
export async function runProviderDiagnostic(db, provider) {
  const checkedAt = new Date().toISOString();
  const mediaHosts = JSON.parse(provider.media_hosts_json || "[]");
  const apiHost = safeHost(provider.api_host);
  const result = {
    providerId: provider.id, checkedAt, status: "UNVERIFIED",
    checks: {
      apiHost: {status: apiHost && API_HOSTS.has(apiHost) && urlHost(provider.api_base_url) === apiHost ? "PASS" : "FAIL", expectedHost: apiHost || null},
      http: {status:"UNVERIFIED"}, json: {status:"UNVERIFIED"}, pagination: {status:"UNVERIFIED"},
      metadata: {status:"UNVERIFIED"}, mediaHosts: {status:"UNVERIFIED", allowlist:mediaHosts},
      mime: {status:"UNVERIFIED"}, range: {status:"UNVERIFIED"}
    },
    sample: {videoCount:0, fields:[], mediaHostCandidates:[]},
    note: "A diagnostic result is technical evidence only; it does not grant content rights."
  };
  if (result.checks.apiHost.status === "PASS") {
    try {
      const endpoint = new URL(provider.api_base_url);
      endpoint.searchParams.set("ac","detail"); endpoint.searchParams.set("pg","1");
      const response = await fetch(endpoint.toString(), {redirect:"error", signal:AbortSignal.timeout(TIMEOUT_MS), headers:{accept:"application/json"}});
      result.checks.http = {status:response.ok ? "PASS":"FAIL", httpStatus:response.status};
      if (response.ok) {
        const text = await readLimited(response,MAX_API_BYTES);
        let payload;
        try { payload = JSON.parse(text); result.checks.json = {status:"PASS", code:payload?.code ?? null, hasList:Array.isArray(payload?.list)}; }
        catch { result.checks.json = {status:"FAIL",reason:"invalid_json"}; }
        if (payload && result.checks.json.status === "PASS") {
          const rows = Array.isArray(payload.list) ? payload.list : [];
          const page = Number(payload.page), pageCount = Number(payload.pagecount), total = Number(payload.total), limit = Number(payload.limit);
          result.checks.json.status = Number(payload.code) === 1 && Array.isArray(payload.list) ? "PASS":"FAIL";
          let paginationStatus = Number.isFinite(page) && page === 1 && Number.isFinite(pageCount) && pageCount >= 0 && Number.isFinite(total) && total >= 0 ? "PASS":"FAIL";
          let secondPage = "NOT_REQUIRED";
          if (paginationStatus === "PASS" && pageCount > 1) {
            try {
              const pageTwoUrl = new URL(provider.api_base_url);
              pageTwoUrl.searchParams.set("ac","detail"); pageTwoUrl.searchParams.set("pg","2");
              const pageTwoResponse = await fetch(pageTwoUrl.toString(), {redirect:"error", signal:AbortSignal.timeout(TIMEOUT_MS), headers:{accept:"application/json"}});
              if (!pageTwoResponse.ok) { paginationStatus = "FAIL"; secondPage = "HTTP_" + pageTwoResponse.status; await pageTwoResponse.body?.cancel(); }
              else {
                const pageTwo = JSON.parse(await readLimited(pageTwoResponse,MAX_API_BYTES));
                secondPage = Array.isArray(pageTwo.list) && Number(pageTwo.page) === 2 && Number(pageTwo.code) === 1 ? "PASS" : "FAIL";
                if (secondPage !== "PASS") paginationStatus = "FAIL";
              }
            } catch { paginationStatus = "UNVERIFIED"; secondPage = "UNVERIFIED"; }
          }
          result.checks.pagination = {status:paginationStatus,page:Number.isFinite(page)?page:null,pageCount:Number.isFinite(pageCount)?pageCount:null,total:Number.isFinite(total)?total:null,limit:Number.isFinite(limit)?limit:null,secondPage};
          const first = rows[0] || {};
          const fields = ["vod_id","vod_name","vod_pic","vod_content","vod_year","vod_duration","vod_play_from","vod_play_url"];
          const present = fields.filter(key => first[key] !== undefined && first[key] !== null && String(first[key]) !== "");
          result.sample.videoCount = rows.length;
          result.sample.fields = present;
          const candidates = sampleMediaUrls(rows);
          result.sample.mediaHostCandidates = [...new Set(candidates.map(urlHost).filter(Boolean))];
          result.checks.metadata = {status:rows.length && ["vod_id","vod_name"].every(key => present.includes(key)) ? "PASS":"FAIL",presentFields:present};
          const candidate = candidates[0] || "";
          const mediaUrl = candidates.find(url => hostAllowed(url,mediaHosts));
          result.checks.mediaHosts = {status: candidate ? (mediaUrl ? "PASS":"FAIL") : "UNVERIFIED",allowlist:mediaHosts,candidateHost:urlHost(candidate)||null};
          if (mediaUrl) {
            try {
              const media = await fetch(mediaUrl,{method:"GET",headers:{Range:"bytes=0-0"},redirect:"error",signal:AbortSignal.timeout(TIMEOUT_MS)});
              const mime = media.headers.get("content-type") || "";
              const contentRange = media.headers.get("content-range") || "";
              result.checks.mime = {status:/^(video\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|octet-stream))/i.test(mime) ? "PASS":"FAIL",contentType:mime};
              result.checks.range = {status:media.status === 206 && /^bytes 0-0\//i.test(contentRange) ? "PASS":"FAIL",httpStatus:media.status,contentRange};
              await media.body?.cancel();
            } catch {
              result.checks.mime = {status:"UNVERIFIED",reason:"media_probe_failed"};
              result.checks.range = {status:"UNVERIFIED",reason:"media_probe_failed"};
            }
          }
        }
      } else {
        await response.body?.cancel();
      }
    } catch (error) {
      result.checks.http = {status:"UNVERIFIED",reason:error?.name === "TimeoutError" ? "timeout" : "network_or_redirect_error"};
    }
  }
  const statuses = Object.values(result.checks).map(item=>item.status);
  result.status = statuses.includes("FAIL") ? "FAIL" : statuses.every(item=>item==="PASS") ? "PASS" : "UNVERIFIED";
  const runId = crypto.randomUUID();
  await db.prepare("INSERT INTO provider_diagnostic_runs (id,provider_id,status,result_json,checked_at) VALUES (?,?,?,?,?)")
    .bind(runId,provider.id,result.status,JSON.stringify(result),checkedAt).run();
  return {runId,...result};
}
export async function listProviderDiagnostics(db,providerId) {
  const rows = await db.prepare("SELECT id,status,result_json,checked_at FROM provider_diagnostic_runs WHERE provider_id=? ORDER BY checked_at DESC LIMIT 20").bind(providerId).all();
  return (rows.results || []).map(row=>({runId:row.id,status:row.status,checkedAt:row.checked_at,result:JSON.parse(row.result_json)}));
}

const PAGE = String.raw`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#050505"><title>ClipViet · Provider Preview</title>
<style>
:root{color-scheme:dark;--bg:#050505;--panel:#0b0b0b;--line:#292929;--fg:#f5f5f5;--muted:#929292;--red:#f05252;--amber:#f4c66a;--green:#67d69a}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:14px ui-monospace,SFMono-Regular,Menlo,monospace}button{border:1px solid #555;background:#111;color:#fff;padding:12px 14px;font:700 12px inherit;min-height:44px;border-radius:0}button:disabled{opacity:.45}button.primary{border-color:var(--red);color:#ffaaaa}main{max-width:1100px;margin:auto;padding:calc(22px + env(safe-area-inset-top)) 16px calc(36px + env(safe-area-inset-bottom))}.eyebrow{color:var(--red);font-size:11px;letter-spacing:.2em;font-weight:bold}h1{font-size:clamp(22px,5vw,34px);margin:10px 0}p{line-height:1.6}.muted{color:var(--muted)}.top{display:flex;justify-content:space-between;gap:14px;align-items:end;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.tile,.provider,.notice{border:1px solid var(--line);background:var(--panel);padding:14px}.tile small{display:block;color:var(--muted);font-size:10px}.tile strong{display:block;font-size:22px;margin-top:8px}.notice{border-color:#66502a;color:#f3d79a;margin:16px 0}.provider{margin:12px 0}.provider-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.provider h2{font-size:16px;margin:0 0 6px}.status{border:1px solid #66502a;color:var(--amber);padding:5px 8px;font-size:11px;height:max-content}.status.PASS{border-color:#245a3d;color:var(--green)}.status.FAIL{border-color:#702d2d;color:#ff8b8b}.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.fact{border:1px solid var(--line);padding:10px}.fact small{color:var(--muted);font-size:10px}.fact strong{display:block;margin-top:7px;overflow-wrap:anywhere}.actions{display:flex;gap:8px;flex-wrap:wrap}.run{border-color:#8b3434;color:#ffaaaa}.result{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}.checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.check{border:1px solid var(--line);padding:9px}.check small{display:block;color:var(--muted);overflow-wrap:anywhere}.check b{display:block;margin-top:5px}.error{border:1px solid #853838;color:#ffaaaa;padding:12px;margin:14px 0;white-space:pre-wrap}.hidden{display:none}.footer{border-top:1px solid var(--line);padding-top:14px;margin-top:26px;color:var(--muted);font-size:11px}@media(max-width:620px){.grid{grid-template-columns:1fr}.facts{grid-template-columns:1fr 1fr}.checks{grid-template-columns:1fr}.top button{width:100%}}
</style></head>
<body><main>
<div class="eyebrow">CLIPVIET / PREVIEW ONLY / ACCESS PROTECTED</div>
<div class="top"><div><h1>Provider Diagnostics</h1><p class="muted">Health, API checks and diagnostic history · Preview D1 only</p></div><button id="refresh">REFRESH ALL</button></div>
<div id="error" class="error hidden" role="alert"></div>
<div class="grid" id="health"><div class="tile"><small>SERVICE</small><strong>CHECKING</strong></div><div class="tile"><small>DATABASE</small><strong>CHECKING</strong></div><div class="tile"><small>PROVIDERS</small><strong>—</strong></div></div>
<div class="notice">All seeded providers remain PENDING. Diagnostic PASS is technical evidence only; it does not authorize playback, embedding or redistribution. CDN allowlists remain empty until exact hosts and rights evidence are independently reviewed.</div>
<section><div class="top"><h2>Provider registry</h2><span class="muted" id="updated">Not checked yet</span></div><div id="providers"><p class="muted">Loading provider records…</p></div></section>
<section><div class="top"><h2>Metadata intake review queue</h2><span class="muted" id="intake-count">Loading submissions…</span></div><p class="muted">Read-only evidence queue. Submissions remain PENDING_REVIEW; this screen cannot approve providers, connectors, content rights or playback.</p><div id="intakes"><p class="muted">Loading metadata submissions…</p></div></section>
<section><div class="top"><h2>Connector review queue</h2><span class="muted" id="connector-count">Loading connectors…</span></div><p class="muted">Connector contracts remain inactive until technical verification and legal approval. Read-only view.</p><div id="connectors"><p class="muted">Loading connector records…</p></div></section>
<section><div class="top"><h2>Per-video content rights</h2><span class="muted" id="rights-count">Loading rights…</span></div><p class="muted">Each source item requires its own provenance, distribution license, adult-age and consent evidence. No approval action is available here.</p><div id="content-rights"><p class="muted">Loading content-rights records…</p></div></section>
<div class="footer">No Production routing · No DNS changes · No provider status mutation · Diagnostic runs may contact the configured API endpoint and are recorded in Preview D1.</div>
</main>
<script>
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,options={}){const response=await fetch(path,{...options,credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));return data}
function showError(message){$("error").textContent=message;$("error").classList.remove("hidden")}
function clearError(){$("error").textContent="";$("error").classList.add("hidden")}
function status(value){return '<span class="status '+esc(value||"UNVERIFIED")+'">'+esc(value||"UNVERIFIED")+'</span>'}
function renderHealth(data){$("health").innerHTML='<div class="tile"><small>SERVICE</small><strong>'+esc(data.status)+'</strong></div><div class="tile"><small>PREVIEW D1</small><strong>'+esc(data.database.status)+'</strong></div><div class="tile"><small>PROVIDERS</small><strong>'+esc(data.database.providerCount)+'</strong></div>'}
function renderProviders(rows){if(!rows.length){$("providers").innerHTML='<p class="muted">No provider records found.</p>';return}
$("providers").innerHTML=rows.map(p=>{const runs=p.diagnostics||[],latest=runs[0],checks=latest?.result?.checks||{};const checksHtml=Object.entries(checks).map(([k,v])=>'<div class="check"><small>'+esc(k)+'</small><b>'+status(v.status)+'</b></div>').join("");const history=runs.length?'<p class="muted">History: '+runs.map(r=>esc(r.checkedAt)+' · '+esc(r.runId)+' · '+esc(r.status)).join('<br>')+'</p>':'<p class="muted">No diagnostic runs yet.</p>';const candidate=latest?.result?.sample?.mediaHostCandidates||[];return '<article class="provider"><div class="provider-head"><div><h2>'+esc(p.name)+'</h2><div class="muted">'+esc(p.apiHost)+'<br>'+esc(p.apiBaseUrl)+'</div></div>'+status(p.status)+'</div><div class="facts"><div class="fact"><small>MEDIA HOST ALLOWLIST</small><strong>'+esc((p.mediaHosts||[]).length)+'</strong></div><div class="fact"><small>LATEST DIAGNOSTIC</small><strong>'+esc(latest?.status||"NOT RUN")+'</strong></div><div class="fact"><small>DIAGNOSTIC HISTORY</small><strong>'+esc(runs.length)+'</strong></div></div><div class="actions"><button class="primary run" data-run="'+esc(p.id)+'">RUN DIAGNOSTIC</button><button data-history="'+esc(p.id)+'">REFRESH HISTORY</button></div>'+(latest?'<div class="result"><div class="muted">Latest: '+esc(latest.checkedAt)+' · '+status(latest.status)+'</div><div class="checks">'+checksHtml+'</div>'+(candidate.length?'<p class="muted">CDN candidates (not approved): '+esc(candidate.join(", "))+'</p>':'')+history+'</div>':history)+'</article>'}).join("");
document.querySelectorAll("[data-run]").forEach(b=>b.addEventListener("click",()=>runDiagnostic(b.dataset.run,b)));
document.querySelectorAll("[data-history]").forEach(b=>b.addEventListener("click",()=>refreshAll()));
}
function renderIntakes(payload){
  const rows=Array.isArray(payload.intakes)?payload.intakes:[];
  $("intake-count").textContent=String(payload.pendingReview||0)+" PENDING_REVIEW · "+rows.length+" RECORDS";
  if(!rows.length){$("intakes").innerHTML='<p class="muted">No metadata submissions received yet.</p>';return}
  $("intakes").innerHTML=rows.map(item=>{
    const expiry=item.licenseExpiresAt?new Date(item.licenseExpiresAt).toLocaleDateString():"—";
    const regions=Array.isArray(item.regions)?item.regions.join(", "):"—";
    return '<article class="provider"><div class="provider-head"><div><h2>'+esc(item.providerName||item.providerId)+'</h2><div class="muted">'+esc(item.apiHost)+' · '+esc(item.status)+'</div></div><span class="status">'+esc(item.status)+'</span></div><div class="facts"><div class="fact"><small>RIGHTS HOLDER</small><strong>'+esc(item.rightsHolder)+'</strong></div><div class="fact"><small>LICENSE REFERENCE</small><strong>'+esc(item.licenseReference)+'</strong></div><div class="fact"><small>EXPIRY / REGIONS</small><strong>'+esc(expiry)+' · '+esc(regions)+'</strong></div></div><p class="muted">Evidence: '+esc(item.evidenceUrl)+'<br>API docs: '+esc(item.documentationUrl)+'<br>Contact: '+esc(item.contactEmail||"Not supplied")+'<br>Submitted: '+esc(item.createdAt)+'<br>Note: '+esc(item.note||"—")+'</p></article>';
  }).join("");
}
function renderConnectors(payload){
  const rows=Array.isArray(payload.connectors)?payload.connectors:[];
  $("connector-count").textContent=String(payload.pendingReview||0)+" PENDING · "+String(payload.approved||0)+" APPROVED · "+rows.length+" TOTAL";
  $("connectors").innerHTML=rows.length?rows.map(item=>'<article class="provider"><div class="provider-head"><div><h2>'+esc(item.providerName||item.providerId)+'</h2><div class="muted">'+esc(item.connectorId)+' · '+esc(item.authMode)+'</div></div><span class="status">'+esc(item.status)+'</span></div><p class="muted">Scopes: '+esc((item.scopes||[]).join(", "))+'<br>Regions: '+esc((item.regions||[]).join(", "))+'<br>Playback mode: '+esc(item.playbackMode)+'<br>API docs: '+esc(item.documentationUrl||"—")+'<br>Evidence: '+esc(item.evidenceReference||"—")+'</p></article>').join(""):'<p class="muted">No connector contracts registered. This is expected while all providers remain PENDING.</p>';
}
function renderRights(payload){
  const rows=Array.isArray(payload.records)?payload.records:[];
  $("rights-count").textContent=String(payload.pendingReview||0)+" PENDING · "+String(payload.approved||0)+" APPROVED · "+rows.length+" TOTAL";
  $("content-rights").innerHTML=rows.length?rows.map(item=>'<article class="provider"><div class="provider-head"><div><h2>'+esc(item.providerName||item.providerId)+'</h2><div class="muted">'+esc(item.sourcePlatform)+' · '+esc(item.sourceContentId)+'</div></div><span class="status">'+esc(item.status)+'</span></div><p class="muted">Creator: '+esc(item.creator||"—")+'<br>Rights holder: '+esc(item.rightsHolder)+'<br>License: '+esc(item.licenseReference)+' · Expiry: '+esc(item.licenseExpiresAt)+'<br>Source: '+esc(item.sourceUrl)+'<br>Evidence: '+esc(item.evidenceUrl)+'<br>Permitted uses: '+esc((item.permittedUses||[]).join(", "))+'<br>Regions: '+esc((item.regions||[]).join(", "))+'<br>Source / ownership / age / consent checks: '+[item.sourceVerified,item.ownershipVerified,item.performerAgeVerified,item.performerConsentVerified].map(v=>v?"YES":"NO").join(" / ")+'</p></article>').join(""):'<p class="muted">No per-video rights records. No content is eligible for publication or playback.</p>';
}
async function refreshAll(){clearError();$("updated").textContent="Refreshing…";try{const [health,registry,intakes,connectors,rights]=await Promise.all([api("/health"),api("/providers"),api("/metadata-intakes"),api("/connectors"),api("/content-rights")]);renderHealth(health);renderIntakes(intakes);renderConnectors(connectors);renderRights(rights);const rows=await Promise.all((registry.providers||[]).map(async p=>{try{const d=await api("/providers/"+encodeURIComponent(p.id)+"/diagnostics");return {...p,diagnostics:d.runs||[]}}catch(e){return {...p,diagnostics:[],diagnosticError:e.message}}}));renderProviders(rows);$("updated").textContent="Updated "+new Date().toLocaleString()}catch(e){showError(e.message);$("updated").textContent="Refresh failed"}}
async function runDiagnostic(id,button){clearError();button.disabled=true;button.textContent="RUNNING…";try{const result=await api("/providers/"+encodeURIComponent(id)+"/diagnostics/run",{method:"POST",body:"{}"});if(result.run?.status==="PASS"){}await refreshAll()}catch(e){showError(e.message)}finally{button.disabled=false;button.textContent="RUN DIAGNOSTIC"}}
$("refresh").addEventListener("click",refreshAll);refreshAll();
</script></body></html>`;
export function adminPage() {
  return new Response(PAGE, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  }});
}

const $ = id => document.getElementById(id);
let settings = { binaryPath: "", apiBase: "", allowedHosts: [] };
function message(el, text, bad=false) { el.textContent = text; el.style.color = bad ? "#ff8b8b" : "#9ba8c2"; }
function renderHosts() {
  $("hosts").replaceChildren(...settings.allowedHosts.map(host => { const span=document.createElement("span"); span.className="chip"; span.textContent=host; return span; }));
}
function renderJobs(jobs) {
  const root=$("jobs"); root.replaceChildren();
  if (!jobs.length) { const p=document.createElement("p"); p.className="muted"; p.textContent="Chưa có tác vụ."; root.append(p); return; }
  jobs.slice().reverse().forEach(job => {
    const card=document.createElement("article"); card.className="job";
    const title=document.createElement("strong"); title.textContent=job.name+" · "+job.status;
    const meta=document.createElement("div"); meta.className="small"; meta.textContent=job.host+" · "+job.folder;
    const log=document.createElement("pre"); log.textContent=job.output || "Đang khởi chạy…";
    card.append(title,meta,log); root.append(card);
  });
}
async function init() {
  settings=await window.clipviet.getSettings();
  $("binary").value=settings.binaryPath; $("apiBase").value=settings.apiBase;
  renderHosts();
}
$("pickBinary").onclick=async()=>{const p=await window.clipviet.chooseBinary();if(p)$("binary").value=p;};
$("pickFolder").onclick=async()=>{const p=await window.clipviet.chooseFolder();if(p)$("outputDir").value=p;};
$("saveSettings").onclick=async()=>{
  try {
    settings=await window.clipviet.saveSettings({...settings,binaryPath:$("binary").value,apiBase:$("apiBase").value});
    const token=$("token").value;if(token){await window.clipviet.saveToken(token);$("token").value="";}
    message($("catalog"),"Đã lưu cấu hình cục bộ.");
  } catch(e){message($("catalog"),e.message,true);}
};
$("addHost").onclick=()=>{
  const host=$("host").value.trim().toLowerCase();
  if(!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)){message($("catalog"),"Hostname không hợp lệ.",true);return;}
  settings.allowedHosts=[...new Set([...settings.allowedHosts,host])];renderHosts();$("host").value="";
  window.clipviet.saveSettings({...settings,binaryPath:$("binary").value,apiBase:$("apiBase").value}).then(x=>settings=x).catch(e=>message($("catalog"),e.message,true));
};
$("loadCatalog").onclick=async()=>{
  try { const items=await window.clipviet.loadCatalog(); message($("catalog"),`Đã đọc ${items.length} mục từ ClipViet Admin API (read-only).`); }
  catch(e){message($("catalog"),e.message,true);}
};
$("start").onclick=async()=>{
  try {
    const result=await window.clipviet.startDownload({url:$("mediaUrl").value,name:$("mediaName").value,outputDir:$("outputDir").value,rightsConfirmed:$("rights").checked});
    message($("catalog"),"Đã tạo tác vụ "+result.id);
  } catch(e){message($("catalog"),e.message,true);}
};
window.clipviet.onJobsUpdate(renderJobs);
init().catch(e=>message($("catalog"),e.message,true));

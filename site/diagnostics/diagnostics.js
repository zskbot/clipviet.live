const API = window.CLIPVIET_API_BASE || location.origin;
const ADMIN_API = window.CLIPVIET_ADMIN_API_BASE || "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const $ = (id) => document.getElementById(id);
const results = $("results");
const video = $("test-video");
const summary = $("summary");
const run = $("run");
const checks = [];
$("age-confirm").addEventListener("change", updateGate);
$("rights-confirm").addEventListener("change", updateGate);
function updateGate(){run.disabled=!$("age-confirm").checked||!$("rights-confirm").checked;}
function add(label,state,detail){
 checks.push({label,state,detail});
 const li=document.createElement("li"),tag=document.createElement("span"),text=document.createElement("span");
 tag.className="state "+state;tag.textContent=state.toUpperCase();
 text.textContent=label+" — "+detail;li.append(tag,text);results.append(li);
}
function corsState(response){
  // A successful mode:cors fetch is itself proof that the browser accepted CORS.
  // Access-Control-Allow-Origin is not necessarily exposed to page JavaScript.
  return response.type==="cors"||response.type==="basic";
}
async function requestJson(path,label){
 const response=await fetch(API+path,{headers:{Accept:"application/json"},cache:"no-store",credentials:"omit",redirect:"error"});
 if(!response.ok)throw new Error(label+" HTTP "+response.status);
 const type=(response.headers.get("content-type")||"").toLowerCase();
 if(!type.includes("application/json"))throw new Error(label+" MIME "+(type||"missing"));
 if(!corsState(response))throw new Error(label+" CORS allow-origin không khớp");
 return response.json();
}
async function rangeProbe(url,label){
 const response=await fetch(url,{method:"GET",headers:{Range:"bytes=0-0",Accept:"*/*"},mode:"cors",credentials:"omit",redirect:"error",cache:"no-store"});
 const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 const cors=corsState(response);
 const status=response.status;
 const contentRange=response.headers.get("content-range")||"";
 const contentLength=response.headers.get("content-length")||"";
 const acceptRanges=response.headers.get("accept-ranges")||"not exposed";
 const rangeValid=/^bytes\s+0-0\/(?:[1-9]\d*|\*)$/i.test(contentRange);
 const lengthValid=!contentLength||contentLength==="1";
 if(response.body)await response.body.cancel().catch(()=>{});
 const pass=status===206&&cors&&rangeValid&&lengthValid;
 return {pass,status,type,cors,contentRange,contentLength,rangeValid,acceptRanges};
}
async function resourceProbe(url){
 const response=await fetch(url,{headers:{Accept:"*/*"},mode:"cors",credentials:"omit",redirect:"error",cache:"no-store"});
 const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 const cors=corsState(response);
 const status=response.status;
 if(response.body)await response.body.cancel().catch(()=>{});
 return {pass:(status===200||status===206)&&cors,type,status,cors};
}
async function firstHlsSegment(manifestUrl){
 let url=manifestUrl;
 for(let depth=0;depth<2;depth++){
  const response=await fetch(url,{headers:{Accept:"application/vnd.apple.mpegurl,application/x-mpegURL,*/*"},mode:"cors",credentials:"omit",redirect:"error",cache:"no-store"});
  if(!response.ok)throw new Error("HLS manifest HTTP "+response.status);
  const type=(response.headers.get("content-type")||"").toLowerCase();
  const cors=corsState(response);
  if(!type.includes("mpegurl")&&!type.includes("vnd.apple"))throw new Error("HLS manifest MIME "+(type||"missing"));
  if(!cors)throw new Error("HLS manifest CORS không cho phép origin này");
  const text=await response.text();
  if(text.length>512000)throw new Error("HLS manifest vượt 512 KB");
  const uri=text.split(/\r?\n/).map(x=>x.trim()).find(x=>x&&!x.startsWith("#"));
  if(!uri)throw new Error("HLS playlist không có URI media");
  url=new URL(uri,url).href;
  if(/\.m3u8(?:$|[?#])/i.test(url))continue;
  return {url,manifestType:type};
 }
 throw new Error("Không tìm thấy segment trong HLS playlist");
}
async function inspectMedia(url,label){
 const isHls=/\.m3u8(?:$|[?#])/i.test(url);
 if(isHls){
  try{
   const segment=await firstHlsSegment(url);
   const probe=await resourceProbe(segment.url);
   add(label+" HLS manifest","pass",segment.manifestType);
   const segmentMimeOk=probe.type==="video/mp2t"||probe.type==="video/mp4"||probe.type==="application/mp4"||probe.type==="application/octet-stream";
   add(label+" HLS segment MIME",segmentMimeOk?"pass":"fail",probe.type||"missing");
   add(label+" HLS segment HTTP/CORS",probe.pass?"pass":"fail","HTTP "+probe.status+" · "+probe.type+" · CORS "+(probe.cors?"OK":"FAIL"));
  }catch(error){add(label+" HLS manifest/segment","fail",error.message||String(error));}
 }else{
  try{
   const probe=await rangeProbe(url,label+" MP4");
   const mimeOk=probe.type==="video/mp4"||probe.type==="application/mp4";
   add(label+" MP4 MIME",mimeOk?"pass":"fail",probe.type||"missing");
   add(label+" MP4 byte-range + CORS",probe.pass?"pass":"fail","HTTP "+probe.status+" · CORS "+(probe.cors?"OK":"FAIL")+" · Content-Range "+(probe.contentRange||"missing")+" · Content-Length "+(probe.contentLength||"not exposed")+" · Accept-Ranges "+probe.acceptRanges);
  }catch(error){add(label+" MP4 range/CORS","fail",error.message||String(error));}
 }
}
async function testPlayer(url,isHls,label){
 video.src=url;video.preload="auto";video.load();
 if(isHls)add(label+" native HLS",video.canPlayType("application/vnd.apple.mpegurl")?"pass":"warn",video.canPlayType("application/vnd.apple.mpegurl")||"Không báo hỗ trợ HLS native");
 try{
  await new Promise((resolve,reject)=>{
   let done=false;const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener("loadeddata",ok);video.removeEventListener("error",bad);fn(value);};
   const ok=()=>finish(resolve,true),bad=()=>finish(reject,new Error("HTMLVideoElement media error "+(video.error?.code||"unknown")));
   const timer=setTimeout(()=>finish(reject,new Error("Không nhận được loadeddata trong 20 giây")),20000);
   video.addEventListener("loadeddata",ok,{once:true});video.addEventListener("error",bad,{once:true});
   if(video.readyState>=2)finish(resolve,true);
  });
  add(label+" player frame",video.readyState>=2&&video.videoWidth>0?"pass":"fail","readyState="+video.readyState+" · "+video.videoWidth+"×"+video.videoHeight);
 }catch(error){add(label+" player frame","fail",error.message||String(error));}
}
async function checkAdminAccess(){
 try{
  const response=await fetch(new URL("../admin/",location.href),{method:"GET",credentials:"omit",redirect:"manual",cache:"no-store"});
  const locationHeader=response.headers.get("location")||"";
  const redirected=response.status>=300&&response.status<400;
  const looksLikeAccess=/cloudflareaccess|access\.cloudflare|cdn-cgi\/access/i.test(locationHeader);
  if(looksLikeAccess)add("Admin Access gate","pass","HTTP "+response.status+" · chuyển hướng Cloudflare Access");
  else if(redirected)add("Admin Access gate","warn","Admin chuyển hướng HTTP "+response.status+" nhưng chưa xác định được Cloudflare Access");
  else if(response.ok)add("Admin Access gate","warn","/admin/ trả HTTP "+response.status+"; cần kiểm tra đăng nhập Admin phía API");
  else add("Admin Access gate","warn","/admin/ trả HTTP "+response.status+"; kiểm tra policy và API đăng nhập");
 }catch(error){add("Admin Access gate","warn","Không thể xác minh bằng fetch: "+(error.message||String(error))+" · mở /admin/ trong tab mới để xác nhận");}
}

async function checkAdminApi(){
 try{
  const session=await fetch(ADMIN_API+"/api/admin/session",{headers:{Accept:"application/json"},credentials:"omit",redirect:"error",cache:"no-store"});
  if(session.status===401||session.status===403)add("Admin session API","pass","Không có token hợp lệ · HTTP "+session.status);
  else if(session.status===404)add("Admin session API","fail","Endpoint /api/admin/session chưa được triển khai (404)");
  else if(session.ok)add("Admin session API","fail","API chấp nhận phiên không có token (HTTP "+session.status+")");
  else add("Admin session API","warn","HTTP "+session.status+" · cần kiểm tra phản hồi");
  const login=await fetch(ADMIN_API+"/api/admin/login",{method:"POST",headers:{Accept:"application/json","Content-Type":"text/plain"},body:"{}",credentials:"omit",redirect:"error",cache:"no-store"});
  if(login.status===400||login.status===422)add("Admin login API","pass","Endpoint tồn tại và kiểm tra payload · HTTP "+login.status);
  else if(login.status===404||login.status===405)add("Admin login API","fail","Endpoint đăng nhập chưa được triển khai hoặc POST bị từ chối · HTTP "+login.status);
  else if(login.status===401)add("Admin login API","pass","Endpoint từ chối payload không hợp lệ · HTTP 401");
  else add("Admin login API","warn","HTTP "+login.status+" · cần kiểm tra phản hồi");
 }catch(error){add("Admin auth API","fail","Không thể gọi API đăng nhập/phiên: "+(error.message||String(error)));}
}
async function runChecks(){
 run.disabled=true;run.textContent="ĐANG KIỂM TRA…";results.replaceChildren();checks.length=0;video.pause();video.removeAttribute("src");video.load();
 await checkAdminAccess();await checkAdminApi();
 try{
  const registry=await requestJson("/api/providers/applecms/status","Provider status");
  const providers=Array.isArray(registry.providers)?registry.providers:[];
  add("Provider registry",providers.length===5?"pass":"fail",providers.length+"/5 AppleCMS providers · "+providers.map(item=>item.id+":"+item.status).join(" · "));
  const playbackProviders=providers.filter(item=>item.status==="PLAYBACK_APPROVED");
  const metadataProviders=providers.filter(item=>item.status==="METADATA_ONLY");
  const pendingProviders=providers.filter(item=>item.status==="PENDING_RIGHTS"||item.status==="NOT_CONFIGURED");
  add("Rights state",pendingProviders.length?"warn":"pass",pendingProviders.length+" provider đang chờ cấu hình/quyền · "+metadataProviders.length+" chỉ metadata · "+playbackProviders.length+" được phép phát cấp provider");
  if(!playbackProviders.length){
   add("Media diagnostics","pending","Không có provider được duyệt phát. Đã bỏ qua kiểm tra URL media; không tự lấy hoặc phát stream chưa được cấp quyền.");
   summary.textContent="API trạng thái đã kiểm tra. HLS/MP4, MIME, CORS, byte-range và khung hình chỉ chạy khi có video được cấp quyền phát cụ thể.";
   return;
  }
  const samples={hls:null,mp4:null,embed:null};
  for(const provider of playbackProviders){
   const query="?sourceId="+encodeURIComponent(provider.id);
   const list=await requestJson("/api/providers/applecms/videos"+query+"&page=1&limit=20","Videos "+provider.id);
   add("Video list · "+provider.id,"pass",(list.items||[]).length+" metadata đã qua rights gate");
   for(const item of (list.items||[]).slice(0,10)){
    const detail=await requestJson("/api/providers/applecms/videos/"+encodeURIComponent(item.sourceContentId)+query,"Video detail");
    if(JSON.stringify(detail).match(/https?:[^" ]+\\.(?:m3u8|mp4)/i)) throw new Error("Video detail đang để lộ media URL ngoài playback endpoint");
    const playPath="/api/providers/applecms/videos/"+encodeURIComponent(item.sourceContentId)+"/playback"+query;
    const response=await fetch(API+playPath,{headers:{Accept:"application/json"},cache:"no-store",credentials:"omit",redirect:"error"});
    if(response.status===403) continue;
    if(!response.ok) throw new Error("Playback info "+provider.id+" HTTP "+response.status);
    const info=await response.json();
    const sources=info.data?.sources||[];
    for(const source of sources){
     if(source.episodes){
      for(const episode of source.episodes){
       const url=episode.url||"";
       if(!samples.hls&&/\\.m3u8(?:$|[?#])/i.test(url)) samples.hls={url,provider:provider.id};
       if(!samples.mp4&&/\\.mp4(?:$|[?#])/i.test(url)) samples.mp4={url,provider:provider.id};
      }
     }else if(source.url&&/\\/embed\\//i.test(source.url)){
      samples.embed=samples.embed||{url:source.url,provider:provider.id};
     }
    }
    if(samples.hls&&samples.mp4)break;
   }
   if(samples.hls&&samples.mp4)break;
  }
  add("Playback endpoint","pass","Thông tin phát được truy xuất riêng; metadata API không phát tán URL media.");
  if(samples.embed) add("Official embed","pass","Embed được cấp phép bởi "+samples.embed.provider+"; không thử tải trực tiếp nội dung iframe.");
  if(samples.hls){await inspectMedia(samples.hls.url,"HLS · "+samples.hls.provider);await testPlayer(samples.hls.url,true,"HLS");}
  else add("HLS .m3u8","pending","Không có manifest HLS trong các video đã duyệt phát.");
  if(samples.mp4){await inspectMedia(samples.mp4.url,"MP4 · "+samples.mp4.provider);await testPlayer(samples.mp4.url,false,"MP4");}
  else add("MP4","pending","Không có MP4 trong các video đã duyệt phát.");
  if(!samples.hls&&!samples.mp4&&!samples.embed) add("Playback samples","pending","Provider đã duyệt nhưng chưa có URL phát/official embed phù hợp để chạy probe.");
  summary.textContent="Hoàn tất kiểm tra trên "+navigator.userAgent+" · Origin "+location.origin;
 }catch(error){
  add("Luồng kiểm tra","fail",error.message||String(error));
  summary.textContent="Có bước chưa đạt. Kết quả chi tiết được liệt kê ngay trên trang này.";
 }finally{
  run.disabled=false;run.textContent="CHẠY LẠI KIỂM TRA";
 }
}
run.addEventListener("click",runChecks);
$("clipform").addEventListener("load",()=>{$("form-status").textContent="Iframe phát sinh sự kiện load. Hãy kiểm tra form có hiển thị đầy đủ và thử gửi một đề xuất thử nghiệm."});

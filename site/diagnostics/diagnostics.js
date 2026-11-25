const API = window.CLIPVIET_API_BASE || "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
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
 const lengthValid=contentLength==="1"||rangeValid;
 if(response.body)await response.body.cancel().catch(()=>{});
 const pass=status===206&&cors&&rangeValid&&lengthValid;
 return {pass,status,type,cors,contentRange,contentLength,rangeValid,acceptRanges};
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
   const probe=await rangeProbe(segment.url,label+" HLS segment");
   add(label+" HLS manifest","pass",segment.manifestType);
   const segmentMimeOk=probe.type==="video/mp2t"||probe.type==="video/mp4"||probe.type==="application/mp4"||probe.type==="application/octet-stream";
   add(label+" HLS segment MIME",segmentMimeOk?"pass":"fail",probe.type||"missing");
   add(label+" HLS segment Range",probe.pass?"pass":"fail","HTTP "+probe.status+" · "+probe.type+" · CORS "+(probe.cors?"OK":"FAIL")+" · Accept-Ranges "+probe.acceptRanges);
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
async function runChecks(){
 run.disabled=true;run.textContent="ĐANG KIỂM TRA…";results.replaceChildren();checks.length=0;video.removeAttribute("src");video.load();await checkAdminAccess();
 try{
  const health=await requestJson("/health","Health");
  add("Worker health",health.ok?"pass":"fail",health.service+" · "+health.environment);
  const providers=await requestJson("/api/providers","Providers");
  const configured=(providers.data||[]).filter(x=>x.configured);
  add("Provider registry",configured.length?"pass":"fail",configured.length+"/"+(providers.data||[]).length+" provider đã cấu hình");
  const categories=await requestJson("/api/catalog/categories","Categories");
  add("Categories API",Array.isArray(categories.data)?"pass":"fail",(categories.data||[]).length+" danh mục · "+categories.sourceId);
  const list=await requestJson("/api/catalog/videos?page=1","Videos");
  if(!Array.isArray(list.items)||!list.items.length)throw new Error("Catalog API không trả video");
  add("Videos API","pass",list.items.length+" video · "+list.provider?.name);
  const samples={hls:null,mp4:null};
  for(const item of list.items.slice(0,10)){
   const response=await requestJson("/api/providers/"+encodeURIComponent(item.sourceId)+"/videos/"+encodeURIComponent(item.id),"Video detail");
   const episodes=(response.data?.lines||[]).flatMap(line=>line.episodes||[]);
   if(!samples.hls)samples.hls=episodes.find(ep=>/\.m3u8(?:$|[?#])/i.test(ep.url||""))||null;
   if(!samples.mp4)samples.mp4=episodes.find(ep=>{try{return /\.mp4$/i.test(new URL(ep.url,location.href).pathname);}catch{return false;}})||null;
   if(samples.hls&&samples.mp4)break;
  }
  if(!samples.hls&&!samples.mp4)throw new Error("10 video đầu không có MP4/HLS URL hợp lệ");
  add("Video detail","pass","Đã tìm URL media trong 10 video đầu");
  if(samples.hls)await inspectMedia(samples.hls.url,"HLS");
  else add("HLS sample","warn","10 video đầu không trả HLS .m3u8 URL");
  if(samples.mp4)await inspectMedia(samples.mp4.url,"MP4");
  else add("MP4 sample","warn","10 video đầu không trả MP4 URL");
  if(samples.hls)await testPlayer(samples.hls.url,true,"HLS");
  if(samples.mp4)await testPlayer(samples.mp4.url,false,"MP4");
  summary.textContent="Hoàn tất. Kiểm tra này chạy trên "+navigator.userAgent+" · Origin "+location.origin;
 }catch(error){
  add("Luồng kiểm tra","fail",error.message||String(error));
  summary.textContent="Có bước chưa đạt. Gửi ảnh chụp kết quả này để tiếp tục xử lý.";
 }finally{
  run.disabled=false;run.textContent="CHẠY LẠI KIỂM TRA";
 }
}
run.addEventListener("click",runChecks);
$("clipform").addEventListener("load",()=>{$("form-status").textContent="Iframe phát sinh sự kiện load. Hãy kiểm tra form có hiển thị đầy đủ và thử gửi một đề xuất thử nghiệm."});

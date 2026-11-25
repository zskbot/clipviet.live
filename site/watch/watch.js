const API = window.CLIPVIET_API_BASE || "https://api.clipviet.live/api/v1";
const id = new URLSearchParams(location.search).get("id");
const player = document.querySelector("#player");
const status = document.querySelector("#status");
const title = document.querySelector("#title");
function fail(message){status.textContent=message;title.textContent="Không thể tải video";}
if(!id){fail("Thiếu video ID.");}
else{
 fetch(API+"/videos/"+encodeURIComponent(id),{headers:{Accept:"application/json"},credentials:"include",redirect:"error"})
 .then(async r=>{if(!r.ok)throw new Error("API HTTP "+r.status);return r.json();})
 .then(({data})=>{
  if(!data||!data.media_url)throw new Error("Video không có media URL.");
  const url=new URL(data.media_url);
  if(url.protocol!=="https:")throw new Error("Media URL không an toàn.");
  title.textContent=data.title||"Video";
  document.querySelector("#description").textContent=data.description||"";
  document.querySelector("#details").textContent=[data.country,data.genre,data.duration].filter(Boolean).join(" · ");
  player.src=url.href;
  player.load();
  status.textContent="Đã nạp media URL. Nhấn Play để phát.";
  player.addEventListener("error",()=>status.textContent="Không phát được media. Kiểm tra MIME type, byte-range, CORS và quyền truy cập.",{once:true});
 })
 .catch(error=>fail("Không tải được video: "+error.message+" — API chưa triển khai hoặc video chưa xuất bản."));
}
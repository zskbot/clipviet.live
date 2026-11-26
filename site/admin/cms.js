const API="https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const KEY="clipviet.admin.session.v1";
try{sessionStorage.removeItem(KEY)}catch{}
const $=s=>document.querySelector(s);
const form=$("#cms-form"),list=$("#cms-list"),message=$("#cms-status-message");
let rows=[];
function token(){try{return sessionStorage.getItem(KEY)||""}catch{return ""}}
async function request(path,options={}){
 const t=token(); if(!t) throw new Error("Preview chỉ xem thử. CMS API tiếp tục được bảo vệ phía máy chủ; không có quyền tạo, sửa hoặc xóa bài viết trong chế độ này.");
 const response=await fetch(API+path,{...options,headers:{"content-type":"application/json",authorization:"Bearer "+t,...(options.headers||{})},cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||"CMS request failed");
 return data;
}
function text(tag,value,cls){const n=document.createElement(tag);n.textContent=value||"";if(cls)n.className=cls;return n}
function reset(){form.reset();$("#cms-id").value="";$("#cms-status").value="draft";message.textContent="Đang tạo bài viết mới."}
function render(){
 list.replaceChildren();
 if(!rows.length){list.append(text("p","Chưa có bài viết. Tạo bài đầu tiên ở biểu mẫu phía trên.","empty"));return}
 for(const row of rows){
  const item=text("article","", "cms-item"); item.append(text("h3",row.title));
  item.append(text("p","/"+row.slug+" · "+(row.updated_at||"")));
  item.append(text("span",row.status==="published"?"ĐÃ XUẤT BẢN":"BẢN NHÁP","cms-state"));
  const actions=text("div","","cms-item-actions");
  const edit=text("button","SỬA","secondary");edit.type="button";edit.addEventListener("click",()=>{ $("#cms-id").value=row.id;$("#cms-title").value=row.title;$("#cms-slug").value=row.slug;$("#cms-excerpt").value=row.excerpt||"";$("#cms-body").value=row.body||"";$("#cms-status").value=row.status;form.scrollIntoView({behavior:"smooth",block:"start"});});
  const del=text("button","XÓA","secondary");del.type="button";del.addEventListener("click",async()=>{if(!confirm("Xóa bài viết này?"))return;try{await request("/api/admin/articles/"+row.id,{method:"DELETE"});await load()}catch(e){message.textContent=e.message}});
  actions.append(edit,del);item.append(actions);list.append(item);
 }
}
async function load(){
 try{message.textContent="Đang tải dữ liệu CMS…";const data=await request("/api/admin/articles");rows=data.data||[];render();message.textContent=rows.length+" bài viết đã tải từ D1."}
 catch(e){message.textContent=e.message}
}
form.addEventListener("submit",async e=>{
 e.preventDefault();
 const id=$("#cms-id").value;
 const payload={title:$("#cms-title").value.trim(),slug:$("#cms-slug").value.trim().toLowerCase(),excerpt:$("#cms-excerpt").value.trim(),body:$("#cms-body").value,status:$("#cms-status").value};
 try{message.textContent="Đang lưu…";await request(id?"/api/admin/articles/"+id:"/api/admin/articles",{method:id?"PUT":"POST",body:JSON.stringify(payload)});reset();await load();message.textContent="Đã lưu bài viết vào Cloudflare D1."}
 catch(err){message.textContent=err.message}
});
$("#cms-new").addEventListener("click",reset);
window.addEventListener("clipviet-admin-auth",event=>{if(event.detail?.allowed)load();else{rows=[];render();message.textContent="Preview chỉ xem thử. CMS đang khóa; API máy chủ vẫn yêu cầu phiên quản trị hợp lệ."}});
if(token())load();

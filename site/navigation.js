const menu=document.querySelector("#filter-menu");
if(menu){
 const primary=document.querySelector(".primary-nav");
 if(primary) primary.innerHTML='<a href="./community/">COMMUNITY</a><a href="./browse/">CLIPVIET</a>';
 const oldNav=menu.querySelector(".drawer-nav");
 const oldFilters=menu.querySelector(".filter-group");
 const suggestion=menu.querySelector(".suggestion-panel");
 const foot=menu.querySelector(".filter-menu-foot");
 const header=menu.querySelector(".filter-menu-head");
 if(oldNav) oldNav.remove();
 if(oldFilters) oldFilters.remove();
 const search=document.createElement("label");
 search.className="navigation-search";
 search.innerHTML='<span aria-hidden="true">⌕</span><input type="search" id="navigation-search" placeholder="Tìm danh mục, diễn viên, quốc gia…" aria-label="Tìm trong menu">';
 header.after(search);
 const community=document.createElement("section");
 community.className="nav-section";
 community.id="community";
 community.innerHTML='<h3 class="nav-section-title">COMMUNITY <small>CỘNG ĐỒNG</small></h3><div class="nav-community-links"><a href="./community/">Mở Community Hub</a><a href="./">Trang chủ ClipViet</a><a href="./#video-suggestion" id="open-suggestion">Đề xuất video <span>Gửi nguồn có quyền</span></a><a href="./sources.html">Nguồn liên kết</a><a href="./api-docs/">Tài liệu API</a></div>';
 const clip=document.createElement("section");
 clip.className="nav-section";
 clip.id="clipviet";
 clip.innerHTML='<h3 class="nav-section-title">CLIPVIET <small>THƯ VIỆN 18+</small></h3>';
 const groups=[
  ["Phim người lớn",["Phim người lớn","Phim người lớn – Vú to","Phim người lớn – Sex tập thể","Phim người lớn Việt Nam","Phim người lớn Trung Quốc","Bộ sưu tập phim người lớn","MILF – Phụ nữ trưởng thành","Gái xinh trưởng thành","JAV Vietsub","Cosplay người lớn","Nữ diễn viên nổi bật"]],
  ["Clip người lớn",["Clip người lớn Việt Nam","Clip người lớn Trung Quốc","Clip người lớn châu Âu","FC2 PPV","Clip người lớn Hàn Quốc","Clip người lớn Thái Lan","Sweetie Fox","Nội dung không che"]],
  ["Khám phá",["Mới nhất","Phân loại","Bảng xếp hạng","Danh sách diễn viên","Thể loại","Danh sách tag"]]
 ];
 for(const [title,items] of groups){
  const details=document.createElement("details");details.className="nav-accordion";
  const summary=document.createElement("summary");summary.textContent=title;details.append(summary);
  const list=document.createElement("div");list.className="nav-accordion-links";
  for(const label of items){const a=document.createElement("a");a.href="./browse/?q="+encodeURIComponent(label);a.textContent=label;list.append(a)}
  details.append(list);clip.append(details);
 }
 const friendly=document.createElement("details");friendly.className="nav-accordion";
 friendly.innerHTML='<summary>Liên kết thân thiện</summary><div class="nav-community-links"></div>';
 const friendlyList=friendly.querySelector("div");
 const externalNames=["ภาษาไทย","VIEXX","Porn Ranger","Theporndude","ThemphoTV","JAV","JAV HAY","PornMate","PornLinks"];
 for(const name of externalNames){const row=document.createElement("div");row.className="nav-plain-link";row.textContent=name;const note=document.createElement("span");note.textContent="chờ xác minh URL";row.append(note);friendlyList.append(row)}
 const actors=document.createElement("a");actors.className="nav-plain-link";actors.href="https://buomtv.biz/actors";actors.target="_blank";actors.rel="noopener noreferrer";actors.textContent="BuomTV · Danh sách diễn viên ↗";friendly.append(actors);
 clip.append(friendly);
 const legal=document.createElement("p");legal.className="nav-legal-note";legal.textContent="Chỉ dành cho người từ đủ 18 tuổi. Chỉ lập chỉ mục nội dung có sự đồng thuận, không liên quan người dưới 18 tuổi và có quyền phân phối hợp pháp. Danh mục không tự động kích hoạt nguồn phát.";
 clip.append(legal);
 search.after(community,clip);
 if(suggestion){const panel=document.createElement("details");panel.className="nav-accordion";panel.id="suggestion-details";panel.innerHTML="<summary>Đề xuất video</summary>";panel.append(suggestion);community.append(panel);suggestion.hidden=false}
 const input=search.querySelector("input");
 input.addEventListener("input",()=>{
  const q=input.value.trim().toLocaleLowerCase("vi");
  menu.querySelectorAll(".nav-accordion,.nav-community-links a,.nav-accordion-links a,.nav-plain-link").forEach(el=>{
   const match=!q||el.textContent.toLocaleLowerCase("vi").includes(q);
   if(el.matches(".nav-accordion")){
    const children=[...el.querySelectorAll(".nav-accordion-links a,.nav-community-links a,.nav-plain-link")];
    const groupMatch=!q||match||children.some(child=>child.textContent.toLocaleLowerCase("vi").includes(q));
    el.hidden=!groupMatch;
    if(q&&groupMatch)el.open=true;
   }else el.hidden=!match;
  });
 });
 menu.querySelector("#open-suggestion")?.addEventListener("click",()=>{const d=menu.querySelector("#suggestion-details");if(d)d.open=true});
}

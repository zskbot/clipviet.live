const menu = document.querySelector("#filter-menu");
if (menu) {
  const suggestion = menu.querySelector(".suggestion-panel");
  const toggle = document.querySelector("#menu-toggle");
  menu.replaceChildren();

  const head = document.createElement("div");
  head.className = "filter-menu-head";
  head.innerHTML = '<div><p class="eyebrow">CLIPVIET / ĐIỀU HƯỚNG</p><h2>Khám phá thư viện</h2><p class="menu-lead">Tìm kiếm và duyệt nội dung theo danh mục, khu vực hoặc nguồn dữ liệu.</p></div>';
  const close = document.createElement("button");
  close.id = "menu-close"; close.className = "menu-close"; close.type = "button";
  close.setAttribute("aria-label", "Đóng menu"); close.textContent = "×"; head.append(close);

  const searchForm = document.createElement("form");
  searchForm.id = "menu-search-form"; searchForm.className = "navigation-search";
  searchForm.setAttribute("role", "search");
  searchForm.innerHTML = '<span aria-hidden="true">⌕</span><input type="search" id="navigation-search" name="q" placeholder="Tìm video, diễn viên, danh mục…" aria-label="Tìm kiếm ClipViet"><button type="submit">TÌM KIẾM</button>';

  const primary = document.createElement("section");
  primary.className = "nav-section";
  primary.innerHTML = '<h3 class="nav-section-title">TRUY CẬP NHANH</h3><div class="nav-community-links"><a href="./browse/">Khám phá tất cả video</a><a href="./library/">Thư viện</a><a href="./playlists/">Danh sách phát</a><a href="./sources.html">Nguồn video</a><a href="./api-docs/">Tài liệu API</a><a href="./watch/">Trình phát video</a><a href="./music/">Trình phát nhạc</a><a href="./video/">Trình phát độc lập</a></div>';

  const discovery = document.createElement("section");
  discovery.className = "nav-section nav-discovery";
  discovery.innerHTML = '<h3 class="nav-section-title">DANH MỤC KHÁM PHÁ</h3><p class="nav-section-note">Chọn một chủ đề để mở trang khám phá với bộ lọc tương ứng.</p>';
  const groups = [
    ["NỔI BẬT", [["Mới cập nhật","latest"],["Diễn viên","actors"],["Thể loại","genres"]]],
    ["KHU VỰC", [["Việt Nam","vietnam"],["Trung Quốc","china"],["Âu – Mỹ","europe"],["Nam Á","south-asia"]]],
    ["ĐỊNH DẠNG & CHỦ ĐỀ", [["Vietsub","vietsub"],["JAV HD","jav"],["Người trưởng thành","adult"],["Không che","uncensored"],["Nghiệp dư","amateur"],["Gương mặt nổi bật","beauty"]]],
    ["NGUỒN / TỪ KHÓA", [["BuomTV","buomtv"],["Hsex","hsex"],["Xnhau","xnhau"],["VLXX","vlxx"],["XVideos","xvideos"],["XNXX","xnxx"]]]
  ];
  for (const [label, entries] of groups) {
    const group = document.createElement("div"); group.className = "nav-category-group";
    const title = document.createElement("h4"); title.textContent = label;
    const chips = document.createElement("div"); chips.className = "nav-category-chips";
    for (const [name,key] of entries) {
      const link = document.createElement("a"); link.href = "./browse/?quick=" + encodeURIComponent(key);
      link.textContent = name; chips.append(link);
    }
    group.append(title,chips); discovery.append(group);
  }

  const catalogSection = document.createElement("section");
  catalogSection.className = "nav-section nav-catalog-categories";
  catalogSection.innerHTML = '<h3 class="nav-section-title">DANH MỤC TỪ DỮ LIỆU</h3><p class="nav-section-note">Danh mục và nguồn thực tế sẽ xuất hiện khi metadata catalog khả dụng.</p>';
  const catalogList = document.createElement("div"); catalogList.className = "nav-catalog-list"; catalogSection.append(catalogList);

  const api = document.createElement("section");
  api.className = "nav-section nav-api-status";
  api.innerHTML = '<h3 class="nav-section-title">TRẠNG THÁI CATALOG</h3><p id="menu-api-status" role="status" aria-live="polite">Đang kiểm tra khả năng kết nối…</p>';

  const about = document.createElement("section");
  about.className = "nav-section nav-about";
  about.innerHTML = '<p class="eyebrow">GIỚI THIỆU CLIPVIET.LIVE</p><h3>Một điểm đến.<br><span>Nhiều câu chuyện.</span></h3><p>Phiên bản GitHub Pages là frontend tĩnh để kiểm tra giao diện và trải nghiệm duyệt thư viện. Các chức năng cần máy chủ — API video, quản trị, webhook và lưu trữ — vẫn nằm ngoài phạm vi Pages.</p>';

  const community = document.createElement("section");
  community.className = "nav-section nav-community";
  community.innerHTML = '<h3 class="nav-section-title">CỘNG ĐỒNG</h3><div class="nav-community-links"><a href="./community/">Cộng đồng ClipViet</a><a href="#video-suggestion">Gửi đề xuất video</a></div>';

  const footer = document.createElement("div");
  footer.className = "filter-menu-foot";
  footer.innerHTML = '<p>Chỉ dành cho người từ đủ 18 tuổi. Chỉ hiển thị nội dung có sự đồng thuận và quyền phân phối hợp pháp. Không tiếp nhận nội dung liên quan người dưới 18 tuổi.</p>';

  menu.append(head,searchForm,primary,discovery,catalogSection,api,about,community,footer);
  // Move the overlay out of the sticky header stacking context.
  document.body.append(menu);
  // Keep the suggestion form on the page, outside the navigation overlay.
  if (suggestion) {
    suggestion.classList.add("standalone-suggestion");
    const catalog = document.querySelector("#catalog");
    if (catalog) catalog.append(suggestion);
    else document.querySelector("main")?.append(suggestion);
  }

  searchForm.addEventListener("submit",event=>{
    event.preventDefault();
    const q=searchForm.querySelector("input").value.trim();
    if(q) location.href="./browse/?q="+encodeURIComponent(q);
  });
  const input=searchForm.querySelector("input");
  input.addEventListener("input",()=>{
    const q=input.value.trim().toLocaleLowerCase("vi");
    menu.querySelectorAll(".nav-section").forEach(section=>{
      section.hidden=!!q&&!section.textContent.toLocaleLowerCase("vi").includes(q);
    });
  });
  fetch("./data/catalog.json",{cache:"no-store",headers:{Accept:"application/json"}})
    .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(data=>{
      const categories=Array.isArray(data.categories)?data.categories:[];
      const providers=Array.isArray(data.providers)?data.providers:[];
      if(!categories.length&&!providers.length){
        const empty=document.createElement("p");empty.className="nav-empty-state";
        empty.textContent="Chưa có dữ liệu danh mục. Các danh mục nhanh phía trên vẫn có thể sử dụng.";
        catalogList.append(empty);return;
      }
      const seen=new Set();
      for(const item of categories){
        const key=[item.sourceId,item.id].join(":");if(seen.has(key))continue;seen.add(key);
        const a=document.createElement("a");
        a.href="./browse/?source="+encodeURIComponent(item.sourceId||"")+"&category="+encodeURIComponent(item.id||"");
        a.textContent=[item.sourceName,item.name].filter(Boolean).join(" · ");catalogList.append(a);
      }
      for(const item of providers){
        const a=document.createElement("a");a.href="./browse/?source="+encodeURIComponent(item.id||"");
        a.textContent=(item.name||item.id||"Nguồn")+" · "+(item.count??0)+" video";catalogList.append(a);
      }
    })
    .catch(()=>{
      const empty=document.createElement("p");empty.className="nav-empty-state";
      empty.textContent="Metadata danh mục hiện chưa khả dụng. Bạn vẫn có thể duyệt bằng các danh mục nhanh.";
      catalogList.append(empty);
    });
  close.addEventListener("click",()=>toggle?.click());
}

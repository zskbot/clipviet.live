const menu = document.querySelector("#filter-menu");
if (menu) {
  const suggestion = menu.querySelector(".suggestion-panel");
  const toggle = document.querySelector("#menu-toggle");
  menu.replaceChildren();

  const head = document.createElement("div");
  head.className = "filter-menu-head";
  head.innerHTML = '<div><p class="eyebrow">CLIPVIET / NAVIGATION</p><h2>Khám phá thư viện</h2></div>';
  const close = document.createElement("button");
  close.id = "menu-close";
  close.className = "menu-close";
  close.type = "button";
  close.setAttribute("aria-label", "Đóng menu");
  close.textContent = "×";
  head.append(close);

  const searchForm = document.createElement("form");
  searchForm.id = "menu-search-form";
  searchForm.className = "navigation-search";
  searchForm.setAttribute("role", "search");
  searchForm.innerHTML = '<span aria-hidden="true">⌕</span><input type="search" id="navigation-search" name="q" placeholder="Tìm video, danh mục, nguồn…" aria-label="Tìm kiếm ClipViet"><button type="submit" aria-label="Tìm kiếm">TÌM</button>';

  const primary = document.createElement("section");
  primary.className = "nav-section";
  primary.innerHTML = '<h3 class="nav-section-title">ĐIỀU HƯỚNG <small>EXPLORE</small></h3><div class="nav-community-links"><a href="./">Trang chủ <span>↗</span></a><a href="./browse/">Khám phá video <span>↗</span></a><a href="./library/">Thư viện <span>↗</span></a><a href="./playlists/">Danh sách phát <span>↗</span></a><a href="./sources.html">Nguồn liên kết <span>↗</span></a><a href="./api-docs/">Tài liệu API <span>↗</span></a><a href="./community/">Community Hub <span>↗</span></a></div>';

  const discovery = document.createElement("section");
  discovery.className = "nav-section";
  discovery.innerHTML = '<h3 class="nav-section-title">DANH MỤC <small>QUICK DISCOVERY</small></h3>';
  const chips = document.createElement("div");
  chips.className = "nav-category-chips";
  const categories = [
    ["Mới nhất","latest"],["Trung Quốc","china"],["Việt Nam","vietnam"],
    ["Người trưởng thành","adult"],["JAV HD","jav"],["BuomTV","buomtv"],
    ["Hsex","hsex"],["Xnhau","xnhau"],["VLXX","vlxx"],["Vietsub","vietsub"],["Âu – Mỹ","europe"]
  ];
  for (const [label, key] of categories) {
    const link = document.createElement("a");
    link.href = "./browse/?quick=" + encodeURIComponent(key);
    link.textContent = label;
    chips.append(link);
  }
  discovery.append(chips);

  const about = document.createElement("section");
  about.className = "nav-section nav-about";
  about.innerHTML = '<p class="eyebrow">ABOUT CLIPVIET.LIVE</p><h3>Một điểm đến.<br><span>Nhiều câu chuyện.</span></h3><p>Phiên bản GitHub Pages là frontend tĩnh để kiểm tra giao diện và trải nghiệm duyệt thư viện. Các chức năng cần máy chủ — API video, quản trị, webhook và lưu trữ — vẫn nằm ngoài phạm vi Pages.</p>';

  const api = document.createElement("section");
  api.className = "nav-section nav-api-status";
  api.innerHTML = '<h3 class="nav-section-title">API DANH MỤC <small>STATUS</small></h3><p id="menu-api-status" role="status" aria-live="polite">Đang kiểm tra khả năng kết nối…</p>';

  const community = document.createElement("section");
  community.className = "nav-section";
  community.innerHTML = '<h3 class="nav-section-title">LIÊN KẾT & CỘNG ĐỒNG <small>COMMUNITY</small></h3><div class="nav-community-links"><a href="./sources.html">Danh mục nguồn liên kết <span>↗</span></a><a href="./community/">Cộng đồng ClipViet <span>↗</span></a><a href="https://clipform.io/3d76a8c57" target="_blank" rel="noopener noreferrer">Gửi đề xuất qua Clipform <span>↗</span></a></div>';

  const footer = document.createElement("div");
  footer.className = "filter-menu-foot";
  footer.innerHTML = '<p>Chỉ dành cho người từ đủ 18 tuổi. Chỉ hiển thị nội dung có sự đồng thuận và quyền phân phối hợp pháp. Không tiếp nhận nội dung liên quan người dưới 18 tuổi.</p>';

  menu.append(head, searchForm, primary, discovery, about, api, community);
  if (suggestion) {
    const suggestions = document.createElement("section");
    suggestions.className = "nav-section nav-suggestions";
    suggestions.innerHTML = '<h3 class="nav-section-title">ĐỀ XUẤT VIDEO <small>COMMUNITY</small></h3>';
    suggestions.append(suggestion);
    suggestion.hidden = false;
    menu.append(suggestions);
  }
  menu.append(footer);

  const input = searchForm.querySelector("input");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLocaleLowerCase("vi");
    menu.querySelectorAll(".nav-section").forEach((section) => {
      const matches = !q || section.textContent.toLocaleLowerCase("vi").includes(q);
      section.hidden = !matches;
    });
  });
  close.addEventListener("click", () => toggle?.click());
}
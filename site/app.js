import { videos as demoVideos } from "./data.js";

const $ = (selector) => document.querySelector(selector);
const grid = $("#video-grid");
const featuredRoot = $("#featured-video");
const count = $("#result-count");
const empty = $("#empty-state");
const search = $("#search");
const dialog = $("#detail-dialog");
const detail = $("#detail-content");
const ageDialog = $("#age-dialog");
const categoryRoot = $("#categories");
const countryRoot = $("#country-filters");
const genreRoot = $("#genre-filters");
const activeFiltersRoot = $("#active-filters");
const menu = $("#filter-menu");
const menuToggle = $("#menu-toggle");
let videos = demoVideos;
let activeCategory = "Tất cả";
let activeCountry = "";
let activeGenre = "";
let query = new URLSearchParams(location.search).get("q") || "";
const itemsPerPage = 30;
let currentPage = 1;
const pagination = document.createElement("nav");
pagination.className = "video-pagination";
pagination.setAttribute("aria-label", "Phân trang video");
grid.insertAdjacentElement("afterend", pagination);

search.value = query;
$("#year").textContent = new Date().getFullYear();

function filterButton(label, root, current, setValue) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drawer-option";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(current() === label));
  button.addEventListener("click", () => {
    setValue(current() === label ? "" : label);
    currentPage = 1;
    root.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.textContent === current())));
    render();
  });
  root.append(button);
}
["Việt Nam", "Hàn Quốc", "Trung Quốc", "Thái Lan", "Nhật Bản"].forEach((v) => filterButton(v, countryRoot, () => activeCountry, (v) => { activeCountry = v; }));
["JAV", "VLXX", "18+"].forEach((v) => filterButton(v, genreRoot, () => activeGenre, (v) => { activeGenre = v; }));

function renderCategories(values) {
  categoryRoot.replaceChildren();
  values.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      currentPage = 1;
      categoryRoot.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.textContent === category)));
      render();
    });
    categoryRoot.append(button);
  });
}
renderCategories(["Tất cả", "Hành động", "Tài liệu"]);

function render() {
  const term = query.trim().toLocaleLowerCase("vi");
  const sort = $("#sort").value;
  const items = videos.filter((video) => {
    const metadata = [video.title, video.category, video.genre, video.description, video.country, video.sourceName].filter(Boolean).join(" ").toLocaleLowerCase("vi");
    return (activeCategory === "Tất cả" || video.category === activeCategory) &&
      (!activeCountry || video.country === activeCountry) &&
      (!activeGenre || metadata.includes(activeGenre.toLocaleLowerCase("vi"))) &&
      metadata.includes(term);
  });
  if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, "vi"));
  else items.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  const totalPages = Math.ceil(items.length / itemsPerPage);
  currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const pageItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  grid.replaceChildren();
  count.textContent = items.length + " VIDEO";
  empty.hidden = items.length > 0;
  renderPagination(totalPages);
  activeFiltersRoot.replaceChildren();
  [activeCountry, activeGenre].filter(Boolean).forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "active-filter-chip";
    chip.textContent = label;
    activeFiltersRoot.append(chip);
  });
  activeFiltersRoot.hidden = !activeCountry && !activeGenre;
  for (const video of pageItems) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "video-card";
    card.innerHTML = '<div class="poster"><img loading="lazy" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
    const img = card.querySelector("img");
    img.src = video.poster || "./poster-fallback.svg";
    img.alt = video.title;
    img.addEventListener("error", () => { img.src = "./poster-fallback.svg"; }, { once: true });
    card.querySelector(".poster-label").textContent = "18+";
    card.querySelector("h3").textContent = video.title;
    card.querySelector(".card-info p").textContent = [video.year, video.country, video.category].filter(Boolean).join(" · ");
    card.addEventListener("click", () => openDetail(video));
    grid.append(card);
  }
}


function renderPagination(totalPages) {
  pagination.replaceChildren();
  if (totalPages < 1) { pagination.hidden = true; return; }
  pagination.hidden = false;

  const goToPage = (page) => {
    if (!Number.isInteger(page) || page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    render();
    const target = document.querySelector("#catalog .section-heading");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addButton = (label, page, { active = false, disabled = false, title = "" } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-button" + (active ? " is-active" : "");
    button.textContent = label;
    button.disabled = disabled;
    button.setAttribute("aria-label", title || ("Trang " + page));
    if (active) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => goToPage(page));
    pagination.append(button);
  };

  addButton("« Đầu", 1, { disabled: currentPage === 1, title: "Trang đầu" });
  addButton("‹ Trước", currentPage - 1, { disabled: currentPage === 1, title: "Trang trước" });

  const windowSize = 7;
  const startPage = Math.max(1, Math.min(currentPage - 3, totalPages - windowSize + 1));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  if (startPage > 1) {
    addButton("1", 1, { title: "Trang 1" });
    if (startPage > 2) {
      const leading = document.createElement("span");
      leading.className = "page-ellipsis";
      leading.textContent = "…";
      leading.setAttribute("aria-hidden", "true");
      pagination.append(leading);
    }
  }
  for (let page = startPage; page <= endPage; page += 1) {
    addButton(String(page), page, { active: page === currentPage, title: "Trang " + page });
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const trailing = document.createElement("span");
      trailing.className = "page-ellipsis";
      trailing.textContent = "…";
      trailing.setAttribute("aria-hidden", "true");
      pagination.append(trailing);
    }
    addButton(String(totalPages), totalPages, { title: "Trang cuối: " + totalPages });
  }

  const jumpForm = document.createElement("form");
  jumpForm.className = "page-jump";
  jumpForm.setAttribute("aria-label", "Đi đến trang");
  const jumpLabel = document.createElement("label");
  jumpLabel.textContent = "Đến trang";
  const jumpInput = document.createElement("input");
  jumpInput.type = "number";
  jumpInput.inputMode = "numeric";
  jumpInput.min = "1";
  jumpInput.max = String(totalPages);
  jumpInput.step = "1";
  jumpInput.placeholder = String(currentPage);
  jumpInput.value = String(currentPage);
  jumpInput.setAttribute("aria-label", "Nhập số trang từ 1 đến " + totalPages);
  const jumpButton = document.createElement("button");
  jumpButton.type = "submit";
  jumpButton.textContent = "Đi";
  jumpForm.append(jumpLabel, jumpInput, jumpButton);
  jumpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const page = Number(jumpInput.value);
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      jumpInput.setCustomValidity("Nhập số trang từ 1 đến " + totalPages + ".");
      jumpInput.reportValidity();
      return;
    }
    jumpInput.setCustomValidity("");
    goToPage(page);
  });
  jumpInput.addEventListener("input", () => jumpInput.setCustomValidity(""));
  pagination.append(jumpForm);

  addButton("Tiếp »", currentPage + 1, { disabled: currentPage === totalPages, title: "Trang tiếp theo" });
  addButton("Cuối »", totalPages, { disabled: currentPage === totalPages, title: "Trang cuối" });
}

let featuredVideos = [];
let featuredIndex = 0;
let featuredTimer = null;
function renderFeatured() {
  if (!featuredRoot || !featuredVideos.length) return;
  const video = featuredVideos[featuredIndex % featuredVideos.length];
  const image = $("#featured-image");
  image.src = video.poster || "./poster-fallback.svg";
  image.alt = video.title || "Video nổi bật";
  image.onerror = () => { image.src = "./poster-fallback.svg"; };
  $("#featured-title").textContent = video.title || "Video nổi bật";
  $("#featured-meta").textContent = [video.year, video.duration, video.country, video.category].filter(Boolean).join(" · ");
  $("#featured-description").textContent = video.description || "Khám phá video đang được quan tâm trên ClipViet.";
  $("#featured-index").textContent = String(featuredIndex + 1).padStart(2, "0");
  $("#featured-open").onclick = () => openDetail(video);
  $("#featured-watch").onclick = () => openDetail(video);
}
function setFeaturedVideos(items) {
  if (!featuredRoot) return;
  const blocked = /underage|minor|loli|shota|school\\s?(girl|boy|student)|teen\\s?(girl|boy)|học sinh|nữ sinh|nam sinh|thiếu nhi/i;
  featuredVideos = items.filter((video) => !blocked.test([video.title, video.category, video.description, video.genre].filter(Boolean).join(" ")));
  featuredVideos.sort((a, b) => (b.trendingScore - a.trendingScore) || (b.views - a.views) || (b.playCount - a.playCount) || (Number(b.year || 0) - Number(a.year || 0)));
  featuredIndex = 0;
  renderFeatured();
  if (featuredTimer) clearInterval(featuredTimer);
  if (featuredVideos.length > 1) featuredTimer = setInterval(() => {
    featuredIndex = (featuredIndex + 1) % featuredVideos.length;
    renderFeatured();
  }, 10000);
}

function openDetail(video) {
  detail.innerHTML = '<div class="detail-inner"><img alt=""><div><p class="eyebrow"></p><h2></h2><p class="description"></p><p class="meta"></p><p class="detail-source"></p><a class="primary-link watch-link" hidden>PHÁT VIDEO <span>↗</span></a></div></div>';
  const img = detail.querySelector("img");
  img.src = video.poster || "./poster-fallback.svg";
  img.alt = video.title;
  img.addEventListener("error", () => { img.src = "./poster-fallback.svg"; }, { once: true });
  detail.querySelector(".eyebrow").textContent = video.category || "VIDEO";
  detail.querySelector("h2").textContent = video.title;
  detail.querySelector(".description").textContent = video.description || "";
  detail.querySelector(".meta").textContent = [video.year, video.duration, video.rating, video.country].filter(Boolean).join(" · ");
  detail.querySelector(".detail-source").textContent = video.apiManaged ? "Nguồn: " + (video.sourceName || video.sourceId) : "Bản ghi demo.";
  if (video.apiManaged && video.sourceId && video.id) {
    const link = detail.querySelector(".watch-link");
    link.hidden = false;
    link.href = "./watch/source.html?sourceId=" + encodeURIComponent(video.sourceId) + "&vodId=" + encodeURIComponent(video.id);
  }
  dialog.showModal();
}

let menuReturnFocus = null;
function closeMenu(returnFocus = false) {
  menu.hidden = true;
  document.body.classList.remove("menu-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Mở menu điều hướng");
  if (returnFocus) (menuReturnFocus || menuToggle).focus();
}
menuToggle?.addEventListener("click", () => {
  const opening = menu.hidden;
  if (opening) {
    menuReturnFocus = document.activeElement;
    menu.hidden = false;
    document.body.classList.add("menu-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Đóng menu điều hướng");
    requestAnimationFrame(() => menu.querySelector(".drawer-nav a")?.focus());
  } else closeMenu(true);
});
$("#menu-close")?.addEventListener("click", () => closeMenu(true));
menu?.querySelectorAll(".drawer-nav a").forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("keydown", (event) => {
  if (!menu || menu.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
  if (event.key === "Tab") {
    const focusable = [...menu.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (!focusable.length) { event.preventDefault(); menu.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
$("#reset-filters")?.addEventListener("click", () => {
  activeCountry = "";
  activeGenre = "";
  currentPage = 1;
  countryRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  genreRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  render();
});
$("#close-detail")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
$("#search-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  query = search.value;
  currentPage = 1;
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
  history.replaceState({}, "", url);
  render();
});
search?.addEventListener("input", () => { query = search.value; currentPage = 1; render(); });
$("#sort")?.addEventListener("change", () => { currentPage = 1; render(); });

function hasAgeConfirmation() {
  try { return sessionStorage.getItem("clipviet-age-confirmed") === "yes"; } catch { return false; }
}
if (ageDialog && !hasAgeConfirmation()) ageDialog.showModal();
ageDialog?.addEventListener("cancel", (event) => event.preventDefault());
$("#confirm-age")?.addEventListener("click", () => {
  try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {}
  ageDialog.close();
});
$("#leave-button")?.addEventListener("click", () => { location.href = "https://www.google.com/"; });

render();
(async () => {
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("catalog.json HTTP " + response.status);
    const catalog = await response.json();
    if (!Array.isArray(catalog.videos) || !catalog.videos.length) throw new Error("Catalog chưa có video");
    videos = catalog.videos.map((item) => ({
      id: item.id, sourceId: item.sourceId, sourceName: item.sourceName,
      title: item.title, category: item.categoryName || "Khác", genre: item.categoryName || "",
      year: item.year, duration: item.duration, rating: "18+", description: item.description,
      poster: item.poster, country: item.area, apiManaged: true,
      views: Number(item.views || item.viewCount || item.hits || 0),
      playCount: Number(item.playCount || 0), trendingScore: Number(item.trendingScore || 0)
    }));
    renderCategories(["Tất cả", ...new Set(videos.map((item) => item.category).filter(Boolean))]);
    setFeaturedVideos(videos);
    render();
    const note = document.querySelector(".data-note");
    if (note) note.textContent = "GITHUB PAGES CATALOG · " + videos.length + " VIDEO · CẬP NHẬT " + new Date(catalog.updatedAt).toLocaleString("vi-VN");
  } catch (error) {
    const note = document.querySelector(".data-note");
    if (note) note.textContent = "CATALOG CHƯA ĐỒNG BỘ · " + error.message;
  }
})();

// Community suggestions: validate official HTTPS URL and copy a review-ready payload.
const suggestionForm = $("#suggestion-form");
suggestionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = $("#suggest-title").value.trim();
  const rawUrl = $("#suggest-url").value.trim();
  const reason = $("#suggest-reason").value.trim();
  const status = $("#suggestion-status");
  let url;
  try { url = new URL(rawUrl); } catch { url = null; }
  if (!title || !url || url.protocol !== "https:") {
    status.textContent = "Vui lòng nhập tên video và URL HTTPS hợp lệ.";
    status.dataset.state = "error";
    return;
  }
  const payload = ["ĐỀ XUẤT VIDEO CLIPVIET", "Tên: " + title, "URL nguồn chính thức: " + url.href, "Lý do: " + (reason || "Chưa cung cấp"), "Lưu ý: Chờ kiểm tra thủ công quyền phân phối."].join("\n");
  try {
    await navigator.clipboard.writeText(payload);
    status.textContent = "Đã sao chép nội dung đề xuất. Chưa gửi lên máy chủ; cần gửi qua kênh tiếp nhận chính thức.";
    status.dataset.state = "success";
  } catch {
    status.textContent = "Trình duyệt không cho phép sao chép. Hãy kiểm tra lại URL và thử trên HTTPS.";
    status.dataset.state = "error";
  }
});

import { videos as demoVideos } from "./data.js";
import { initFeaturedPlayer, playFeaturedVideo, resetFeaturedPlayer } from "./player-controls.js";

const $ = (selector) => document.querySelector(selector);
const grid = $("#video-grid");
const featuredRoot = $("#featured-video");
const count = $("#result-count");
const empty = $("#empty-state");
const search = $("#navigation-search");
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

if (search) search.value = query;
$("#year").textContent = new Date().getFullYear();
initFeaturedPlayer();

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



let activeCategoryId = "";
let activeCategoryName = "";
let activeQuickFilter = "latest";
function renderCategories(values) {
  categoryRoot.replaceChildren();
  const all = { id: "", name: "Tất cả" };
  [all, ...values].forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.textContent = category.name;
    button.setAttribute("aria-pressed", String(category.id === activeCategoryId));
    button.addEventListener("click", () => {
      activeCategoryId = category.id;
      activeCategoryName = category.id ? category.name : "";
      currentPage = 1;
      categoryRoot.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      render();
    });
    categoryRoot.append(button);
  });
}

let requestSequence = 0;
let totalPages = 0;
let totalResults = 0;
let pageSize = 30;
const API_BASE = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";

// Real, openly licensed fallback used only when the catalog API is empty or unavailable.
// Tears of Steel — Blender Foundation; CC BY 3.0, attribution required.
const sampleVideo = {
  id: "tears-of-steel-open-movie",
  title: "Tears of Steel",
  category: "Phim ngắn khoa học viễn tưởng",
  year: 2012,
  duration: "12 phút",
  rating: "Mọi lứa tuổi",
  description: "Video mẫu có thể phát để kiểm thử trình phát ClipViet. © Blender Foundation; được cấp phép CC BY 3.0. Giữ nguyên nội dung và credit cuối phim.",
  poster: "https://i.ytimg.com/vi/OHOpb2fS-cM/hqdefault.jpg",
  videoUrl: "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4",
  originalUrl: "https://www.youtube.com/watch?v=OHOpb2fS-cM",
  sourceName: "Blender Foundation",
  isSample: true
};

function setMenuApiStatus(message, state = "info") {
  const status = $("#menu-api-status");
  if (status) {
    status.textContent = message;
    status.dataset.state = state;
  }
}

function render() {
  const sequence = ++requestSequence;
  const params = new URLSearchParams({ page: String(currentPage) });
  if (query.trim()) params.set("keyword", query.trim().slice(0, 100));
  if (activeCategoryId) params.set("categoryId", activeCategoryId);
  if (activeQuickFilter === "latest") params.set("sort", "latest");
  const url = API_BASE + "/api/catalog/videos?" + params.toString();
  count.textContent = "ĐANG TẢI…";
  empty.hidden = true;
  fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Catalog API HTTP " + response.status);
      return response.json();
    })
    .then((payload) => {
      if (sequence !== requestSequence) return;
      const rows = Array.isArray(payload.items) ? payload.items : [];
      totalResults = Math.max(0, Number(payload.total) || 0);
      pageSize = Math.max(1, Number(payload.limit) || 30);
      totalPages = Math.max(0, Number(payload.pageCount) || Math.ceil(totalResults / pageSize));
      if (!rows.length) {
        const gate = payload.rightsGate || {};
        const pendingRights = gate.reason === "provider_pending_approval" || gate.providerApproved === false;
        const message = pendingRights
          ? "Catalog đang trống vì nguồn video chưa được phê duyệt quyền phân phối. ClipViet chỉ hiển thị ảnh poster và thông tin video sau khi hoàn tất xác minh quyền."
          : "Nguồn đã phản hồi nhưng chưa có video đủ điều kiện hiển thị.";
        showCatalogUnavailable(message);
        count.textContent = pendingRights ? "0 VIDEO · CHỜ DUYỆT QUYỀN" : "0 VIDEO";
        return;
      }
      currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
      const pageItems = rows.map((item) => ({
        ...item,
        // Prefer the provider's thumbnail-sized image in grid cards; retain poster/slide fallbacks.
        poster: item.posterThumb || item.poster || item.posterSlide || "",
        category: item.categoryName || "Khác",
        genre: item.categoryName || "",
        country: item.area || "",
        apiManaged: true,
        sources: (Array.isArray(item.lines) ? item.lines : []).flatMap((line) => (Array.isArray(line.episodes) ? line.episodes : []).map((episode) => ({
          url: episode.url,
          type: /\\.m3u8(?:$|\\?)/i.test(String(episode.url || "")) ? "hls" : "mp4"
        }))),
        rating: "18+"
      }));
      grid.replaceChildren();
      count.textContent = totalResults.toLocaleString("vi-VN") + " VIDEO";
      empty.hidden = pageItems.length > 0;
      setFeaturedVideos(pageItems);
      renderPagination(totalPages);
      activeFiltersRoot.replaceChildren();
      if (activeCategoryName) {
        const chip = document.createElement("span");
        chip.className = "active-filter-chip";
        chip.textContent = activeCategoryName;
        activeFiltersRoot.append(chip);
      }
      activeFiltersRoot.hidden = !activeCategoryName;
      for (const video of pageItems) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "video-card";
        card.innerHTML = '<div class="poster"><img loading="lazy" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
        const img = card.querySelector("img");
        img.alt = video.title || "Video";
        const posterCandidates = [video.posterThumb, video.poster, video.posterSlide]
          .filter((value, index, values) => typeof value === "string" && /^https:\/\//i.test(value) && values.indexOf(value) === index);
        let posterIndex = 0;
        img.addEventListener("error", () => {
          posterIndex += 1;
          img.src = posterCandidates[posterIndex] || "./poster-fallback.svg";
        });
        img.src = posterCandidates[posterIndex] || "./poster-fallback.svg";
        card.querySelector(".poster-label").textContent = "18+";
        card.querySelector("h3").textContent = video.title || "Video";
        card.querySelector(".card-info p").textContent = [video.year, video.area, video.categoryName].filter(Boolean).join(" · ");
        card.addEventListener("click", () => openDetail(video));
        grid.append(card);
      }
      setMenuApiStatus("API danh mục đã kết nối · " + totalResults.toLocaleString("vi-VN") + " video.", "success");
    })
    .catch((error) => {
      if (sequence !== requestSequence) return;
      setMenuApiStatus("API DANH MỤC CHƯA KHẢ DỤNG · " + error.message, "error");
      showCatalogUnavailable("API video chưa kết nối: " + error.message);
    });
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
  if (!featuredRoot) return;
  const image = $("#featured-image");
  const player = $("#featured-player");
  const playButton = $("#featured-play");
  resetFeaturedPlayer();
  if (player) { player.pause?.(); player.removeAttribute("src"); player.load?.(); player.hidden = true; }
  const playerStatus = $("#featured-player-status");
  const playerFallback = $("#featured-player-fallback");
  if (playerStatus) { playerStatus.hidden = true; playerStatus.textContent = ""; }
  if (playerFallback) playerFallback.hidden = true;
  if (image) image.hidden = false;
  if (playButton) playButton.hidden = false;

  if (!featuredVideos.length) {
    if ($("#featured-title")) $("#featured-title").textContent = "Chưa có video nổi bật";
    $("#featured-description").textContent = "Chưa có video đủ điều kiện hiển thị từ nguồn API.";
    $("#featured-meta").textContent = "CATALOG ĐANG TRỐNG";
    image.src = "./poster-fallback.svg";
    image.alt = "Chưa có video nổi bật";
    $("#featured-index").textContent = "—";
    $("#featured-watch").disabled = true;
    $("#featured-open").disabled = true;
    return;
  }
  const video = featuredVideos[featuredIndex % featuredVideos.length];
  $("#featured-watch").disabled = false;
  $("#featured-open").disabled = false;
  image.src = video.posterSlide || video.poster || video.posterThumb || "./poster-fallback.svg";
  image.alt = video.title || "Video nổi bật";
  image.onerror = () => { image.src = "./poster-fallback.svg"; };
  $("#featured-title").textContent = video.title || "Video nổi bật";
  $("#featured-meta").textContent = video.isSample
    ? "VIDEO MẪU · CC BY 3.0 · BLENDER FOUNDATION"
    : [video.year, video.duration, video.country, video.category].filter(Boolean).join(" · ");
  $("#featured-description").textContent = video.description || "Khám phá video đang được quan tâm trên ClipViet.";
  $("#featured-index").textContent = String(featuredIndex + 1).padStart(2, "0");
  featuredRoot.querySelector(".eyebrow").textContent = video.isSample
    ? "VIDEO MẪU CÓ GIẤY PHÉP / OPEN MOVIE"
    : "CLIPVIET / MỚI CẬP NHẬT";
  $("#featured-open").onclick = () => openDetail(video);
  const startPlayback = () => {
    if (featuredTimer) clearInterval(featuredTimer);
    featuredTimer = null;
    playFeaturedVideo(video);
  };
  $("#featured-watch").onclick = startPlayback;
  playButton.onclick = startPlayback;
}

function showCatalogUnavailable(message) {
  grid.replaceChildren();
  count.textContent = "CHƯA CÓ DỮ LIỆU NGUỒN";
  empty.hidden = false;
  empty.textContent = message;
  setFeaturedVideos([]);
  renderPagination(0);
  activeFiltersRoot.replaceChildren();
  activeFiltersRoot.hidden = true;
  const note = document.querySelector(".data-note");
  if (note) note.textContent = message + " · KHÔNG HIỂN THỊ VIDEO DEMO THAY THẾ";
}

function renderSampleVideo(reason) {
  grid.replaceChildren();
  setFeaturedVideos([sampleVideo]);
  const card = document.createElement("button");
  card.type = "button";
  card.className = "video-card";
  card.innerHTML = '<div class="poster"><img loading="lazy" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
  const img = card.querySelector("img");
  img.src = sampleVideo.poster;
  img.alt = sampleVideo.title;
  card.querySelector(".poster-label").textContent = "MẪU CC BY";
  card.querySelector("h3").textContent = sampleVideo.title;
  card.querySelector(".card-info p").textContent = "2012 · Blender Foundation · CC BY 3.0";
  card.addEventListener("click", () => openDetail(sampleVideo));
  grid.append(card);
  count.textContent = "1 VIDEO MẪU";
  empty.hidden = true;
  renderPagination(0);
  activeFiltersRoot.replaceChildren();
  activeFiltersRoot.hidden = true;
  const note = document.querySelector(".data-note");
  if (note) note.textContent = reason + " · ĐANG HIỂN THỊ VIDEO MẪU CÓ GIẤY PHÉP";
}

function setFeaturedVideos(items) {
  if (!featuredRoot) return;
  const blocked = /underage|minor|loli|shota|school\\s?(girl|boy|student)|teen\\s?(girl|boy)|học sinh|nữ sinh|nam sinh|thiếu nhi/i;
  featuredVideos = items.filter((video) => !blocked.test([video.title, video.category, video.description, video.genre].filter(Boolean).join(" ")));
  featuredVideos.sort((a, b) => (b.trendingScore - a.trendingScore) || (b.views - a.views) || (b.playCount - a.playCount) || (Number(b.year || 0) - Number(a.year || 0)));
  featuredIndex = 0;
  renderFeatured();
  if (featuredTimer) clearInterval(featuredTimer);
  if (featuredVideos.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && document.visibilityState === "visible") featuredTimer = setInterval(() => {
    featuredIndex = (featuredIndex + 1) % featuredVideos.length;
    renderFeatured();
  }, 10000);
}

function openDetail(video) {
  detail.innerHTML = '<div class="detail-inner"><img alt=""><div><p class="eyebrow"></p><h2></h2><p class="description"></p><p class="meta"></p><p class="detail-source"></p><a class="primary-link watch-link" hidden>PHÁT VIDEO <span>↗</span></a></div></div>';
  const img = detail.querySelector("img");
  img.alt = video.title;
  const detailPosters = [video.poster, video.posterThumb, video.posterSlide]
    .filter((value, index, values) => typeof value === "string" && /^https:\/\//i.test(value) && values.indexOf(value) === index);
  let detailPosterIndex = 0;
  img.addEventListener("error", () => {
    detailPosterIndex += 1;
    img.src = detailPosters[detailPosterIndex] || "./poster-fallback.svg";
  });
  img.src = detailPosters[detailPosterIndex] || "./poster-fallback.svg";
  detail.querySelector(".eyebrow").textContent = video.category || "VIDEO";
  detail.querySelector("h2").textContent = video.title;
  detail.querySelector(".description").textContent = video.description || "";
  detail.querySelector(".meta").textContent = [video.year, video.duration, video.rating, video.country].filter(Boolean).join(" · ");
  detail.querySelector(".detail-source").textContent = video.isSample
    ? "Nguồn: Blender Foundation · CC BY 3.0 · " + "https://creativecommons.org/licenses/by/3.0/"
    : video.apiManaged ? "Nguồn: " + (video.sourceName || video.sourceId) : "Bản ghi demo.";
  if (video.isSample && video.videoUrl) {
    const link = detail.querySelector(".watch-link");
    link.hidden = false;
    link.href = video.originalUrl || "https://www.youtube.com/watch?v=OHOpb2fS-cM";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "PHÁT VIDEO GỐC ↗";
  }
  if (video.apiManaged && video.sourceId && video.id) {
    const link = detail.querySelector(".watch-link");
    link.hidden = false;
    link.href = "./watch/source.html?sourceId=" + encodeURIComponent(video.sourceId) + "&vodId=" + encodeURIComponent(video.id);
  }
  dialog.showModal();
}

let menuReturnFocus = null;
let menuScrollY = 0;
function closeMenu(returnFocus = false) {
  menu.hidden = true;
  document.body.classList.remove("menu-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, menuScrollY);
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Mở menu điều hướng");
  if (returnFocus) (menuReturnFocus || menuToggle).focus();
}
menuToggle?.addEventListener("click", () => {
  const opening = menu.hidden;
  if (opening) {
    menuReturnFocus = document.activeElement;
    menuScrollY = window.scrollY;
    menu.hidden = false;
    document.body.classList.add("menu-open");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + menuScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Đóng menu điều hướng");
    requestAnimationFrame(() => menu.querySelector("#navigation-search")?.focus());
  } else closeMenu(true);
});
$("#menu-close")?.addEventListener("click", () => closeMenu(true));
menu?.querySelectorAll("a[href]").forEach((link) => link.addEventListener("click", () => closeMenu()));
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
  activeCategoryId = "";
  activeCategoryName = "";
  activeQuickFilter = "latest";
  query = "";
  if (search) search.value = "";
  const url = new URL(location.href); url.searchParams.delete("q"); history.replaceState({}, "", url);
  document.querySelectorAll("[data-quick-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.quickFilter === "latest")));
  currentPage = 1;
  categoryRoot.querySelectorAll("button").forEach((button, index) => button.setAttribute("aria-pressed", String(index === 0)));
  countryRoot?.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  genreRoot?.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  render();
});
$("#close-detail")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
$("#menu-search-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  query = search.value.trim();
  currentPage = 1;
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
  history.replaceState({}, "", url);
  render();
  closeMenu();
});



document.querySelectorAll("[data-quick-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeQuickFilter = button.dataset.quickFilter || "";
    const labels = {latest:"",china:"Trung Quốc",vietnam:"Việt Nam",adult:"người trưởng thành",jav:"JAV HD",buomtv:"BuomTV",hsex:"Hsex",xnhau:"Xnhau",vlxx:"VLXX",vietsub:"Vietsub",europe:"Âu Mỹ"};
    query = labels[activeQuickFilter] || "";
    if (search) search.value = query;
    currentPage = 1;
    document.querySelectorAll("[data-quick-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    history.replaceState({}, "", url);
    render();
  });
});

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

(async () => {
  try {
    const response = await fetch(API_BASE + "/api/catalog/categories", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Categories API HTTP " + response.status);
    const payload = await response.json();
    const categories = Array.isArray(payload.data) ? payload.data : [];
    renderCategories(categories.map((item) => ({ id: String(item.id), name: String(item.name || "Khác") })));
    setMenuApiStatus("API danh mục đã kết nối · " + categories.length + " danh mục.", "success");
    render();
  } catch (error) {
    setMenuApiStatus("API DANH MỤC CHƯA KHẢ DỤNG · " + error.message, "error");
    render();
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


// Pause featured rotation while the tab is hidden; resume only when motion is allowed.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (featuredTimer) clearInterval(featuredTimer);
    featuredTimer = null;
    return;
  }
  if (featuredVideos.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !featuredTimer) {
    featuredTimer = setInterval(() => {
      featuredIndex = (featuredIndex + 1) % featuredVideos.length;
      renderFeatured();
    }, 10000);
  }
});

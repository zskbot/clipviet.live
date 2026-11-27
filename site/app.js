import { initFeaturedPlayer, playFeaturedVideo, resetFeaturedPlayer } from "./player-controls.js";

const $ = (selector) => document.querySelector(selector);
const grid = $("#video-grid");
const featuredRoot = $("#featured-video");
const count = $("#result-count");
const empty = $("#empty-state");
const loadingState = $("#loading-state");
const apiErrorState = $("#api-error");
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
let videos = [];
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
const API_BASE = "";
// Preview-only recovery: keep the original AppleCMS Worker as the sole catalog source.

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
  count.textContent = "ĐANG KIỂM TRA QUYỀN & TẢI VIDEO…";
  grid.replaceChildren();
  empty.hidden = true;
  if (loadingState) { loadingState.hidden = false; loadingState.textContent = "Đang tải danh mục và xác minh quyền hiển thị…"; }
  if (apiErrorState) apiErrorState.hidden = true;
  fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || payload.message || ("Catalog API HTTP " + response.status));
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    })
    .then((payload) => {
      if (sequence !== requestSequence) return;
      const rawRows = Array.isArray(payload.items) ? payload.items : [];
      const excludedAgeLabel = /under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy)|học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên/i;
      // Catalog metadata can remain visible; AppleCMS presence does not prove distribution rights.
      // Playback requires an explicit, verified, unexpired approval and an explicit playback grant.
      const rows = rawRows.filter((item) =>
        !excludedAgeLabel.test([item.title, item.categoryName, item.description, item.actors, item.director].filter(Boolean).join(" ")));
      const hasApprovedPlaybackRights = (item) =>
        item.rightsVerified === true &&
        item.rightsStatus === "APPROVED" &&
        Number.isFinite(Date.parse(item.rightsExpiresAt)) &&
        Date.parse(item.rightsExpiresAt) > Date.now() &&
        item.playbackEnabled === true &&
        item.playbackRightsApproved === true;
      const approvedCount = rows.filter(hasApprovedPlaybackRights).length;
      if (loadingState) loadingState.hidden = true;
      totalResults = Math.max(0, Number(payload.total ?? payload.totalCount) || rows.length);
      pageSize = Math.max(1, Number(payload.limit ?? payload.pageSize) || 30);
      const reportedPageCount = Number(payload.pageCount ?? payload.pagecount ?? payload.totalPages) || 0;
      totalPages = Math.max(reportedPageCount, Math.ceil(totalResults / pageSize));
      currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
      // Keep the provider's page count visible even when this page has no displayable metadata.
      renderPagination(totalPages);
      if (!rows.length) {
        count.textContent = totalResults
          ? totalResults.toLocaleString("vi-VN") + " VIDEO · TRANG " + currentPage.toLocaleString("vi-VN") + " / " + totalPages.toLocaleString("vi-VN")
          : "0 VIDEO";
        const reason = payload.rightsGate?.reason === "provider_pending_approval"
          ? "Các nguồn AppleCMS đang chờ phê duyệt quyền. ClipViet chỉ hiển thị video sau khi nguồn và quyền của từng video được xác minh."
          : rawRows.length
            ? "API có dữ liệu nhưng không có video nào vượt qua kiểm tra quyền, thời hạn giấy phép và xác minh độ tuổi/đồng thuận."
            : payload.rightsGate?.providerApproved === true
              ? "Nguồn đã được duyệt nhưng hiện chưa có video nào có hồ sơ quyền hợp lệ."
              : "Chưa có video được duyệt quyền hiển thị. Danh mục sẽ tự cập nhật khi hồ sơ nguồn và từng video được phê duyệt.";
        showCatalogUnavailable(reason + " · Không thay thế bằng catalog bên thứ ba.");
        setMenuApiStatus("CHƯA CÓ VIDEO ĐỦ ĐIỀU KIỆN QUYỀN HIỂN THỊ", "warning");
        return;
      }
      const pageItems = rows.map((item) => {
        const playbackApproved = hasApprovedPlaybackRights(item);
        return ({
          ...item,
          category: item.categoryName || "Khác",
          genre: item.categoryName || "",
          country: item.area || "",
          apiManaged: true,
          playbackEnabled: playbackApproved,
          playbackRightsApproved: playbackApproved,
          sources: playbackApproved ? (Array.isArray(item.lines) ? item.lines : []).flatMap((line) => (Array.isArray(line.episodes) ? line.episodes : []).map((episode) => ({
            url: episode.url,
            type: /\.m3u8(?:$|\?)/i.test(String(episode.url || "")) ? "hls" : "mp4"
          }))) : [],
          rating: playbackApproved ? "18+" : "Chỉ xem metadata"
        });
      });
      grid.replaceChildren();
      count.textContent = totalResults.toLocaleString("vi-VN") + " VIDEO";
      empty.hidden = pageItems.length > 0;
      setFeaturedVideos(pageItems);
      activeFiltersRoot.replaceChildren();
      if (activeCategoryName) {
        const chip = document.createElement("span");
        chip.className = "active-filter-chip";
        chip.textContent = activeCategoryName;
        activeFiltersRoot.append(chip);
      }
      activeFiltersRoot.hidden = !activeCategoryName;
      for (const video of pageItems) {
        const card = document.createElement("article");
        card.className = "video-card";
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "video-card-open";
        openButton.innerHTML = '<div class="poster"><img loading="lazy" decoding="async" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
        const img = openButton.querySelector("img");
        img.src = video.poster || "./poster-fallback.svg";
        img.alt = video.title || "Video";
        img.addEventListener("error", () => { img.src = "./poster-fallback.svg"; }, { once: true });
        openButton.querySelector(".poster-label").textContent = video.playbackRightsApproved === true ? "18+" : (video.badgeLabel || video.licenseLabel || "CHỈ XEM");
        openButton.querySelector("h3").textContent = video.title || "Video";
        openButton.querySelector(".card-info p").textContent = [video.year, video.area, video.categoryName].filter(Boolean).join(" · ");
        openButton.addEventListener("click", () => openDetail(video));
        card.append(openButton);
        const actions = document.createElement("div");
        actions.className = "video-card-actions";
        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = "video-card-detail";
        detailButton.textContent = "CHI TIẾT";
        detailButton.addEventListener("click", () => openDetail(video));
        actions.append(detailButton);
        const canWatch = video.apiManaged === true && Boolean(video.sourceId && video.id) &&
          video.playbackEnabled === true && video.playbackRightsApproved === true;
        if (canWatch) {
          const watchLink = document.createElement("a");
          watchLink.className = "video-card-watch";
          watchLink.href = "./watch/source.html?sourceId=" + encodeURIComponent(video.sourceId) + "&vodId=" + encodeURIComponent(video.id);
          watchLink.textContent = "XEM ↗";
          watchLink.setAttribute("aria-label", "Xem video " + (video.title || ""));
          actions.append(watchLink);
        }
        card.append(actions);
        grid.append(card);
      }
      setMenuApiStatus(
        approvedCount.toLocaleString("vi-VN") + " video đã duyệt phát · " +
        (rows.length - approvedCount).toLocaleString("vi-VN") + " bản ghi chỉ xem metadata.",
        approvedCount === rows.length ? "success" : "warning"
      );
    })
    .catch((error) => {
      if (sequence !== requestSequence) return;
      if (loadingState) loadingState.hidden = true;
      if (apiErrorState) { apiErrorState.hidden = false; apiErrorState.textContent = "Không thể tải danh mục video: " + error.message + ". Hãy thử tải lại sau."; }
      setMenuApiStatus("API DANH MỤC CHƯA KHẢ DỤNG · " + error.message, "error");
      showCatalogUnavailable("API AppleCMS chưa khả dụng: " + error.message + ". Không thay thế bằng catalog khác.");
    });
}

function renderPagination(totalPages) {
  pagination.replaceChildren();
  if (totalPages < 1) { pagination.hidden = true; return; }
  pagination.hidden = false;
  const summary = document.createElement("span");
  summary.className = "page-summary";
  summary.setAttribute("aria-live", "polite");
  summary.textContent = "Trang " + currentPage.toLocaleString("vi-VN") + " / " + totalPages.toLocaleString("vi-VN") +
    (totalResults ? " · " + totalResults.toLocaleString("vi-VN") + " video" : "");
  pagination.append(summary);

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
    $("#featured-watch").hidden = true;
    if (playButton) playButton.hidden = true;
    $("#featured-open").disabled = true;
    return;
  }
  const video = featuredVideos[featuredIndex % featuredVideos.length];
  const playbackAllowed = video.playbackEnabled === true && video.playbackRightsApproved === true;
  $("#featured-watch").disabled = !playbackAllowed;
  $("#featured-watch").hidden = !playbackAllowed;
  if (playButton) playButton.hidden = !playbackAllowed;
  $("#featured-open").disabled = false;
  image.src = video.poster || "./poster-fallback.svg";
  image.alt = video.title || "Video nổi bật";
  image.onerror = () => { image.src = "./poster-fallback.svg"; };
  $("#featured-title").textContent = video.title || "Video nổi bật";
  $("#featured-meta").textContent = [video.year, video.duration, video.country, video.category, video.licenseLabel].filter(Boolean).join(" · ");
  $("#featured-description").textContent = video.description || "Khám phá video đang được quan tâm trên ClipViet.";
  $("#featured-index").textContent = String(featuredIndex + 1).padStart(2, "0");
  featuredRoot.querySelector(".eyebrow").textContent = "CLIPVIET / MỚI CẬP NHẬT";
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
  if (loadingState) loadingState.hidden = true;
  count.textContent = "0 VIDEO ĐƯỢC DUYỆT QUYỀN";
  empty.hidden = false;
  empty.textContent = message;
  // Catalog metadata remains visible; no demo media is injected without an approved playback grant.
  setFeaturedVideos([]);
  renderPagination(0);
  activeFiltersRoot.replaceChildren();
  activeFiltersRoot.hidden = true;
  const note = document.querySelector(".data-note");
  if (note) note.textContent = message + " · TRÌNH PHÁT MẪU DÙNG PHIM MỞ CÓ GIẤY PHÉP; KHÔNG MỞ KHÓA APPLECMS.";
}

const isHttpUrl = (value) => typeof value === "string" && /^https:\/\//i.test(value);

function setFeaturedVideos(items) {
  if (!featuredRoot) return;
  const blocked = /underage|minor|loli|shota|school\s?(girl|boy|student)|teen\s?(girl|boy)|học sinh|nữ sinh|nam sinh|thiếu nhi/i;
  const safeItems = items.filter((video) => !blocked.test([video.title, video.category, video.description, video.genre].filter(Boolean).join(" ")));
  const playableItems = safeItems.filter((video) => {
    if (video.playbackEnabled !== true || video.playbackRightsApproved !== true) return false;
    const sources = [...(Array.isArray(video.sources) ? video.sources : []), ...(Array.isArray(video.playbackSources) ? video.playbackSources : []), ...(Array.isArray(video.playback_sources) ? video.playback_sources : [])];
    const directUrls = [video.videoUrl, video.video_url, video.hlsUrl, video.hls_url, video.playbackUrl, video.playback_url];
    const hasDirectUrl = directUrls.some((url) => typeof url === "string" && isHttpUrl(url));
    const hasSourceUrl = sources.some((source) => {
      const url = typeof source === "string" ? source : source?.url || source?.src || source?.file || "";
      return typeof url === "string" && isHttpUrl(url);
    });
    return hasDirectUrl || hasSourceUrl;
  });
  featuredVideos = playableItems;
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
  img.src = video.poster || "./poster-fallback.svg";
  img.alt = video.title;
  img.addEventListener("error", () => { img.src = "./poster-fallback.svg"; }, { once: true });
  detail.querySelector(".eyebrow").textContent = video.category || "VIDEO";
  detail.querySelector("h2").textContent = video.title;
  detail.querySelector(".description").textContent = video.description || "";
  detail.querySelector(".meta").textContent = [video.year, video.duration, video.rating, video.country].filter(Boolean).join(" · ");
  detail.querySelector(".detail-source").textContent = video.apiManaged ? "Nguồn: " + (video.sourceName || video.sourceId) + " · " + (video.licenseLabel || "Metadata only") + " · " + (video.sourceUrl || "") : "Nguồn video";
  if (video.apiManaged && video.playbackRightsApproved !== true) {
    detail.querySelector(".detail-source").textContent += " · Chỉ hiển thị metadata; phát bị khóa cho đến khi xác minh quyền phân phối.";
  }
  if (video.apiManaged && video.sourceId && video.id && video.playbackEnabled === true && video.playbackRightsApproved === true) {
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
    if (payload.rightsGate?.providerApproved === false) setMenuApiStatus("Nguồn AppleCMS đang chờ phê duyệt quyền.", "warning");
    else setMenuApiStatus("API danh mục đã kết nối · " + categories.length + " danh mục.", "success");
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

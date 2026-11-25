import { videos as demoVideos } from "./data.js";

const $ = (selector) => document.querySelector(selector);
const grid = $("#video-grid");
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
  grid.replaceChildren();
  count.textContent = items.length + " VIDEO";
  empty.hidden = items.length > 0;
  activeFiltersRoot.replaceChildren();
  [activeCountry, activeGenre].filter(Boolean).forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "active-filter-chip";
    chip.textContent = label;
    activeFiltersRoot.append(chip);
  });
  activeFiltersRoot.hidden = !activeCountry && !activeGenre;
  for (const video of items) {
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

function closeMenu(returnFocus = false) {
  menu.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Mở menu điều hướng");
  if (returnFocus) menuToggle.focus();
}
menuToggle?.addEventListener("click", () => {
  const opening = menu.hidden;
  menu.hidden = !opening;
  menuToggle.setAttribute("aria-expanded", String(opening));
  if (opening) menu.querySelector(".drawer-nav a")?.focus();
});
$("#menu-close")?.addEventListener("click", () => closeMenu(true));
menu?.querySelectorAll(".drawer-nav a").forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("pointerdown", (event) => {
  if (!menu || menu.hidden || menu.contains(event.target) || menuToggle?.contains(event.target)) return;
  closeMenu();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menu && !menu.hidden) closeMenu(true); });
$("#reset-filters")?.addEventListener("click", () => {
  activeCountry = "";
  activeGenre = "";
  countryRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  genreRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  render();
});
$("#close-detail")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
$("#search-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  query = search.value;
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
  history.replaceState({}, "", url);
  render();
});
search?.addEventListener("input", () => { query = search.value; render(); });
$("#sort")?.addEventListener("change", render);

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
      poster: item.poster, country: item.area, apiManaged: true
    }));
    renderCategories(["Tất cả", ...new Set(videos.map((item) => item.category).filter(Boolean))]);
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

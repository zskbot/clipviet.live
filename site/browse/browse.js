const $ = (id) => document.getElementById(id);
const CATALOG_URL = "../data/catalog.json";
let catalog = { videos: [], categories: [], providers: [] };
let page = 1;
let pageCount = 1;
let activeProvider = "";
let categoryId = "";
let keyword = "";
let items = [];
const PAGE_SIZE = 20;

const gate = $("age-gate");
try { if (sessionStorage.getItem("clipviet-age-confirmed") === "yes") gate.hidden = true; } catch {}
$("confirm").addEventListener("click", () => { try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {} gate.hidden = true; });
$("leave").addEventListener("click", () => location.replace("https://www.google.com/"));
$("year").textContent = new Date().getFullYear();

function status(message) { $("source-status").textContent = message; }
function option(label, value) { const node = document.createElement("option"); node.textContent = label; node.value = String(value); return node; }

function populateCategories() {
  const select = $("category");
  const current = select.value;
  select.replaceChildren(option("Tất cả danh mục", ""));
  catalog.categories
    .filter((item) => !activeProvider || item.sourceId === activeProvider)
    .forEach((item) => select.append(option(item.sourceName + " · " + item.name, item.sourceId + ":" + item.id)));
  if ([...select.options].some((item) => item.value === current)) select.value = current;
}

function providerRows() {
  return catalog.providers.map((provider) => provider.name + ": " + provider.state + " (" + provider.count + " video)").join(" · ");
}

function render() {
  const root = $("cards");
  root.replaceChildren();
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "card";
    link.href = "../watch/source.html?sourceId=" + encodeURIComponent(item.sourceId) + "&vodId=" + encodeURIComponent(item.id);
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = item.title;
    image.src = item.poster || "../poster-fallback.svg";
    image.addEventListener("error", () => { image.src = "../poster-fallback.svg"; }, { once: true });
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h2");
    title.textContent = item.title;
    const meta = document.createElement("p");
    meta.textContent = [item.year, item.area, item.categoryName, item.sourceName].filter(Boolean).join(" · ");
    body.append(title, meta);
    link.append(image, body);
    root.append(link);
  }
  $("empty").hidden = items.length > 0;
  $("count").textContent = Number($("count").dataset.total || 0).toLocaleString("vi-VN") + " VIDEO";
  $("page-label").textContent = "Trang " + page + " / " + Math.max(pageCount, 1);
  $("prev").disabled = page <= 1;
  $("next").disabled = page >= pageCount;
}

function loadVideos() {
  const filtered = catalog.videos.filter((item) =>
    (!activeProvider || item.sourceId === activeProvider) &&
    (!categoryId || item.categoryId === categoryId) &&
    (!keyword || [item.title, item.description, item.categoryName, item.actors, item.area].join(" ").toLocaleLowerCase("vi").includes(keyword.toLocaleLowerCase("vi")))
  );
  const total = filtered.length;
  pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(page, pageCount);
  items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $("count").dataset.total = String(total);
  render();
  status("Catalog tĩnh GitHub Pages · " + providerRows() + " · Cập nhật " + new Date(catalog.updatedAt).toLocaleString("vi-VN"));
}

$("filters").addEventListener("submit", (event) => {
  event.preventDefault();
  page = 1;
  const selected = $("category").value;
  if (selected) {
    const [source, ...parts] = selected.split(":");
    activeProvider = source;
    $("source").value = source;
    categoryId = parts.join(":");
  } else {
    categoryId = "";
  }
  keyword = $("keyword").value.trim();
  populateCategories();
  if (selected) $("category").value = selected;
  loadVideos();
});

$("source").addEventListener("change", () => {
  activeProvider = $("source").value;
  categoryId = "";
  $("category").value = "";
  populateCategories();
  page = 1;
  loadVideos();
});

$("category").addEventListener("change", () => {
  const selected = $("category").value;
  if (selected) {
    const [source, ...parts] = selected.split(":");
    activeProvider = source;
    $("source").value = source;
    categoryId = parts.join(":");
    populateCategories();
    $("category").value = selected;
  } else {
    categoryId = "";
  }
  page = 1;
  loadVideos();
});

$("prev").addEventListener("click", () => { if (page > 1) { page -= 1; loadVideos(); } });
$("next").addEventListener("click", () => { if (page < pageCount) { page += 1; loadVideos(); } });

(async () => {
  try {
    const response = await fetch(CATALOG_URL, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("catalog.json HTTP " + response.status);
    catalog = await response.json();
    if (!Array.isArray(catalog.videos) || !Array.isArray(catalog.providers)) throw new Error("Catalog format is invalid");
    populateCategories();
    $("count").dataset.total = String(catalog.videos.length);
    loadVideos();
  } catch (error) {
    status("Không tải được catalog GitHub Pages: " + error.message);
    $("empty").hidden = false;
  }
})();

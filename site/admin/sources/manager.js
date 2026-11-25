const $ = (id) => document.getElementById(id);
const root = $("provider-rows");
const status = $("provider-status");
$("year") && ($("year").textContent = new Date().getFullYear());

function row(provider) {
  const article = document.createElement("article");
  article.className = "item";
  const info = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = provider.name + " · " + String(provider.state || "unknown").toUpperCase();
  const detail = document.createElement("small");
  detail.textContent = [provider.count + " video trong catalog", provider.total + " tổng từ API", provider.categoryCount + " danh mục lá", provider.pagesFetched + "/" + provider.pageCount + " trang đồng bộ", provider.latencyMs + " ms"].join(" · ");
  info.append(title, detail);
  article.append(info);
  return article;
}

(async () => {
  try {
    const response = await fetch("../../data/catalog.json", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const catalog = await response.json();
    root.replaceChildren();
    for (const provider of catalog.providers || []) root.append(row(provider));
    status.textContent = "Cập nhật " + new Date(catalog.updatedAt).toLocaleString("vi-VN") + " · " + (catalog.videos || []).length + " video đã đồng bộ.";
  } catch (error) {
    status.textContent = "Không tải được trạng thái nguồn: " + error.message;
  }
})();

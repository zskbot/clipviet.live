(() => {
  const cards = [...document.querySelectorAll(".community-card")];
  const search = document.querySelector("#community-search");
  const filters = [...document.querySelectorAll("[data-filter]")];
  const count = document.querySelector("#community-count");
  const empty = document.querySelector("#community-no-results");
  let active = "all";
  const apply = () => {
    const q = (search?.value || "").trim().toLocaleLowerCase("vi");
    let visible = 0;
    for (const card of cards) {
      const text = (card.textContent + " " + (card.dataset.search || "")).toLocaleLowerCase("vi");
      const show = (active === "all" || card.dataset.group === active) && (!q || text.includes(q));
      card.hidden = !show;
      if (show) visible++;
    }
    if (count) count.textContent = visible + " / " + cards.length + " CHUYÊN MỤC";
    if (empty) empty.hidden = visible !== 0;
  };
  search?.addEventListener("input", apply);
  filters.forEach(button => button.addEventListener("click", () => {
    active = button.dataset.filter || "all";
    filters.forEach(item => item.classList.toggle("is-active", item === button));
    apply();
  }));
  const urlList = document.querySelector("#source-url-list");
  const addUrlButton = document.querySelector("#add-source-url");
  const urlCount = document.querySelector("#source-url-count");
  const suggestionForm = document.querySelector("#community-suggestion-form");
  const suggestionStatus = document.querySelector("#community-suggestion-status");
  const payloadFallback = document.querySelector("#community-payload-fallback");
  const maxUrls = 20;

  const updateUrlControls = () => {
    const rows = [...(urlList?.querySelectorAll(".source-url-row") || [])];
    if (urlCount) urlCount.textContent = String(rows.length).padStart(2, "0") + " / " + maxUrls;
    if (addUrlButton) addUrlButton.disabled = rows.length >= maxUrls;
    rows.forEach((row, index) => {
      const input = row.querySelector("input");
      const remove = row.querySelector("button");
      if (input) input.setAttribute("aria-label", "URL nguồn HTTPS " + (index + 1));
      if (remove) remove.disabled = rows.length === 1;
    });
  };

  const addUrlRow = (value = "") => {
    if (!urlList || urlList.querySelectorAll(".source-url-row").length >= maxUrls) return;
    const row = document.createElement("div");
    row.className = "source-url-row";
    const input = document.createElement("input");
    input.type = "url";
    input.name = "sourceUrls[]";
    input.inputMode = "url";
    input.placeholder = "https://example.com/video";
    input.required = true;
    input.value = value;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-source-url";
    remove.setAttribute("aria-label", "Xóa URL nguồn");
    remove.textContent = "×";
    remove.addEventListener("click", () => { row.remove(); updateUrlControls(); });
    row.append(input, remove);
    urlList.append(row);
    updateUrlControls();
    input.focus();
  };

  addUrlButton?.addEventListener("click", () => addUrlRow());
  urlList?.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-source-url");
    if (!remove) return;
    const rows = [...urlList.querySelectorAll(".source-url-row")];
    if (rows.length > 1) { remove.closest(".source-url-row").remove(); updateUrlControls(); }
  });

  suggestionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.querySelector("#community-suggest-title")?.value.trim() || "";
    const reason = document.querySelector("#community-suggest-reason")?.value.trim() || "";
    const rawUrls = [...(urlList?.querySelectorAll('input[name="sourceUrls[]"]') || [])].map(input => input.value.trim());
    const parsed = rawUrls.map(raw => {
      try { return new URL(raw); } catch { return null; }
    });
    const valid = rawUrls.length > 0 && rawUrls.length <= maxUrls &&
      rawUrls.every(Boolean) &&
      parsed.every(url => url && url.protocol === "https:" && url.hostname && !url.username && !url.password);
    if (!title || !valid) {
      if (suggestionStatus) {
        suggestionStatus.textContent = "Vui lòng nhập tiêu đề và kiểm tra tất cả URL. Chỉ chấp nhận địa chỉ HTTPS hợp lệ, không chứa thông tin đăng nhập.";
        suggestionStatus.dataset.state = "error";
      }
      return;
    }
    const normalized = parsed.map(url => url.href);
    if (new Set(normalized).size !== normalized.length) {
      suggestionStatus.textContent = "Có URL bị trùng. Hãy xóa địa chỉ trùng trước khi tiếp tục.";
      suggestionStatus.dataset.state = "error";
      return;
    }
    const payload = [
      "ĐỀ XUẤT NGUỒN CLIPVIET COMMUNITY",
      "Tiêu đề: " + title,
      "URL nguồn HTTPS (" + normalized.length + "):",
      ...normalized.map((url, index) => (index + 1) + ". " + url),
      "Ghi chú / giấy phép: " + (reason || "Chưa cung cấp"),
      "Kiểm duyệt: Chờ xác minh nguồn gốc, sự đồng thuận và quyền phân phối hợp pháp."
    ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      suggestionStatus.textContent = "Đã sao chép " + normalized.length + " URL. Chưa gửi hoặc lưu lên máy chủ; cần chuyển nội dung đến kênh tiếp nhận chính thức.";
      suggestionStatus.dataset.state = "success";
      if (payloadFallback) payloadFallback.hidden = true;
    } catch {
      if (payloadFallback) { payloadFallback.value = payload; payloadFallback.hidden = false; }
      suggestionStatus.textContent = "Không thể truy cập clipboard. Nội dung đề xuất đã hiển thị bên dưới để bạn sao chép thủ công.";
      suggestionStatus.dataset.state = "error";
    }
  });
  updateUrlControls();

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
  apply();
})();
import {
  ADULT_EMBED_API,
  adultEmbedRequest,
  buildAdultEmbedSearchUrl,
  normalizeAdultEmbedSearch
} from "./adultembed-adapter.mjs";

const root = document.querySelector("#adultembed-preview");
if (root) {
  const $ = selector => root.querySelector(selector);
  const logs = [];
  let videos = [];

  function log(action, detail, state = "info") {
    const entry = { at: new Date().toISOString(), action, detail: String(detail || "").slice(0, 240), state };
    logs.unshift(entry);
    logs.splice(30);
    try { sessionStorage.setItem("clipviet.adultembed.preview.logs", JSON.stringify(logs)); } catch {}
    renderLogs();
  }
  function node(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }
  function renderLogs() {
    const list = $("#adultembed-logs");
    list.replaceChildren();
    if (!logs.length) list.append(node("p", "Chưa có sự kiện trong phiên này.", "empty"));
    for (const entry of logs) {
      const row = node("li", "");
      row.append(node("time", new Date(entry.at).toLocaleTimeString("vi-VN")));
      row.append(node("strong", entry.action));
      row.append(node("span", entry.detail + " · " + entry.state));
      list.append(row);
    }
  }
  function renderVideos() {
    const list = $("#adultembed-results");
    list.replaceChildren();
    $("#adultembed-count").textContent = videos.length + " VIDEO";
    if (!videos.length) {
      list.append(node("p", "Không có kết quả phù hợp.", "empty"));
      return;
    }
    for (const video of videos) {
      const card = node("article", "");
      card.className = "ae-video";
      const info = node("div", "");
      info.append(node("h3", video.title));
      info.append(node("p", "ID " + video.id + " · " + (video.duration || "Chưa rõ thời lượng")));
      info.append(node("p", "Danh mục: " + (video.categories.join(", ") || "—")));
      info.append(node("p", "Tags: " + (video.tags.join(", ") || "—")));
      info.append(node("p", "Thumbnail: " + (video.thumbnail ? new URL(video.thumbnail).hostname : "không có")));
      info.append(node("p", "Embed: " + (video.embedUrl ? new URL(video.embedUrl).hostname : "không có / host chưa được tin cậy")));
      const status = node("span", "CHƯA KIỂM TRA", "ae-state");
      status.dataset.videoStatus = video.id;
      const button = node("button", "KIỂM TRA PLAYER");
      button.type = "button";
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "ĐANG KIỂM TRA";
        try {
          const result = await adultEmbedRequest("/videos/" + encodeURIComponent(video.id) + "/status");
          if (result.id !== Number(video.id) || typeof result.active !== "boolean") throw new Error("Player status schema không hợp lệ.");
          status.textContent = result.active ? "ACTIVE · PLAYABLE" : "INACTIVE";
          log("PLAYER_STATUS", "Video " + video.id + " active=" + result.active, result.active ? "pass" : "warn");
        } catch (error) {
          status.textContent = "ERROR";
          log("PLAYER_STATUS", "Video " + video.id + ": " + error.message, "fail");
        } finally { button.disabled = false; }
      });
      const jsonButton = node("button", "XEM JSON");
      jsonButton.type = "button";
      jsonButton.addEventListener("click", () => {
        $("#adultembed-json").textContent = JSON.stringify(video, null, 2);
      });
      const actions = node("div", "");
      actions.className = "ae-actions";
      actions.append(button, jsonButton, status);
      info.append(actions);
      card.append(info);
      list.append(card);
    }
  }

  $("#adultembed-api-url").textContent = ADULT_EMBED_API;
  $("#adultembed-api-check").addEventListener("click", async () => {
    const button = $("#adultembed-api-check");
    button.disabled = true;
    $("#adultembed-api-status").textContent = "Đang kiểm tra endpoint /search…";
    try {
      const payload = await adultEmbedRequest("/search?orientation=all&quality=complete&per_page=1&page=1");
      const normalized = normalizeAdultEmbedSearch(payload);
      $("#adultembed-api-status").textContent = "API OK · schema hợp lệ · " + normalized.total + " mục được báo cáo.";
      $("#adultembed-json").textContent = JSON.stringify(payload, null, 2);
      log("API_CHECK", "GET /search · " + normalized.results.length + " mẫu", "pass");
    } catch (error) {
      $("#adultembed-api-status").textContent = "API CHECK FAILED · " + error.message;
      log("API_CHECK", error.message, "fail");
    } finally { button.disabled = false; }
  });

  $("#adultembed-search-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#adultembed-search");
    button.disabled = true;
    $("#adultembed-search-status").textContent = "Đang truy vấn API…";
    try {
      const url = new URL(buildAdultEmbedSearchUrl($("#adultembed-query").value, 1, 12));
      const path = "/search" + url.search;
      const payload = await adultEmbedRequest(path);
      const normalized = normalizeAdultEmbedSearch(payload);
      videos = normalized.results;
      renderVideos();
      $("#adultembed-search-status").textContent = "Tìm thấy " + normalized.total + " kết quả · hiển thị " + videos.length + ".";
      $("#adultembed-json").textContent = JSON.stringify(payload, null, 2);
      log("SEARCH", "query=" + ($("#adultembed-query").value.trim() || "(trống)") + " · " + videos.length + " items", "pass");
    } catch (error) {
      videos = [];
      renderVideos();
      $("#adultembed-search-status").textContent = "SEARCH FAILED · " + error.message;
      log("SEARCH", error.message, "fail");
    } finally { button.disabled = false; }
  });

  $("#adultembed-clear-logs").addEventListener("click", () => {
    logs.length = 0;
    try { sessionStorage.removeItem("clipviet.adultembed.preview.logs"); } catch {}
    renderLogs();
  });

  renderLogs();
  log("REGISTRY", "AdultEmbed được khai báo PENDING; chưa có quyền phân phối được xác minh.", "warn");
}

const ADMIN_API = "";
const ADMIN_SESSION_KEY = "clipviet.admin.session.v1";
let adminToken = "";
try { adminToken = sessionStorage.getItem(ADMIN_SESSION_KEY) || ""; } catch { /* storage may be unavailable */ }
async function adminRequest(path, options = {}) {
  const response = await fetch(ADMIN_API + path, {
    credentials: "omit",
    ...options,
    headers: { "content-type": "application/json", ...(adminToken ? { authorization: "Bearer " + adminToken } : {}), ...(options.headers || {}) },
    cache: "no-store",
    redirect: "error"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Yêu cầu quản trị không thành công.");
  return data;
}
window.clipvietAdminRequest = adminRequest;
function setAdminAccess(allowed, message) {
  document.querySelectorAll("[data-admin-protected]").forEach(node => {
    node.inert = !allowed;
    if (allowed) {
      node.removeAttribute("aria-disabled");
      node.classList.remove("admin-locked");
    } else {
      node.setAttribute("aria-disabled", "true");
      node.classList.add("admin-locked");
    }
  });
  window.dispatchEvent(new CustomEvent("clipviet-admin-auth", { detail: { allowed, message } }));
}
const $ = (selector) => document.querySelector(selector);
const loginGate = $("#admin-login-gate");
const loginForm = $("#admin-login-form");
const loginStatus = $("#admin-login-status");
const logoutButton = $("#admin-logout");
function showLogin(message = "Đăng nhập để mở khu vực quản trị.") {
  setAdminAccess(false, message);
  if (loginGate) loginGate.hidden = false;
  if (loginStatus) loginStatus.textContent = message;
}
function showAdmin() {
  setAdminAccess(true, "Phiên Admin đã được máy chủ xác nhận.");
  if (loginGate) loginGate.hidden = true;
}
async function verifyAdminSession() {
  if (!adminToken) { showLogin(); return false; }
  try {
    await adminRequest("/api/admin/session");
    showAdmin();
    return true;
  } catch {
    adminToken = "";
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* storage may be unavailable */ }
    showLogin("Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
    return false;
  }
}
if (loginForm) loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const pin = String(new FormData(loginForm).get("pin") || "");
  if (!/^\d{6}$/.test(pin)) { if (loginStatus) loginStatus.textContent = "PIN phải gồm đúng 6 chữ số."; return; }
  const submit = loginForm.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (loginStatus) loginStatus.textContent = "Đang xác thực với máy chủ…";
  try {
    const response = await fetch(ADMIN_API + "/api/admin/login", {
      method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ pin })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.token !== "string" || !data.token) throw new Error(data.error || "Đăng nhập không thành công.");
    adminToken = data.token;
    try { sessionStorage.setItem(ADMIN_SESSION_KEY, adminToken); } catch { throw new Error("Không thể lưu phiên an toàn trong sessionStorage."); }
    loginForm.reset();
    await verifyAdminSession();
  } catch (error) {
    adminToken = "";
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* storage may be unavailable */ }
    showLogin(error.message || "Đăng nhập không thành công.");
  } finally { if (submit) submit.disabled = false; }
});
if (logoutButton) logoutButton.addEventListener("click", async () => {
  try { if (adminToken) await adminRequest("/api/admin/logout", { method: "POST" }); } catch { /* always clear local session */ }
  adminToken = "";
  try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* storage may be unavailable */ }
  showLogin("Đã đăng xuất.");
});
window.clipvietVerifyAdminSession = verifyAdminSession;
window.addEventListener("clipviet-admin-gesture", () => { void verifyAdminSession(); });
void verifyAdminSession();
const apiForm = $("#api-form");
const apiUrl = $("#api-url");
const apiToken = $("#api-token");
const apiAllowedHosts = $("#api-allowed-hosts");
const mediaAllowedHosts = $("#media-allowed-hosts");
const apiStatus = $("#api-status");
const list = $("#video-list");
const count = $("#video-count");
const player = $("#player");
const playerTitle = $("#player-title");
const playerState = $("#player-state");
const playerMessage = $("#player-message");
let apiTokenValue = "";
let savedUrl = "";
try { savedUrl = localStorage.getItem("clipviet.admin.apiUrl") || ""; } catch { /* storage may be unavailable */ }
apiUrl.value = savedUrl;
try {
  apiAllowedHosts.value = localStorage.getItem("clipviet.admin.apiAllowedHosts") || "";
  mediaAllowedHosts.value = localStorage.getItem("clipviet.admin.mediaAllowedHosts") || "";
} catch { /* storage may be unavailable */ }

function parseAllowedHosts(input) {
  return new Set(String(input || "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean));
}

function safeHttpsUrl(value, allowedHosts = null, label = "URL") {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL không hợp lệ."); }
  if (url.protocol !== "https:") throw new Error("Chỉ chấp nhận URL HTTPS.");
  if (url.username || url.password) throw new Error("Không nhúng thông tin đăng nhập trong URL.");
  const host = url.hostname.toLowerCase();
  if (allowedHosts && !allowedHosts.has(host)) throw new Error(label + ": host chưa nằm trong allowlist.");
  if (host.includes(":") || /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(host)) throw new Error("Chỉ cho phép hostname, không dùng IP literal.");
  if (url.port) throw new Error("Không cho phép cổng tùy chỉnh.");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid") ||
      host.endsWith(".example")) {
    throw new Error("Không cho phép hostname nội bộ hoặc hostname dành riêng.");
  }
  return url.href;
}

function normalizeVideos(payload) {
  let rows = Array.isArray(payload) ? payload :
    payload && Array.isArray(payload.results) ? payload.results :
    payload && Array.isArray(payload.videos) ? payload.videos :
    payload && Array.isArray(payload.data) ? payload.data : null;
  if (!rows) throw new Error("API phải trả về JSON array hoặc object có results, videos hay data dạng array.");
  return rows.map((item, index) => ({
    id: String(item.id ?? item.video_id ?? item.slug ?? index + 1),
    title: String(item.title ?? item.name ?? "Video " + (index + 1)),
    poster: item.poster ?? item.thumbnail_url ?? item.thumbnail ?? "",
    media: item.videoUrl ?? item.video_url ?? item.url ?? item.src ?? "",
    category: item.category ?? item.genre ?? "Chưa phân loại",
    description: item.description ?? ""
  }));
}

function textElement(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function mediaCapability(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".m3u8")) {
    const supported = player.canPlayType("application/vnd.apple.mpegurl") ||
      player.canPlayType("application/x-mpegURL");
    return { format: "HLS", supported: Boolean(supported), detail: supported
      ? "Safari native HLS khả dụng."
      : "Trình duyệt không báo hỗ trợ native HLS; Admin player chưa nạp HLS.js." };
  }
  if (pathname.endsWith(".webm")) {
    const vp9 = player.canPlayType('video/webm; codecs="vp9,opus"');
    const generic = player.canPlayType("video/webm");
    return { format: "WebM", supported: Boolean(vp9 || generic), detail: (vp9 || generic)
      ? "Trình duyệt báo hỗ trợ WebM; codec thực tế còn phụ thuộc file."
      : "Trình duyệt không báo hỗ trợ WebM." };
  }
  if (pathname.endsWith(".mp4")) {
    const supported = player.canPlayType('video/mp4; codecs="avc1.42E01E,mp4a.40.2"') ||
      player.canPlayType("video/mp4");
    return { format: "MP4", supported: Boolean(supported), detail: supported
      ? "Trình duyệt báo hỗ trợ MP4; codec thực tế còn phụ thuộc file."
      : "Trình duyệt không báo hỗ trợ MP4." };
  }
  return { format: "MEDIA", supported: true, detail: "Định dạng chưa nhận diện theo phần mở rộng; kiểm tra MIME từ máy chủ." };
}

function playMedia(rawUrl, title) {
  let mediaUrl;
  try { mediaUrl = safeHttpsUrl(rawUrl, parseAllowedHosts(mediaAllowedHosts.value), "Media URL"); }
  catch (error) { playerMessage.textContent = error.message; playerState.textContent = "INVALID URL"; return; }
  const capability = mediaCapability(mediaUrl);
  player.pause();
  player.removeAttribute("src");
  player.load();
  player.src = mediaUrl;
  playerTitle.textContent = title || "Video URL";
  playerState.textContent = capability.supported ? "READY · " + capability.format : "CHECK · " + capability.format;
  playerMessage.textContent = capability.detail + " Đang tải metadata; nếu không phát được, kiểm tra MIME, codec, CORS và quyền truy cập media.";
  player.load();
  player.play().then(() => {
    playerState.textContent = "PLAYING · " + capability.format;
  }).catch((error) => {
    playerState.textContent = "READY · " + capability.format;
    playerMessage.textContent = error?.name === "NotAllowedError"
      ? capability.detail + " Safari yêu cầu chạm nút Play trên thanh điều khiển."
      : capability.detail + " Không tự phát được; hãy nhấn Play và kiểm tra lỗi media nếu vẫn thất bại.";
  });
}

function renderVideos(videos) {
  list.replaceChildren();
  count.textContent = videos.length + " VIDEO";
  if (!videos.length) {
    list.append(textElement("p", "API kết nối thành công nhưng chưa có video.", "empty"));
    return;
  }
  for (const video of videos) {
    const row = document.createElement("article");
    row.className = "video-row";
    if (video.poster) {
      try {
        const posterUrl = safeHttpsUrl(video.poster);
        const img = document.createElement("img");
        img.src = posterUrl; img.alt = ""; img.loading = "lazy";
        row.append(img);
      } catch { row.append(textElement("div", "CV", "poster-fallback")); }
    } else row.append(textElement("div", "CV", "poster-fallback"));
    const meta = document.createElement("div");
    meta.className = "video-meta";
    meta.append(textElement("h3", video.title), textElement("p", video.category));
    const action = document.createElement("button");
    action.type = "button"; action.className = "secondary"; action.textContent = "PHÁT THỬ";
    action.disabled = !video.media;
    action.addEventListener("click", () => playMedia(video.media, video.title));
    meta.append(action);
    row.append(meta);
    if (!video.media) row.append(textElement("span", "THIẾU MEDIA URL", "missing"));
    list.append(row);
  }
}

apiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  let endpoint;
  try {
    const apiHosts = parseAllowedHosts(apiAllowedHosts.value);
    if (!apiHosts.size) throw new Error("Cần khai báo VIDEO API host trong allowlist.");
    endpoint = safeHttpsUrl(apiUrl.value.trim(), apiHosts, "API endpoint");
    try {
      localStorage.setItem("clipviet.admin.apiAllowedHosts", apiAllowedHosts.value);
      localStorage.setItem("clipviet.admin.mediaAllowedHosts", mediaAllowedHosts.value);
    } catch { /* local persistence is optional */ }
  }
  catch (error) { apiStatus.textContent = error.message; apiStatus.dataset.state = "error"; return; }
  apiStatus.textContent = "Đang kết nối…";
  apiStatus.dataset.state = "loading";
  const token = apiToken.value.trim();
  try { localStorage.setItem("clipviet.admin.apiUrl", endpoint); } catch { /* storage may be unavailable */ }
  apiTokenValue = token;
  try {
    const headers = { Accept: "application/json" };
    if (apiTokenValue) headers.Authorization = "Bearer " + apiTokenValue;
    const response = await fetch(endpoint, { headers, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("API trả về HTTP " + response.status + ".");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("Endpoint không trả về JSON.");
    const videos = normalizeVideos(await response.json());
    renderVideos(videos);
    apiStatus.textContent = "Kết nối thành công · " + videos.length + " video.";
    apiStatus.dataset.state = "success";
  } catch (error) {
    apiStatus.textContent = error.name === "TimeoutError" ? "API quá thời gian chờ 15 giây." : "Không thể tải API: " + error.message + " Kiểm tra CORS, HTTPS và cấu trúc JSON.";
    apiStatus.dataset.state = "error";
    list.replaceChildren(textElement("p", "Chưa tải được danh sách video.", "empty"));
    count.textContent = "0 VIDEO";
  }
});

$("#clear-api").addEventListener("click", () => {
  try { localStorage.removeItem("clipviet.admin.apiUrl"); localStorage.removeItem("clipviet.admin.apiAllowedHosts"); localStorage.removeItem("clipviet.admin.mediaAllowedHosts"); } catch { /* storage may be unavailable */ }
  apiTokenValue = "";
  apiUrl.value = ""; apiToken.value = ""; apiAllowedHosts.value = ""; mediaAllowedHosts.value = "";
  apiStatus.textContent = "Đã xóa cấu hình trên thiết bị này.";
  apiStatus.dataset.state = "";
  list.replaceChildren(textElement("p", "Kết nối API JSON để tải danh sách video.", "empty"));
  count.textContent = "0 VIDEO";
});

$("#direct-form").addEventListener("submit", (event) => {
  event.preventDefault();
  playMedia($("#direct-url").value.trim(), "Phát trực tiếp bằng URL");
});

player.addEventListener("playing", () => { playerState.textContent = "PLAYING"; });
player.addEventListener("pause", () => { if (!player.ended && player.currentTime > 0) playerState.textContent = "PAUSED"; });
player.addEventListener("error", () => {
  playerState.textContent = "ERROR";
  playerMessage.textContent = "Trình duyệt không phát được URL này. Kiểm tra định dạng MP4/WebM/HLS, MIME type, CORS và quyền truy cập.";
});


// Independent provider validation: this only tests a supplied endpoint; it never activates a provider.
const providerForm = $("#provider-form");
const providerResult = $("#provider-result");
const providerReset = $("#provider-reset");

function providerUrl(value, hosts, label) {
  const normalized = safeHttpsUrl(value, hosts, label);
  const parsed = new URL(normalized);
  if (/[?&](?:token|api[_-]?key|password|secret|auth)=/i.test(parsed.search)) {
    throw new Error(label + ": không đặt credential trong query string; dùng Bearer token.");
  }
  return parsed.href;
}

async function readJsonLimited(response, maxBytes = 1024 * 1024) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("API response vượt giới hạn 1 MB.");
  if (!response.body) throw new Error("API không trả về response body.");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("API response vượt giới hạn 1 MB.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function addProviderCheck(lines, label, state, detail) {
  lines.push({ label, state, detail });
}

async function probeProviderMedia(rawUrl, hosts) {
  const url = providerUrl(rawUrl, hosts, "Media URL");
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-0", Accept: "video/*,application/vnd.apple.mpegurl,application/x-mpegURL" },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const acceptedType = type.startsWith("video/") ||
    type === "application/vnd.apple.mpegurl" ||
    type === "application/x-mpegurl";
  const rangeOk = response.status === 206;
  if (response.body) await response.body.cancel().catch(() => {});
  if (!rangeOk) throw new Error("Media không xác nhận byte-range (HTTP " + response.status + ").");
  if (!acceptedType) throw new Error("MIME không phải media được hỗ trợ (" + (type || "không có") + ").");
  return { status: response.status, type: type || "unknown" };
}

function renderProviderResult(title, checks, overall) {
  providerResult.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  heading.dataset.state = overall;
  providerResult.append(heading);
  const listNode = document.createElement("ul");
  for (const check of checks) {
    const item = document.createElement("li");
    const mark = document.createElement("span");
    mark.className = "check-mark " + check.state;
    mark.textContent = check.state === "pass" ? "PASS" : check.state === "warn" ? "WARN" : "FAIL";
    const description = document.createElement("span");
    description.textContent = check.label + " — " + check.detail;
    item.append(mark, description);
    listNode.append(item);
  }
  providerResult.append(listNode);
  const note = document.createElement("p");
  note.textContent = overall === "success"
    ? "Kiểm tra kỹ thuật đạt các bước đã chạy. Provider vẫn TẮT; cần duyệt quyền nội dung và cấu hình backend trước khi kích hoạt."
    : "Không đạt điều kiện kiểm tra. Provider vẫn TẮT và không được đưa vào danh sách phát.";
  providerResult.append(note);
}

providerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const checks = [];
  const button = providerForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "ĐANG KIỂM TRA…";
  try {
    const name = $("#provider-name").value.trim();
    if (!name) throw new Error("Thiếu tên provider.");
    if (!$("#provider-rights").checked) throw new Error("Cần xác nhận quyền sử dụng, độ tuổi và sự đồng thuận trước khi kiểm tra.");
    const apiHosts = parseAllowedHosts($("#provider-api-hosts").value);
    const mediaHosts = parseAllowedHosts($("#provider-media-hosts").value);
    const posterHosts = parseAllowedHosts($("#provider-poster-hosts").value);
    if (!apiHosts.size || !mediaHosts.size) throw new Error("Cần khai báo API hostname và media hostname allowlist.");
    const endpoint = providerUrl($("#provider-url").value.trim(), apiHosts, "API endpoint");
    addProviderCheck(checks, "HTTPS + exact API hostname", "pass", new URL(endpoint).hostname);
    addProviderCheck(checks, "Rights attestation", "pass", "Người vận hành đã xác nhận; đây không phải xác minh pháp lý độc lập.");

    const headers = { Accept: "application/json" };
    const token = $("#provider-token").value.trim();
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error("Provider API trả HTTP " + response.status + ".");
    const contentType = response.headers.get("content-type") || "";
    if (!/\bjson\b/i.test(contentType)) throw new Error("Provider endpoint không trả Content-Type JSON.");
    addProviderCheck(checks, "API response", "pass", "HTTP " + response.status + " · " + contentType);
    const payload = await readJsonLimited(response);
    const videos = normalizeVideos(payload);
    if (videos.length > 100) throw new Error("API trả quá 100 bản ghi; giới hạn kiểm tra là 100.");
    if (!videos.length) addProviderCheck(checks, "JSON schema", "warn", "JSON hợp lệ nhưng chưa có video.");
    else addProviderCheck(checks, "JSON schema", "pass", videos.length + " video record.");

    let posterCount = 0;
    for (const video of videos) {
      if (video.media) providerUrl(video.media, mediaHosts, "Media URL");
      if (video.poster) {
        if (!posterHosts.size) throw new Error("Có thumbnail nhưng chưa khai báo thumbnail hostname allowlist.");
        providerUrl(video.poster, posterHosts, "Thumbnail URL");
        posterCount++;
      }
    }
    addProviderCheck(checks, "Media hostname allowlist", "pass", "Tất cả media URL có trong response khớp exact host.");
    addProviderCheck(checks, "Thumbnail hostname allowlist", "pass", posterCount + " thumbnail URL đã kiểm tra.");

    const mediaSamples = videos.filter(video => video.media).slice(0, 3);
    if (!mediaSamples.length) {
      addProviderCheck(checks, "Media probe", "fail", "Không có media URL trong JSON.");
    } else {
      let mediaPassed = 0;
      for (let index = 0; index < mediaSamples.length; index++) {
        try {
          const result = await probeProviderMedia(mediaSamples[index].media, mediaHosts);
          mediaPassed++;
          addProviderCheck(checks, "Media probe " + (index + 1), "pass", "HTTP 206 · " + result.type);
        } catch (error) {
          addProviderCheck(checks, "Media probe " + (index + 1), "fail", error.message);
        }
      }
      if (mediaPassed !== mediaSamples.length) throw new Error("Một hoặc nhiều media probe không đạt.");
    }
    renderProviderResult("KIỂM TRA KỸ THUẬT ĐẠT", checks, "success");
  } catch (error) {
    addProviderCheck(checks, "Validation", "fail", error.name === "TimeoutError" ? "Quá thời gian chờ." : error.message);
    renderProviderResult("KIỂM TRA KHÔNG ĐẠT", checks, "error");
  } finally {
    $("#provider-token").value = "";
    button.disabled = false;
    button.textContent = "CHẠY KIỂM TRA AN TOÀN";
  }
});

providerReset.addEventListener("click", () => {
  providerForm.reset();
  providerResult.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = "CHƯA KIỂM TRA";
  const message = document.createElement("p");
  message.textContent = "Provider chưa được xác minh. Không có nguồn nào được kích hoạt.";
  providerResult.append(heading, message);
});

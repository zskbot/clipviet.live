const params = new URLSearchParams(location.search);
const sourceId = params.get("sourceId");
const vodId = params.get("vodId");
const $ = (id) => document.getElementById(id);
const video = $("video");
const status = $("status");
let data = null;
let lineIndex = 0;
let episodeIndex = 0;
let hls = null;
let watchdog = null;

function say(message) { status.textContent = message; }
function destroy() {
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.onerror = null;
  video.onloadeddata = null;
  video.onplaying = null;
}
function currentEpisode() { return data?.lines?.[lineIndex]?.episodes?.[episodeIndex] || null; }
function renderLines() {
  const select = $("line");
  select.replaceChildren();
  data.lines.forEach((line, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = line.name;
    select.append(option);
  });
  select.value = String(lineIndex);
  $("switch").hidden = data.lines.length < 2;
}
function renderEpisodes() {
  const root = $("episodes");
  root.replaceChildren();
  (data.lines[lineIndex]?.episodes || []).forEach((episode, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = episode.name;
    button.setAttribute("aria-pressed", String(index === episodeIndex));
    button.addEventListener("click", () => { episodeIndex = index; renderEpisodes(); play(); });
    root.append(button);
  });
}
function failed(message) {
  say(message + " Hãy thử đổi đường phát hoặc chọn tập khác.");
  const episode = currentEpisode();
  if (episode) { $("external").hidden = false; $("external").href = episode.url; }
}
function play() {
  const episode = currentEpisode();
  if (!episode) { failed("Không có URL phát hợp lệ."); return; }
  destroy();
  $("external").hidden = false;
  $("external").href = episode.url;
  say("Đang tải video trực tiếp từ CDN nguồn…");
  const isSafari = /Safari/i.test(navigator.userAgent) && !/(Chrome|CriOS|Edg|OPR|Firefox)/i.test(navigator.userAgent);
  const useHlsJs = !isSafari && window.Hls && window.Hls.isSupported();
  let ready = false;
  const markReady = () => {
    if (ready) return;
    ready = true;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    say("Đã nhận dữ liệu video. Nhấn Play để phát.");
  };
  watchdog = setTimeout(() => {
    if (video.readyState < 2 || video.videoWidth === 0) failed("Quá 15 giây chưa nhận được khung hình.");
  }, 15000);
  video.onloadeddata = markReady;
  video.onplaying = markReady;
  video.onerror = () => failed("Trình duyệt không tải được video hoặc segment.");
  if (useHlsJs && episode.type === "hls") {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false, manifestLoadingTimeOut: 15000, fragLoadingTimeOut: 15000 });
    hls.loadSource(episode.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => say("Manifest HLS đã tải. Đang chờ dữ liệu video…"));
    hls.on(Hls.Events.ERROR, (_event, detail) => { if (detail.fatal) failed("HLS lỗi: " + detail.details + "."); });
  } else {
    video.src = episode.url;
    video.load();
  }
}
$("line").addEventListener("change", () => { lineIndex = Number($("line").value) || 0; episodeIndex = 0; renderEpisodes(); play(); });
$("switch").addEventListener("click", () => { lineIndex = (lineIndex + 1) % data.lines.length; episodeIndex = 0; renderLines(); renderEpisodes(); play(); });

(async () => {
  if (!sourceId || !vodId) { say("Thiếu sourceId hoặc vodId."); return; }
  try {
    const response = await fetch("../data/catalog.json", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Không tải được catalog GitHub Pages.");
    const catalog = await response.json();
    data = catalog.videos.find((item) => item.sourceId === sourceId && item.id === vodId);
    if (!data) throw new Error("Video không còn trong catalog hiện tại. Hãy quay lại thư viện.");
    if (!Array.isArray(data.lines) || !data.lines.length) throw new Error("Nguồn không cung cấp đường phát trực tiếp.");
    $("title").textContent = data.title;
    $("meta").textContent = [data.sourceName, data.year, data.area, data.categoryName, data.duration].filter(Boolean).join(" · ");
    $("description").textContent = data.description || "";
    renderLines();
    renderEpisodes();
    play();
  } catch (error) {
    $("title").textContent = "Không tải được video";
    say(error.message);
  }
})();
window.addEventListener("pagehide", destroy);

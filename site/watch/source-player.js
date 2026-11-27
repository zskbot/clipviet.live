const params = new URLSearchParams(location.search);
const sourceId = params.get("sourceId");
const vodId = params.get("vodId");
const $ = (id) => document.getElementById(id);
const video = $("video");
const tapPlay = $("tap-play");
const status = $("status");
const title = $("title");
const qualitySelect = $("quality");
const resolutionLabel = $("resolution");
let data = null;
let lineIndex = 0;
let episodeIndex = 0;
let hls = null;
let watchdog = null;
let selectedQuality = "auto";
// Only offer manual resolution levels advertised by the active HLS manifest.
const imageDefaults = { brightness: 100, contrast: 100, saturation: 100 };
const imageSettings = { ...imageDefaults };

function say(message) { status.textContent = message; }
function showPlayButton(label = "▶ PHÁT VIDEO") { tapPlay.hidden = false; tapPlay.disabled = false; tapPlay.textContent = label; }
function hidePlayButton() { tapPlay.hidden = true; tapPlay.disabled = true; }
async function startPlaybackFromGesture() {
  // Keep play() directly inside the trusted click handler for iOS Safari user-activation policy.
  try {
    if (!video.currentSrc && !video.src) { say("Video chưa có đường dẫn phát."); return; }
    const result = video.play();
    if (result && typeof result.then === "function") await result;
    say("Đang yêu cầu Safari phát video…");
  } catch (error) {
    showPlayButton("▶ THỬ PHÁT LẠI");
    say("Safari chưa phát được video: " + (error?.message || error?.name || "Playback failed") + ". Kiểm tra đường phát hoặc thử đường khác.");
  }
}
tapPlay.addEventListener("click", startPlaybackFromGesture);
function setResolution(width, height) {
  resolutionLabel.textContent = width && height ? "ĐỘ PHÂN GIẢI: " + width + "×" + height : "ĐỘ PHÂN GIẢI: ĐANG NHẬN…";
}
function setImageFilter() {
  video.style.filter = `brightness(${imageSettings.brightness}%) contrast(${imageSettings.contrast}%) saturate(${imageSettings.saturation}%)`;
  for (const key of Object.keys(imageDefaults)) {
    const input = $(key);
    const output = $(key + "-value");
    if (input) input.value = String(imageSettings[key]);
    if (output) output.value = imageSettings[key] + "%";
  }
}
function setSettings(open) {
  $("player-settings").hidden = !open;
  $("settings-toggle").setAttribute("aria-expanded", String(open));
}
function resetQuality(label = "Tự động") {
  qualitySelect.replaceChildren();
  const option = document.createElement("option");
  option.value = "auto";
  option.textContent = label;
  qualitySelect.append(option);
  qualitySelect.value = "auto";
  qualitySelect.disabled = true;
}
function renderQualityLevels(levels) {
  qualitySelect.replaceChildren();
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "Tự động · Adaptive";
  qualitySelect.append(auto);
  const sorted = levels.map((level, index) => ({ ...level, index }))
    .filter((item) => Number(item.height) > 0)
    .sort((a, b) => a.height - b.height || b.bitrate - a.bitrate);
  const heights = new Set();
  for (const item of sorted) {
    if (heights.has(item.height)) continue;
    heights.add(item.height);
    const option = document.createElement("option");
    option.value = String(item.index);
    option.textContent = item.height >= 2160 ? "4K · 2160p" : item.height >= 1440 ? "2K · 1440p" : item.height >= 1080 ? "Full HD · 1080p" : item.height >= 720 ? "HD · 720p" : item.height + "p";
    qualitySelect.append(option);
  }
  qualitySelect.disabled = sorted.length === 0;
  if (heights.size) $("quality-note").textContent = "Nguồn có các mức thực tế: " + [...heights].map((height) => height + "p").join(" / ") + ". Auto tự điều chỉnh theo băng thông.";
}
function destroy() {
  selectedQuality = "auto";
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.onerror = null;
  video.onloadeddata = null;
  video.onplaying = null;
  resetQuality("Tự động");
  setResolution(0, 0);
}
function currentEpisode() { return data?.lines?.[lineIndex]?.episodes?.[episodeIndex] || null; }
function renderLines() {
  const select = $("line");
  select.replaceChildren();
  data.lines.forEach((line, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = line.lineName || line.name || ("Đường phát " + (index + 1));
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
  if (episode?.url) { $("external").hidden = false; $("external").href = episode.url; }
}
function applyQuality() {
  if (!hls) return;
  if (selectedQuality === "auto") hls.currentLevel = -1;
  else hls.currentLevel = Number(selectedQuality);
}
function play() {
  if (!data?.playbackEnabled || !data?.playbackRightsApproved || data?.rightsStatus !== "APPROVED") {
    destroy();
    hidePlayButton();
    say("Video chưa được cấp quyền phát trực tiếp. ClipViet chỉ mở Play khi nguồn và video đã được duyệt.");
    return;
  }
  const episode = currentEpisode();
  if (!episode || typeof episode.url !== "string") { failed("Không có URL phát hợp lệ."); return; }
  let mediaUrl;
  try {
    mediaUrl = new URL(episode.url);
    if (mediaUrl.protocol !== "https:") throw new Error("Chỉ cho phép media URL HTTPS.");
  } catch (error) { failed(error.message || "Media URL không hợp lệ."); return; }
  destroy();
  $("external").hidden = false;
  $("external").href = mediaUrl.href;
  say("Đang tải video trực tiếp từ CDN nguồn…");
  tapPlay.disabled = true;
  tapPlay.hidden = false;
  tapPlay.textContent = "ĐANG TẢI VIDEO…";
  const isHls = String(episode.type || mediaUrl.pathname).toLowerCase().includes("hls") || /\.m3u8(?:$|\?)/i.test(mediaUrl.href);
  let ready = false;
  const markReady = () => {
    if (ready) return;
    ready = true;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    say("Video đã sẵn sàng. Nhấn nút PHÁT VIDEO.");
    showPlayButton();
  };
  watchdog = setTimeout(() => {
    if (video.readyState < 2 || video.videoWidth === 0) failed("Quá 25 giây chưa nhận được khung hình.");
  }, 25000);
  video.onloadeddata = markReady;
  video.onplaying = () => {
    markReady();
    say("Đang phát · " + (video.videoWidth ? video.videoWidth + "×" + video.videoHeight : "đang nhận hình ảnh"));
  };
  video.onerror = () => { showPlayButton("▶ THỬ PHÁT LẠI"); failed("Trình duyệt không tải được video hoặc segment (MediaError " + (video.error?.code || "unknown") + ")."); };
  if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = mediaUrl.href;
    video.load();
    resetQuality("Tự động · HLS Safari");
    $("quality-note").textContent = "Safari iPhone sử dụng bộ giải mã HLS tích hợp và tự điều chỉnh chất lượng theo mạng. Không phải phiên bản Safari nào cũng cho chọn mức thủ công.";
  } else if (isHls && window.Hls?.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startLevel: -1,
      capLevelToPlayerSize: true,
      capLevelOnFPSDrop: true,
      maxBufferLength: 24,
      maxMaxBufferLength: 48,
      maxBufferSize: 60 * 1000 * 1000,
      backBufferLength: 30,
      maxBufferHole: 0.15,
      abrBandWidthFactor: 0.92,
      abrBandWidthUpFactor: 0.72,
      manifestLoadingTimeOut: 20000,
      fragLoadingTimeOut: 25000
    });
    hls.loadSource(mediaUrl.href);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, manifest) => {
      renderQualityLevels(manifest.levels || hls.levels);
      applyQuality();
      say("HLS Adaptive đã tải manifest · " + hls.levels.length + " mức. Nhấn PHÁT VIDEO.");
      showPlayButton();
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, detail) => {
      const level = hls?.levels?.[detail.level];
      if (level) setResolution(level.width, level.height);
    });
    hls.on(Hls.Events.ERROR, (_event, detail) => {
      if (!detail.fatal) return;
      if (detail.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else failed("HLS lỗi: " + detail.details + ".");
    });
  } else if (isHls) {
    failed("Thiết bị không hỗ trợ HLS. Thử mở bằng Safari hoặc đổi đường phát.");
    return;
  } else {
    video.src = mediaUrl.href;
    video.load();
    resetQuality("Nguồn gốc · tự động");
    $("quality-note").textContent = "MP4 đơn luồng không có lựa chọn chất lượng thủ công. Player sẽ báo đúng độ phân giải nguồn, không giả lập 4K.";
  }
  video.addEventListener("loadedmetadata", () => setResolution(video.videoWidth, video.videoHeight), { once: true });
  video.addEventListener("waiting", () => say("Đang tải dữ liệu video…"), { passive: true });
  video.addEventListener("stalled", () => say("Nguồn video đang ngừng truyền dữ liệu. Đang chờ…"), { passive: true });
  video.addEventListener("playing", hidePlayButton, { passive: true });
  video.addEventListener("pause", () => { if (!video.ended && video.currentSrc) showPlayButton(); }, { passive: true });
}
$("quality").addEventListener("change", () => {
  selectedQuality = $("quality").value;
  applyQuality();
  if (hls && selectedQuality !== "auto") say("Đã chọn " + $("quality").selectedOptions[0].textContent + ".");
});
$("line").addEventListener("change", () => { lineIndex = Number($("line").value) || 0; episodeIndex = 0; renderEpisodes(); play(); });
$("switch").addEventListener("click", () => { lineIndex = (lineIndex + 1) % data.lines.length; episodeIndex = 0; renderLines(); renderEpisodes(); play(); });
$("settings-toggle").addEventListener("click", () => setSettings($("player-settings").hidden));
$("settings-close").addEventListener("click", () => setSettings(false));
$("speed").addEventListener("change", () => { video.playbackRate = Number($("speed").value) || 1; });
$("fit").addEventListener("change", () => { video.style.objectFit = $("fit").value; });
for (const key of Object.keys(imageDefaults)) {
  $(key).addEventListener("input", (event) => {
    imageSettings[key] = Number(event.target.value);
    setImageFilter();
  });
}
$("reset-image").addEventListener("click", () => { Object.assign(imageSettings, imageDefaults); setImageFilter(); });
$("fullscreen").addEventListener("click", () => {
  if (video.webkitEnterFullscreen && /iPhone|iPod/i.test(navigator.userAgent)) video.webkitEnterFullscreen();
  else if (video.requestFullscreen) video.requestFullscreen().catch(() => say("Không thể mở toàn màn hình trên thiết bị này."));
});
$("pip").addEventListener("click", async () => {
  try {
    if (!document.pictureInPictureEnabled || !video.requestPictureInPicture) throw new Error("Thiết bị chưa hỗ trợ Hình trong hình.");
    await video.requestPictureInPicture();
  } catch (error) { say(error.message || "Không thể bật Hình trong hình."); }
});
setImageFilter();

(async () => {
  if (!sourceId || !vodId) { say("Thiếu sourceId hoặc vodId."); return; }
  try {
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(), 15000);
    let response;
    let payload;
    try {
      response = await fetch("https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev/api/playback/providers/" + encodeURIComponent(sourceId) + "/videos/" + encodeURIComponent(vodId), { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || ("Không thể phát video · HTTP " + response.status));
      const playback = payload.data;
      if (!playback || playback.playbackEnabled !== true || playback.playbackRightsApproved !== true || playback.rightsStatus !== "APPROVED") {
        throw new Error("Nguồn chưa xác nhận quyền phát trực tiếp cho video này.");
      }
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Nguồn chi tiết video quá thời gian chờ 15 giây. Hãy thử lại hoặc đổi nguồn.");
      throw error;
    } finally {
      clearTimeout(requestTimer);
    }
    data = payload.data || null;
    if (!data) throw new Error(payload.error || "Video không còn tại nguồn.");
    if (data.playbackEnabled !== true || data.playbackRightsApproved !== true || data.rightsStatus !== "APPROVED") {
      throw new Error("Video chưa được duyệt quyền phát trực tiếp.");
    }
    if (!Array.isArray(data.lines) || !data.lines.length) throw new Error("Nguồn chưa trả luồng media thuộc host đã được phê duyệt.");
    title.textContent = data.title;
    $("meta").textContent = [data.sourceName, data.year, data.area, data.categoryName, data.duration].filter(Boolean).join(" · ");
    $("description").textContent = data.description || "";
    renderLines();
    renderEpisodes();
    play();
  } catch (error) {
    title.textContent = "Không tải được video";
    say(error.message);
  }
})();
window.addEventListener("pagehide", destroy);

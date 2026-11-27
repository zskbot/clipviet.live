const $ = (selector) => document.querySelector(selector);
const player = $("#featured-player");
const image = $("#featured-image");
const playButton = $("#featured-play");
const status = $("#featured-player-status");
const fallback = $("#featured-player-fallback");
const settingsToggle = $("#player-settings-toggle");
const settingsPanel = $("#player-settings-panel");
const qualitySelect = $("#player-quality");
const qualityLabel = $("#player-quality-label");
const resolutionLabel = $("#player-resolution-label");
const settingsNote = $("#player-settings-note");
const hlsScriptUrl = "https://cdn.jsdelivr.net/npm/hls.js@1";
let hlsEngine = null;
let scriptPromise = null;
let activeVideo = null;
let apiVideoPlayer = null;
let apiVideoHost = null;
let apiVideoScriptPromise = null;

function destroyApiVideoPlayer() {
  if (apiVideoPlayer) {
    try { apiVideoPlayer.destroy(); } catch {}
    apiVideoPlayer = null;
  }
  if (apiVideoHost) {
    apiVideoHost.remove();
    apiVideoHost = null;
  }
}
function getApiVideoId(video) {
  const provider = String(video.provider || video.sourceProvider || video.source_provider || video.providerName || "").toLowerCase();
  const value = video.apiVideoId || video.api_video_id ||
    ((provider === "api.video" || provider === "apivideo") ? (video.videoId || video.video_id || video.id) : "");
  return typeof value === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(value) ? value : "";
}
function loadApiVideoSdk() {
  if (window.PlayerSdk) return Promise.resolve(window.PlayerSdk);
  if (apiVideoScriptPromise) return apiVideoScriptPromise;
  apiVideoScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@api.video/player-sdk";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window.PlayerSdk ? resolve(window.PlayerSdk) : reject(new Error("SDK đã tải nhưng không tìm thấy PlayerSdk"));
    script.onerror = () => reject(new Error("Không tải được api.video Player SDK"));
    document.head.append(script);
  });
  return apiVideoScriptPromise;
}
function playApiVideo(video, videoId) {
  destroyHls();
  destroyApiVideoPlayer();
  activeVideo = video;
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    player.hidden = true;
  }
  if (image) image.hidden = true;
  if (playButton) playButton.hidden = true;
  if (settingsToggle) settingsToggle.disabled = true;
  resetQualityOptions("API.video player");
  setResolution(0, 0);
  setStatus("Đang tải api.video Player SDK…");
  setFallback(video.originalUrl || video.sourceUrl || "");
  const stage = $("#featured-poster");
  if (!stage) {
    setStatus("Không tìm thấy vùng hiển thị trình phát.");
    return;
  }
  apiVideoHost = document.createElement("div");
  apiVideoHost.id = "api-video-player-host";
  apiVideoHost.style.cssText = "position:absolute;inset:0;width:100%;height:100%;min-height:220px;background:#000;z-index:2";
  stage.append(apiVideoHost);
  loadApiVideoSdk().then((PlayerSdk) => {
    if (!apiVideoHost || activeVideo !== video) return;
    apiVideoPlayer = new PlayerSdk(apiVideoHost, { id: videoId, autoplay: false, muted: false, hotkeys: true });
    apiVideoPlayer.addEventListener("ready", () => setStatus("api.video player đã sẵn sàng. Nhấn Play trong trình phát."));
    apiVideoPlayer.addEventListener("error", () => {
      setStatus("api.video không thể phát video này. Kiểm tra videoId, trạng thái video và quyền truy cập.");
      setFallback(video.originalUrl || video.sourceUrl || "");
    });
  }).catch((error) => {
    setStatus(error.message || "Không thể khởi tạo api.video Player SDK.");
    setFallback(video.originalUrl || video.sourceUrl || "");
  });
}

const imageDefaults = { brightness: 100, contrast: 100, saturation: 100 };
const imageSettings = { ...imageDefaults };

function isPlaybackAuthorized(video) {
  const expiry = Date.parse(video?.rightsExpiresAt || video?.licenseExpiresAt || "");
  return video?.rightsVerified === true && video?.rightsStatus === "APPROVED" &&
    Number.isFinite(expiry) && expiry > Date.now() &&
    video?.playbackEnabled === true && video?.playbackRightsApproved === true;
}

function setStatus(message, show = true) {
  if (!status) return;
  status.textContent = message;
  status.hidden = !show;
}
function setFallback(url) {
  if (!fallback) return;
  const target = url || activeVideo?.originalUrl || activeVideo?.original_url || activeVideo?.sourceUrl || activeVideo?.source_url || "";
  fallback.href = target || "#";
  fallback.hidden = !target;
}
function destroyHls() {
  if (hlsEngine) {
    try { hlsEngine.destroy(); } catch {}
    hlsEngine = null;
  }
}
function setImageFilter() {
  if (!player) return;
  player.style.filter = `brightness(${imageSettings.brightness}%) contrast(${imageSettings.contrast}%) saturate(${imageSettings.saturation}%)`;
  for (const key of Object.keys(imageDefaults)) {
    const input = $("#player-" + key);
    const output = $("#player-" + key + "-value");
    if (input) input.value = String(imageSettings[key]);
    if (output) output.value = imageSettings[key] + "%";
  }
}
function setSettingsOpen(open) {
  if (!settingsPanel || !settingsToggle) return;
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute("aria-expanded", String(open));
}
function setResolution(width, height) {
  if (!resolutionLabel) return;
  resolutionLabel.textContent = width && height
    ? "ĐỘ PHÂN GIẢI: " + width + "×" + height
    : "ĐỘ PHÂN GIẢI: ĐANG NHẬN…";
}
function resetQualityOptions(label = "Tự động") {
  if (!qualitySelect) return;
  qualitySelect.replaceChildren();
  const option = document.createElement("option");
  option.value = "-1";
  option.textContent = label;
  qualitySelect.append(option);
  qualitySelect.value = "-1";
  qualitySelect.disabled = true;
  if (qualityLabel) qualityLabel.textContent = "CHẤT LƯỢNG: " + label.toUpperCase();
}
function setHlsQualityLevels(levels) {
  if (!qualitySelect) return;
  const sorted = levels.map((level, index) => ({ ...level, index }))
    .filter((level) => Number(level.height) > 0)
    .sort((a, b) => a.height - b.height || b.bitrate - a.bitrate);
  qualitySelect.replaceChildren();
  const auto = document.createElement("option");
  auto.value = "-1";
  auto.textContent = "Tự động · thích ứng mạng";
  qualitySelect.append(auto);
  const seen = new Set();
  sorted.forEach((level) => {
    const height = Number(level.height);
    if (seen.has(height)) return;
    seen.add(height);
    const option = document.createElement("option");
    option.value = String(level.index);
    option.textContent = height >= 2160 ? "4K · 2160p" : height >= 1440 ? "2K · 1440p" : height >= 1080 ? "Full HD · 1080p" : height >= 720 ? "HD · 720p" : height + "p";
    qualitySelect.append(option);
  });
  qualitySelect.disabled = sorted.length === 0;
  if (qualityLabel) qualityLabel.textContent = sorted.length
    ? "CHẤT LƯỢNG: AUTO · " + [...seen].map((height) => height + "p").join(" / ")
    : "CHẤT LƯỢNG: TỰ ĐỘNG";
}
function getSource(video) {
  const sourceList = [
    ...(Array.isArray(video.sources) ? video.sources : []),
    ...(Array.isArray(video.playbackSources) ? video.playbackSources : []),
    ...(Array.isArray(video.playback_sources) ? video.playback_sources : [])
  ];
  const sourceUrl = (source) => typeof source === "string" ? source : source?.url || source?.src || source?.file || "";
  const sourceType = (source) => typeof source === "string" ? source : [source?.type, source?.format, source?.mimeType, source?.mime_type, sourceUrl(source)].filter(Boolean).join(" ");
  const hlsSource = sourceList.find((source) => /hls|mpegurl|m3u8/i.test(sourceType(source)));
  const mp4Source = sourceList.find((source) => /mp4/i.test(sourceType(source)));
  const hlsUrl = video.hlsUrl || video.hls_url || video.m3u8 || video.m3u8Url || video.m3u8_url || video.hls || (hlsSource && sourceUrl(hlsSource));
  const mp4Url = video.videoUrl || video.video_url || video.playbackUrl || video.playback_url || video.mp4Url || video.mp4_url || video.playUrl || video.play_url || (mp4Source && sourceUrl(mp4Source));
  const url = hlsUrl || mp4Url;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  return { url, hls: Boolean(hlsUrl), fallbackUrl: video.originalUrl || video.original_url || video.sourceUrl || video.source_url || "" };
}
function loadHlsLibrary() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = hlsScriptUrl;
    script.crossOrigin = "anonymous";
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error("Không khởi tạo được HLS.js"));
    script.onerror = () => reject(new Error("Không tải được bộ giải mã HLS"));
    document.head.append(script);
  });
  return scriptPromise;
}
function showPlayer() {
  if (player) player.hidden = false;
  if (image) image.hidden = true;
  if (playButton) playButton.hidden = true;
  if (settingsToggle) settingsToggle.disabled = false;
}
function handlePlayFailure(error) {
  setStatus(error?.name === "NotAllowedError"
    ? "Trình duyệt yêu cầu thao tác Play trên thanh điều khiển video."
    : "Không thể bắt đầu phát. Kiểm tra kết nối hoặc mở video gốc.");
  setFallback(activeVideo?.originalUrl || activeVideo?.sourceUrl);
}
function attemptPlayback() {
  const attempt = player?.play();
  if (attempt && typeof attempt.catch === "function") attempt.catch(handlePlayFailure);
}
function onMediaError() {
  setStatus("Không thể tải luồng video. Nguồn có thể lỗi, bị giới hạn CORS hoặc không hỗ trợ định dạng.");
  setFallback(activeVideo?.originalUrl || activeVideo?.sourceUrl);
}
function playFeaturedVideo(video) {
  if (!player || !video) return;
  const apiVideoId = getApiVideoId(video);
  if (apiVideoId) {
    if (!isPlaybackAuthorized(video)) {
      destroyHls();
      destroyApiVideoPlayer();
      if (player) {
        player.pause();
        player.removeAttribute("src");
        player.load();
      }
      activeVideo = video;
      setStatus("Video api.video đang bị khóa: chưa có xác nhận quyền phát hợp lệ.");
      setFallback(video.originalUrl || video.sourceUrl || "");
      return;
    }
    playApiVideo(video, apiVideoId);
    return;
  }
  if (!isPlaybackAuthorized(video)) {
    destroyHls();
    destroyApiVideoPlayer();
    player.pause();
    player.removeAttribute("src");
    player.load();
    activeVideo = video;
    setStatus("Video đang bị khóa: quyền phát chưa được xác minh hoặc đã hết hạn.");
    setFallback("");
    return;
  }
  destroyApiVideoPlayer();
  const source = getSource(video);
  if (!source) {
    activeVideo = video;
    setStatus("Video này chưa có URL phát trực tiếp hợp lệ.");
    setFallback(video.originalUrl || video.sourceUrl);
    return;
  }
  destroyHls();
  activeVideo = video;
  player.pause();
  player.removeAttribute("src");
  player.load();
  player.style.objectFit = $("#player-fit")?.value || "contain";
  setImageFilter();
  resetQualityOptions(source.hls ? "Đang dò luồng" : "Nguồn đơn");
  setResolution(0, 0);
  setStatus(source.hls ? "Đang tải danh sách chất lượng video…" : "Đang tải video…");
  setFallback(source.fallbackUrl);
  showPlayer();

  if (source.hls) {
    if (player.canPlayType("application/vnd.apple.mpegurl")) {
      player.src = source.url;
      player.load();
      player.addEventListener("loadedmetadata", () => {
        setResolution(player.videoWidth, player.videoHeight);
        resetQualityOptions("Tự động · Safari");
        if (settingsNote) settingsNote.textContent = "Safari iPhone tự chọn chất lượng HLS theo băng thông và khả năng thiết bị. Chế độ chọn độ phân giải thủ công phụ thuộc hỗ trợ của trình duyệt.";
        setStatus("Đã nạp luồng HLS. Đang bắt đầu phát…");
        attemptPlayback();
      }, { once: true });
      return;
    }
    loadHlsLibrary().then((Hls) => {
      if (!Hls.isSupported()) throw new Error("Trình duyệt không hỗ trợ HLS/MSE");
      hlsEngine = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        capLevelOnFPSDrop: true,
        maxBufferLength: 24,
        maxMaxBufferLength: 48,
        maxBufferSize: 60 * 1000 * 1000,
        abrBandWidthFactor: 0.92,
        abrBandWidthUpFactor: 0.72
      });
      hlsEngine.on(Hls.Events.MEDIA_ATTACHED, () => hlsEngine.loadSource(source.url));
      hlsEngine.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = data.levels || hlsEngine.levels;
        setHlsQualityLevels(levels);
        const highest = levels.reduce((best, level) => Math.max(best, level.height || 0), 0);
        if (settingsNote) settingsNote.textContent = "Nguồn có các mức chất lượng đến " + (highest || "—") + "p. Auto tự điều chỉnh theo băng thông, kích thước màn hình và khả năng giải mã.";
        setStatus("Đã nạp luồng thích ứng. Đang bắt đầu phát…");
        attemptPlayback();
      });
      hlsEngine.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hlsEngine.levels[data.level];
        if (level) {
          setResolution(level.width, level.height);
          if (qualityLabel) qualityLabel.textContent = "CHẤT LƯỢNG: " + (data.level < 0 ? "AUTO" : level.height + "p");
        }
      });
      hlsEngine.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsEngine.recoverMediaError();
        else onMediaError();
      });
      hlsEngine.attachMedia(player);
    }).catch((error) => {
      setStatus(error.message || "Không thể khởi tạo HLS.");
      setFallback(source.fallbackUrl);
    });
    return;
  }

  player.src = source.url;
  player.load();
  player.addEventListener("loadedmetadata", () => {
    const width = player.videoWidth, height = player.videoHeight;
    setResolution(width, height);
    resetQualityOptions(width && height ? "Nguồn gốc · " + height + "p" : "Nguồn đơn");
    if (settingsNote) settingsNote.textContent = "Nguồn MP4 chỉ có một độ phân giải gốc. Muốn chọn Full HD hoặc 4K, nhà cung cấp phải cung cấp luồng tương ứng; không dùng upscale giả.";
  }, { once: true });
  attemptPlayback();
}
function resetFeaturedPlayer() {
  destroyHls();
  destroyApiVideoPlayer();
  activeVideo = null;
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.style.filter = "";
    player.style.objectFit = "contain";
    player.load();
  }
  setStatus("", false);
  setFallback("");
  if (settingsToggle) settingsToggle.disabled = true;
  setSettingsOpen(false);
  resetQualityOptions("—");
  if (qualityLabel) qualityLabel.textContent = "CHẤT LƯỢNG: —";
  setResolution(0, 0);
}
function initFeaturedPlayer() {
  if (!player) return;
  settingsToggle?.addEventListener("click", () => setSettingsOpen(settingsPanel?.hidden));
  $("#player-settings-close")?.addEventListener("click", () => setSettingsOpen(false));
  $("#player-settings-reset")?.addEventListener("click", () => {
    Object.assign(imageSettings, imageDefaults);
    setImageFilter();
  });
  $("#player-fullscreen")?.addEventListener("click", () => {
    const shell = $(".featured-player-shell");
    if (player.webkitEnterFullscreen && /iPhone|iPod/i.test(navigator.userAgent)) player.webkitEnterFullscreen();
    else if (shell?.requestFullscreen) shell.requestFullscreen().catch(() => setStatus("Không thể mở toàn màn hình trên trình duyệt này."));
  });
  qualitySelect?.addEventListener("change", () => {
    if (!hlsEngine) return;
    hlsEngine.currentLevel = Number(qualitySelect.value);
    if (qualityLabel) qualityLabel.textContent = "CHẤT LƯỢNG: " + (qualitySelect.value === "-1" ? "AUTO" : qualitySelect.selectedOptions[0]?.textContent.toUpperCase());
  });
  $("#player-speed")?.addEventListener("change", (event) => { player.playbackRate = Number(event.target.value) || 1; });
  $("#player-fit")?.addEventListener("change", (event) => { player.style.objectFit = event.target.value; });
  for (const key of Object.keys(imageDefaults)) {
    $("#player-" + key)?.addEventListener("input", (event) => {
      imageSettings[key] = Number(event.target.value);
      setImageFilter();
    });
  }
  player.addEventListener("error", onMediaError);
  player.addEventListener("playing", () => setStatus("", false));
  player.addEventListener("loadedmetadata", () => setResolution(player.videoWidth, player.videoHeight));
  setImageFilter();
  resetFeaturedPlayer();
}
export { initFeaturedPlayer, playFeaturedVideo, resetFeaturedPlayer };

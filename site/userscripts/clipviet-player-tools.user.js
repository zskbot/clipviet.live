// ==UserScript==
// @name         ClipViet Player Tools
// @namespace    https://github.com/zskbot/clipviet
// @version      1.1.0
// @description  Optional keyboard shortcuts for the native ClipViet video player.
// @match        https://clipviet.live/*
// @match        https://www.clipviet.live/*
// @match        https://*.clipviet-live-preview.pages.dev/*
// @match        https://*.clipviet-live-independent-preview.pages.dev/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  "use strict";

  if (window.__clipvietPlayerToolsLoaded) return;
  window.__clipvietPlayerToolsLoaded = true;

  const MIN_RATE = 0.5;
  const MAX_RATE = 2;
  const RATE_STEP = 0.25;
  let toastTimer = 0;

  const style = document.createElement("style");
  style.textContent = `
    #clipviet-userscript-toast {
      position: fixed;
      z-index: 2147483647;
      right: 16px;
      bottom: 24px;
      max-width: min(360px, calc(100vw - 32px));
      padding: 10px 14px;
      color: #fff;
      background: #11131a;
      border: 1px solid #ef3340;
      font: 12px/1.5 system-ui, sans-serif;
      pointer-events: none;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity .16s, transform .16s;
    }
    #clipviet-userscript-toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.documentElement.append(style);

  const toast = document.createElement("div");
  toast.id = "clipviet-userscript-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.append(toast);

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1500);
  }

  function isEditable(target) {
    return target instanceof Element && Boolean(target.closest(
      "input, textarea, select, button, a, [role='button'], [role='textbox'], [contenteditable]:not([contenteditable='false'])"
    ));
  }

  function activeVideo() {
    return [...document.querySelectorAll("video")].filter(video => {
      const rect = video.getBoundingClientRect();
      const computed = window.getComputedStyle(video);
      return rect.width > 0 && rect.height > 0 &&
        computed.visibility !== "hidden" && computed.display !== "none" &&
        !video.hidden;
    }).sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    })[0] || null;
  }

  function clampRate(rate) {
    return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(rate * 4) / 4));
  }

  function toggleFullscreen(video) {
    if (document.fullscreenElement) {
      const result = document.exitFullscreen?.();
      result?.catch?.(() => notify("Không thể thoát chế độ toàn màn hình."));
      return;
    }

    const container = video.closest(".featured-player-shell, .player-shell, .video-player");
    if (container && typeof container.requestFullscreen === "function") {
      const result = container.requestFullscreen();
      result?.catch?.(() => notify("Trình duyệt không cho phép toàn màn hình."));
      return;
    }

    // Safari iPhone requires the HTMLVideoElement receiver for native fullscreen.
    if (typeof video.webkitEnterFullscreen === "function") {
      try {
        video.webkitEnterFullscreen();
      } catch {
        notify("Nguồn video không hỗ trợ toàn màn hình.");
      }
      return;
    }

    if (typeof video.requestFullscreen === "function") {
      const result = video.requestFullscreen();
      result?.catch?.(() => notify("Trình duyệt không cho phép toàn màn hình."));
      return;
    }

    notify("Trình duyệt này không hỗ trợ toàn màn hình cho video.");
  }

  function playOrPause(video) {
    if (!video.paused) {
      video.pause();
      notify("Đã tạm dừng");
      return;
    }

    try {
      const result = video.play();
      Promise.resolve(result).then(
        () => notify("Đang phát"),
        () => notify("Trình duyệt chặn phát — hãy chạm nút Play.")
      );
    } catch {
      notify("Không thể bắt đầu phát video.");
    }
  }

  function togglePictureInPicture(video) {
    if (!document.pictureInPictureEnabled) {
      notify("Trình duyệt này không hỗ trợ Picture-in-Picture.");
      return;
    }

    try {
      const result = document.pictureInPictureElement === video
        ? document.exitPictureInPicture?.()
        : video.requestPictureInPicture?.();

      if (!result) {
        notify("Nguồn video không hỗ trợ Picture-in-Picture.");
        return;
      }
      Promise.resolve(result).catch(() => notify("Nguồn video không hỗ trợ Picture-in-Picture."));
    } catch {
      notify("Không thể bật Picture-in-Picture.");
    }
  }

  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        event.repeat || isEditable(event.target)) return;

    const video = activeVideo();
    if (!video) return;

    const key = event.key.toLowerCase();
    let handled = true;

    switch (key) {
      case " ":
      case "k":
        playOrPause(video);
        break;
      case "arrowleft":
      case "j":
        video.currentTime = Math.max(0, video.currentTime - (key === "j" ? 10 : 5));
        notify("Lùi " + (key === "j" ? 10 : 5) + " giây");
        break;
      case "arrowright":
      case "l":
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (key === "l" ? 10 : 5));
        notify("Tiến " + (key === "l" ? 10 : 5) + " giây");
        break;
      case "m":
        video.muted = !video.muted;
        notify(video.muted ? "Đã tắt tiếng" : "Đã bật tiếng");
        break;
      case "f":
        toggleFullscreen(video);
        break;
      case "[":
        video.playbackRate = clampRate(video.playbackRate - RATE_STEP);
        notify("Tốc độ " + video.playbackRate.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "") + "×");
        break;
      case "]":
        video.playbackRate = clampRate(video.playbackRate + RATE_STEP);
        notify("Tốc độ " + video.playbackRate.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "") + "×");
        break;
      case "0":
        video.playbackRate = 1;
        notify("Tốc độ bình thường · 1×");
        break;
      case "p":
        togglePictureInPicture(video);
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
})();

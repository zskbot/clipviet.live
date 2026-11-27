"use client";

import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://unpkg.com/@api.video/player-sdk@1.2.33";

function loadApiVideoSdk() {
  if (window.PlayerSdk) return Promise.resolve(window.PlayerSdk);
  return new Promise((resolve, reject) => {
    let script = document.getElementById("clipviet-apivideo-player-sdk");
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = "clipviet-apivideo-player-sdk";
      script.src = SDK_URL;
      script.async = true;
    }
    const ready = () => {
      if (window.PlayerSdk) resolve(window.PlayerSdk);
      else reject(new Error("API.video Player SDK loaded without PlayerSdk."));
    };
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("Không tải được API.video Player SDK.")), { once: true });
    if (script.dataset.loaded === "true") ready();
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    if (created) document.head.appendChild(script);
  });
}

export default function ApiVideoPlayer({ videoId }) {
  const targetRef = useRef(null);
  const [status, setStatus] = useState("Đang kiểm tra quyền phát API.video…");

  useEffect(() => {
    let active = true;
    let player = null;
    async function mount() {
      try {
        const check = await fetch("/api/integrations/apivideo/playback?id=" + encodeURIComponent(videoId), {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const permission = await check.json();
        if (!check.ok || !permission.enabled || permission.videoId !== videoId) {
          throw new Error("Video chưa được duyệt phát qua API.video.");
        }
        const PlayerSdk = await loadApiVideoSdk();
        if (!active || !targetRef.current) return;
        player = new PlayerSdk(targetRef.current, {
          id: permission.videoId,
          live: permission.live === true,
          autoplay: false,
          muted: false,
          hotKeys: true
        });
        player.addEventListener("ready", () => active && setStatus("API.video Player đã sẵn sàng."));
        player.addEventListener("error", () => active && setStatus("API.video không thể phát video này."));
        if (active) setStatus("Đang khởi tạo API.video Player…");
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Không thể khởi tạo API.video Player.");
      }
    }
    if (videoId) mount();
    return () => {
      active = false;
      if (player) {
        try { player.destroy(); } catch {}
      }
    };
  }, [videoId]);

  return <section className="w-full">
    <div ref={targetRef} className="aspect-video w-full overflow-hidden border border-white/10 bg-black" />
    <p className="mt-2 text-xs text-zinc-500" role="status" aria-live="polite">{status}</p>
  </section>;
}

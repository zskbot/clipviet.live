"use client";

import { useEffect, useState } from "react";

function safeHttps(value, allowedHosts, label = "URL") {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { throw new Error("URL không hợp lệ."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Chỉ chấp nhận URL HTTPS không chứa thông tin đăng nhập hoặc cổng tùy chỉnh.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!Array.isArray(allowedHosts) || !allowedHosts.includes(host)) throw new Error(`${label}: host chưa nằm trong allowlist.`);
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "::1" || host === "0.0.0.0" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) throw new Error("Không cho phép địa chỉ localhost hoặc mạng nội bộ.");
  return url.href;
}

function normalize(payload) {
  const rows = Array.isArray(payload) ? payload :
    Array.isArray(payload?.results) ? payload.results :
    Array.isArray(payload?.videos) ? payload.videos :
    Array.isArray(payload?.data) ? payload.data : null;
  if (!rows) throw new Error("API phải trả về array hoặc object chứa results, videos hay data dạng array.");
  return rows.map((item, index) => ({
    id: String(item.id ?? item.video_id ?? item.slug ?? index),
    title: String(item.title ?? item.name ?? `Video ${index + 1}`),
    category: String(item.category ?? item.genre ?? "Chưa phân loại"),
    poster: item.poster ?? item.poster_url ?? item.thumbnail_url ?? item.thumbnail ?? "",
    media: item.videoUrl ?? item.video_url ?? item.media_url ?? item.src ?? item.url ?? ""
  }));
}

export default function AdminVideoApiPlayer() {
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("Chưa kết nối API.");
  const [busy, setBusy] = useState(false);
  const [allowlist, setAllowlist] = useState({ apiHosts: [], mediaHosts: [] });

  useEffect(() => {
    let active = true;
    fetch("/api/security/allowlist", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Không tải được allowlist.")))
      .then(data => { if (active) setAllowlist({ apiHosts: data.apiHosts || [], mediaHosts: data.mediaHosts || [] }); })
      .catch(() => { if (active) setAllowlist({ apiHosts: [], mediaHosts: [] }); });
    return () => { active = false; };
  }, []);

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("Đang kết nối API…");
    try {
      const url = safeHttps(endpoint, allowlist.apiHosts, "API endpoint");
      const headers = { Accept: "application/json" };
      if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
      const response = await fetch(url, {
        method: "GET",
        headers,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`API trả về HTTP ${response.status}.`);
      if (!(response.headers.get("content-type") || "").toLowerCase().includes("json")) {
        throw new Error("Endpoint không trả về JSON.");
      }
      const rows = normalize(await response.json());
      setVideos(rows);
      setSelected(null);
      setStatus(`Kết nối thành công: ${rows.length} video.`);
    } catch (error) {
      setVideos([]);
      setSelected(null);
      setStatus(`Không tải được API: ${error.message} Kiểm tra HTTPS, CORS và cấu trúc JSON.`);
    } finally {
      setBusy(false);
    }
  }

  function play(url, title) {
    try {
      const media = safeHttps(url, allowlist.mediaHosts, "Media URL");
      setSelected({ url: media, title: title || "Video URL" });
      setStatus("Đã chọn video. Nhấn Play trong trình phát nếu trình duyệt không tự chạy.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="mb-8 border border-white/15 bg-white/[.03] p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">VIDEO API / PLAYER</p>
        <h2 className="mt-2 text-xl font-black">Phát video từ API URL</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Chỉ kết nối API và phát media HTTPS từ host đã khai báo trong VIDEO_API_ALLOWED_HOSTS và VIDEO_MEDIA_ALLOWED_HOSTS. Chỉ dùng nguồn bạn sở hữu hoặc được cấp quyền.
        </p>
      </div>
      <form onSubmit={connect} className="grid gap-3">
        <label className="block text-xs font-semibold text-zinc-300">
          JSON API endpoint
          <input required type="url" inputMode="url" value={endpoint} onChange={event => setEndpoint(event.target.value)}
            placeholder={allowlist.apiHosts.length ? `https://${allowlist.apiHosts[0]}/videos` : "Chưa cấu hình VIDEO_API_ALLOWED_HOSTS"}
            className="mt-2 w-full border border-white/15 bg-black px-3 py-3 text-sm text-white outline-none focus:border-red-500" />
        </label>
        <label className="block text-xs font-semibold text-zinc-300">
          Bearer token (không bắt buộc)
          <input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)}
            placeholder="Chỉ giữ trong bộ nhớ tab hiện tại"
            className="mt-2 w-full border border-white/15 bg-black px-3 py-3 text-sm text-white outline-none focus:border-red-500" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="border border-red-500 bg-red-600 px-5 py-3 text-xs font-bold tracking-wide disabled:opacity-40">
            {busy ? "ĐANG KẾT NỐI…" : "KẾT NỐI & TẢI VIDEO"}
          </button>
          <button type="button" onClick={() => { setEndpoint(""); setToken(""); setVideos([]); setSelected(null); setStatus("Đã xóa dữ liệu phiên hiện tại."); }}
            className="border border-white/15 px-5 py-3 text-xs font-bold tracking-wide">XÓA PHIÊN</button>
        </div>
      </form>
      <p role="status" className="mt-4 border-l-2 border-amber-500/70 pl-3 text-xs leading-5 text-zinc-400">{status}</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1.15fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Danh sách API</h3>
            <span className="text-xs text-zinc-500">{videos.length} VIDEO</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {videos.length ? videos.map(video => (
              <article key={video.id} className="flex min-w-0 items-center gap-3 border border-white/10 p-3">
                {video.poster ? <img src={video.poster} alt="" loading="lazy" className="h-14 w-20 shrink-0 object-cover" /> :
                  <div className="grid h-14 w-20 shrink-0 place-items-center border border-white/10 text-xs font-black text-red-400">CV</div>}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">{video.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{video.category}</p>
                  <button type="button" disabled={!video.media} onClick={() => play(video.media, video.title)}
                    className="mt-2 border border-white/20 px-3 py-1.5 text-[10px] font-bold tracking-wide disabled:opacity-30">CHỌN PHÁT</button>
                </div>
              </article>
            )) : <p className="border border-dashed border-white/10 p-5 text-xs text-zinc-500">Chưa có dữ liệu. Kết nối JSON API để tải danh sách.</p>}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-bold">Trình phát</h3>
          <div className="border border-white/10 bg-black">
            <video key={selected?.url || "empty"} src={selected?.url || undefined} controls playsInline preload="metadata"
              className="aspect-video w-full bg-black" />
          </div>
          <p className="mt-2 break-all text-xs text-zinc-500">{selected?.title || "Chưa chọn video"}</p>
          <form onSubmit={event => { event.preventDefault(); play(directUrl, "Phát trực tiếp bằng URL"); }} className="mt-4 space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">Hoặc nhập URL media trực tiếp</label>
            <input required type="url" inputMode="url" value={directUrl} onChange={event => setDirectUrl(event.target.value)}
              placeholder={allowlist.mediaHosts.length ? `https://${allowlist.mediaHosts[0]}/video.mp4` : "Chưa cấu hình VIDEO_MEDIA_ALLOWED_HOSTS"}
              className="w-full border border-white/15 bg-black px-3 py-3 text-sm text-white outline-none focus:border-red-500" />
            <button className="w-full border border-white/20 px-4 py-3 text-xs font-bold tracking-wide">PHÁT URL NÀY</button>
          </form>
          <p className="mt-3 text-[11px] leading-5 text-zinc-600">
            API và media host được kiểm tra theo allowlist chính xác; request API chặn redirect, không gửi cookie và token chỉ tồn tại trong bộ nhớ tab. HLS .m3u8 cần host media được cấp quyền.
          </p>
        </div>
      </div>
    </section>
  );
}

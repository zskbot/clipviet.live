"use client";

import { useState } from "react";

export default function VideoProvidersAdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkProviders(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/providers", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setData(payload);
    } catch (cause) {
      setData(null);
      setError(cause.message || "Không thể kiểm tra provider.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="container min-h-[70vh] py-10">
    <p className="text-xs font-bold uppercase tracking-[.25em] text-red-400">CLIPVIET / PREVIEW ADMIN</p>
    <h1 className="mt-2 text-3xl font-black">Video Provider Control</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Kiểm tra trạng thái MacCMS providers, số video nhận được và lỗi kết nối. API key và URL đầy đủ không được trả về trình duyệt.</p>
    <div className="mt-6 border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100/80">
      Chỉ đọc trên Deploy Preview. Cấu hình nguồn được nạp từ VIDEO_MACCMS_PROVIDERS_JSON; không có thao tác sửa Production hoặc lưu credential trong trình duyệt.
    </div>
    {!data && <form onSubmit={checkProviders} className="mt-6 max-w-xl border border-white/10 bg-white/[.03] p-6">
      <label className="block text-xs font-semibold text-zinc-400">ADMIN_CMS_TOKEN</label>
      <input type="password" autoComplete="off" required value={token} onChange={event => setToken(event.target.value)} className="mt-2 w-full border border-white/15 bg-black px-3 py-3 text-sm outline-none focus:border-red-500" />
      <button disabled={busy || !token} className="mt-4 border border-red-500 bg-red-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang kiểm tra…" : "Kiểm tra nguồn video"}</button>
    </form>}
    {error && <p role="alert" className="mt-5 border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">{error}</p>}
    {data && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-white/10 p-4">
        <div><p className="text-xs text-zinc-500">Tổng video từ MacCMS</p><p className="mt-1 text-2xl font-black tabular-nums">{data.totalVideos}</p></div>
        <button onClick={() => setData(null)} className="border border-white/15 px-3 py-2 text-xs font-bold">Đóng phiên</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.configured.map(provider => {
          const status = data.providers.find(item => item.id === provider.id);
          const issue = data.errors.find(item => item.id === provider.id);
          return <article key={provider.id} className="border border-white/10 bg-white/[.03] p-4">
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{provider.name}</h2><span className={`border px-2 py-1 text-xs ${status?.state === "ok" ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>{status?.state || "not_checked"}</span></div>
            <p className="mt-2 text-xs text-zinc-500">ID: {provider.id} · API host: {provider.apiHost}</p>
            <p className="mt-2 text-sm text-zinc-300">{status?.count ?? 0} video</p>
            {issue && <p className="mt-3 break-words text-xs text-red-300">{issue.error}</p>}
          </article>;
        })}
      </div>
      <p className="mt-5 text-xs text-zinc-600">Kiểm tra lúc: {new Date(data.checkedAt).toLocaleString("vi-VN")}</p>
    </>}
  </main>;
}

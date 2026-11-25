"use client";

import { useState } from "react";

const endpointLabels = {
  "/health/live": "Liveness",
  "/health/ready": "Readiness",
  "/services": "Services",
  "/agents": "Agents",
  "/providers": "Providers",
  "/runtime/status": "Runtime",
  "/mcp/connections": "MCP connections",
};

const stateLabels = {
  ok: "Hoạt động",
  error: "Lỗi HTTP",
  unreachable: "Không kết nối",
  not_configured: "Chưa cấu hình",
  blocked: "Bị chặn",
};

export default function OCodeJSAdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ocodejs", {
        headers: { Authorization: `Bearer ${adminToken}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok && response.status !== 503) throw new Error(payload.error || `HTTP ${response.status}`);
      setOverview(payload.result || null);
      if (!payload.result?.configured) setError(payload.result?.message || payload.error || "OCodeJS chưa được cấu hình.");
    } catch (cause) {
      setOverview(null);
      setError(cause.message || "Không thể kết nối.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container min-h-[70vh] py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-red-400">CLIPVIET / INTEGRATIONS</p>
          <h1 className="mt-2 text-3xl font-black">OCodeJS Control</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Giám sát tình trạng API, services, agents, providers, runtime và MCP connections.</p>
        </div>
        <a href="/admin" className="text-sm text-zinc-400 hover:text-white">← Admin CMS</a>
      </div>

      <section className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.04] p-4 text-sm leading-6 text-amber-100/80">
        Chế độ an toàn: chỉ gọi GET tới các endpoint giám sát đã khai báo. Chưa bật thao tác thay đổi cấu hình, restart, publish hoặc xóa dữ liệu.
      </section>

      {!overview && (
        <form onSubmit={connect} className="max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <h2 className="text-lg font-bold">Xác thực quản trị ClipViet</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Dùng ADMIN_CMS_TOKEN để mở proxy quản trị. OCODEJS_API_TOKEN được lưu riêng trong secret của server, không nhập vào trình duyệt.</p>
          <label className="mt-5 block text-xs font-semibold text-zinc-400">Admin CMS token</label>
          <input type="password" autoComplete="off" required value={adminToken} onChange={(event) => setAdminToken(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm outline-none focus:border-red-500" />
          <button disabled={busy || !adminToken} className="mt-4 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang kiểm tra…" : "Kết nối OCodeJS"}</button>
        </form>
      )}

      {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200">{error}</p>}

      {overview?.configured && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
            <div><p className="text-xs text-zinc-500">API base</p><p className="mt-1 font-semibold">{overview.baseUrl}</p></div>
            <div><p className="text-xs text-zinc-500">Chế độ</p><p className="mt-1 font-semibold">READ ONLY</p></div>
            <button onClick={() => { setOverview(null); setError(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold">Đóng phiên</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {overview.checks.map((check) => (
              <article key={check.path} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">{endpointLabels[check.path] || check.path}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${check.state === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-zinc-300"}`}>{stateLabels[check.state] || check.state}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{check.path}{check.status ? ` · HTTP ${check.status}` : ""}</p>
                {check.error && <p className="mt-3 text-sm text-red-300">{check.error}</p>}
                {check.data !== undefined && <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs leading-5 text-zinc-300">{JSON.stringify(check.data, null, 2)}</pre>}
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-zinc-600">Lần kiểm tra: {overview.checkedAt ? new Date(overview.checkedAt).toLocaleString("vi-VN") : "—"}</p>
        </>
      )}
    </main>
  );
}

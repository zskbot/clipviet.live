"use client";

import { useCallback, useEffect, useState } from "react";

const base = (process.env.NEXT_PUBLIC_PROVIDER_REGISTRY_URL || "").replace(/\/$/, "");
const stateTone = value => value === "PASS" || value === "ENABLED" || value === "APPROVED" ? "border-emerald-500/40 text-emerald-300" : value === "FAIL" || value === "REVOKED" ? "border-red-500/40 text-red-300" : "border-amber-500/40 text-amber-200";
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, credentials: "include", cache: "no-store", headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
export default function ProviderVerificationPage() {
  const [providers,setProviders] = useState([]);
  const [diagnostics,setDiagnostics] = useState({});
  const [rights,setRights] = useState({});
  const [error,setError] = useState("");
  const [busy,setBusy] = useState("");
  const [loaded,setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!base) { setLoaded(true); return; }
    setError("");
    try {
      const data = await request("/providers");
      const rows = data.providers || [];
      setProviders(rows);
      const [diagRows,rightsRows] = await Promise.all(rows.map(async p => {
        const [d,r] = await Promise.all([
          request(`/providers/${encodeURIComponent(p.id)}/diagnostics`).catch(()=>({runs:[]})),
          request(`/providers/${encodeURIComponent(p.id)}/content-rights`).catch(()=>({records:[]}))
        ]);
        return [p.id,d.runs || [],r.records || []];
      }));
      setDiagnostics(Object.fromEntries(diagRows.map(([id,items])=>[id,items])));
      setRights(Object.fromEntries(rightsRows.map(([id,items])=>[id,items])));
    } catch (e) { setError(e.message || "Không thể tải Provider Registry."); }
    finally { setLoaded(true); }
  },[]);
  useEffect(()=>{ load(); },[load]);
  async function run(id) {
    setBusy(id); setError("");
    try {
      await request(`/providers/${encodeURIComponent(id)}/diagnostics/run`,{method:"POST",body:"{}"});
      await load();
    } catch(e) { setError(e.message || "Diagnostic failed."); }
    finally { setBusy(""); }
  }
  return <main className="container min-h-[70vh] py-10">
    <p className="text-xs font-bold uppercase tracking-[.24em] text-red-400">CLIPVIET / PREVIEW ONLY</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-black">Provider Verification</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Technical diagnostics and per-content rights ledger. Provider reachability never grants playback or redistribution permission.</p></div>
      <button onClick={load} className="border border-white/20 px-4 py-2 text-sm font-bold">Refresh</button>
    </div>
    <div className="mt-6 border border-amber-500/40 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">All five seeded providers remain PENDING. Media host allowlists are empty. Do not add wildcard hosts or mark rights verified without independently reviewed evidence.</div>
    {!base && <div className="mt-6 border border-white/15 p-4 text-sm text-zinc-300">Preview setup required: set <code>NEXT_PUBLIC_PROVIDER_REGISTRY_URL</code> to the dedicated Access-protected Preview Worker URL. Do not point this page at a Production Worker.</div>}
    {error && <p role="alert" className="mt-5 border border-red-500/40 p-3 text-sm text-red-200">{error}</p>}
    {loaded && base && !providers.length && !error && <p className="mt-6 text-sm text-zinc-500">No provider records returned. Apply the Preview D1 migrations before use.</p>}
    <section className="mt-6 grid gap-4">
      {providers.map(provider => {
        const runs = diagnostics[provider.id] || [];
        const latest = runs[0];
        const records = rights[provider.id] || [];
        return <article key={provider.id} className="border border-white/15 bg-white/[.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold">{provider.name}</h2><p className="mt-1 text-xs text-zinc-500">{provider.apiHost} · {provider.apiBaseUrl}</p></div>
            <span className={`border px-2 py-1 text-xs font-bold ${stateTone(provider.status)}`}>{provider.status}</span>
          </div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
            <div className="border border-white/10 p-3"><span className="text-zinc-500">Exact media hosts</span><p className="mt-1 font-bold">{provider.mediaHosts?.length || 0}</p></div>
            <div className="border border-white/10 p-3"><span className="text-zinc-500">Latest diagnostic</span><p className={`mt-1 font-bold ${stateTone(latest?.status)}`}>{latest?.status || "NOT RUN"}</p></div>
            <div className="border border-white/10 p-3"><span className="text-zinc-500">Content rights records</span><p className="mt-1 font-bold">{records.length}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy === provider.id} onClick={()=>run(provider.id)} className="border border-red-500/60 px-3 py-2 text-xs font-bold disabled:opacity-40">{busy === provider.id ? "Running…" : "Run diagnostics"}</button>
            <span className="border border-white/10 px-3 py-2 text-xs text-zinc-400">Rights: {records.filter(x=>x.status==="APPROVED").length} approved / {records.filter(x=>x.status==="PENDING").length} pending</span>
          </div>
          {latest && <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-xs text-zinc-500">Last run: {latest.checkedAt} · ID: {latest.runId}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(latest.result?.checks || {}).map(([key,value])=><div key={key} className="border border-white/10 p-2"><p className="text-[11px] text-zinc-500">{key}</p><p className={`mt-1 text-xs font-bold ${stateTone(value.status)}`}>{value.status}</p></div>)}
            </div>
            {!!latest.result?.sample?.mediaHostCandidates?.length && <p className="mt-2 break-all text-xs text-zinc-400">CDN candidates (not approved): {latest.result.sample.mediaHostCandidates.join(", ")}</p>}
          </div>}
          {!!records.length && <div className="mt-4 border-t border-white/10 pt-3"><h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Content rights ledger</h3><div className="mt-2 grid gap-2">{records.map(record=><div key={record.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 p-2 text-xs"><span>{record.sourcePlatform} / {record.sourceContentId}</span><span className={`border px-2 py-1 ${stateTone(record.status)}`}>{record.status}</span><span className="text-zinc-500">{record.permittedUses?.join(", ") || "No permitted use"}</span></div>)}</div></div>}
        </article>;
      })}
    </section>
  </main>;
}

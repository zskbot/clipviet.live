import test from "node:test";
import assert from "node:assert/strict";
import { runProviderDiagnostic, listProviderDiagnostics } from "../workers/provider-registry/src/diagnostics.mjs";

function fakeDb() {
  const saved = [];
  return {
    saved,
    prepare(sql) {
      return { bind(...args) {
        return {
          async run() { saved.push({sql,args}); return {}; },
          async all() { return {results:saved.filter(x=>x.sql.includes("INSERT")).map(x=>({id:x.args[0],provider_id:x.args[1],status:x.args[2],result_json:x.args[3],checked_at:x.args[4]}))}; }
        };
      }};
    }
  };
}
const provider = {
  id:"souavzy", api_base_url:"https://api.souavzy.vip/api.php/provide/vod/",
  api_host:"api.souavzy.vip", media_hosts_json:"[]"
};

test("diagnostic validates AppleCMS JSON but never probes an unapproved media host", async () => {
  const originalFetch = globalThis.fetch;
  let calls = [];
  globalThis.fetch = async (url, init={}) => {
    calls.push({url:String(url),init});
    const page = Number(new URL(String(url)).searchParams.get("pg"));
    return new Response(JSON.stringify({
      code:1,page,pagecount:4,total:21,limit:20,
      list:[{vod_id:17,vod_name:"Fixture",vod_pic:"https://img.invalid/poster.jpg",vod_content:"fixture",vod_year:"2026",vod_duration:"90m",vod_play_from:"test",vod_play_url:"Episode$https://cdn.not-approved.invalid/video.m3u8"}]
    }),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const db=fakeDb();
    const run=await runProviderDiagnostic(db,provider);
    assert.equal(run.checks.http.status,"PASS");
    assert.equal(run.checks.json.status,"PASS");
    assert.equal(run.checks.pagination.status,"PASS");
    assert.equal(run.checks.metadata.status,"PASS");
    assert.equal(run.checks.mediaHosts.status,"FAIL");
    assert.equal(run.checks.mime.status,"UNVERIFIED");
    assert.equal(run.checks.range.status,"UNVERIFIED");
    assert.equal(run.checks.pagination.secondPage,"PASS");
    assert.equal(calls.length,2,"only the two provider API pages are fetched; media is not probed");
    assert.equal(calls[0].init.redirect,"error");
    assert.equal(db.saved.length,1);
    assert.equal((await listProviderDiagnostics(db,"souavzy")).length,1);
  } finally { globalThis.fetch=originalFetch; }
});

test("empty media allowlist stays unverified and cannot be widened by wildcard", async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({code:1,page:1,pagecount:0,total:0,limit:20,list:[]}),{status:200});
  try {
    const run=await runProviderDiagnostic(fakeDb(),provider);
    assert.deepEqual(run.sample.mediaHostCandidates,[]);
    assert.equal(run.checks.mediaHosts.status,"UNVERIFIED");
    assert.equal(run.checks.mime.status,"UNVERIFIED");
    assert.equal(run.checks.range.status,"UNVERIFIED");
  } finally { globalThis.fetch=originalFetch; }
});

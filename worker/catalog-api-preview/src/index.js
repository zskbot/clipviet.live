import { listProviders, getProviderCategories, listProviderVideos, getProviderVideo } from "../../telegram-api/src/applecms.js";
import { evaluateAdultGeoPolicy } from "./adult-geo-policy.mjs";

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    ...headers
  }});
}
function allowedOrigin(request, env) {
  const origin=request.headers.get("Origin");
  if (!origin) return "";
  const allowed=new Set(String(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean));
  if (allowed.has(origin)) return origin;
  try {
    const parsed=new URL(origin);
    const host=parsed.hostname.toLowerCase();
    const previewHost=host.endsWith(".clipviet-live-preview.pages.dev") ||
      host.endsWith(".clipviet-live-independent-preview.pages.dev");
    if (parsed.protocol==="https:" && previewHost && host.split(".").length===4) return origin;
  } catch {}
  return null;
}
function corsHeaders(origin) {
  return origin ? {
    "access-control-allow-origin":origin,
    "access-control-allow-methods":"GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers":"Accept, Range, Authorization, Content-Type",
    "access-control-expose-headers":"Accept-Ranges, Content-Range, Content-Length",
    "access-control-max-age":"600",
    "vary":"Origin"
  } : {};
}
function safeSecretCompare(candidate, expected) {
  const a=new TextEncoder().encode(String(candidate||""));
  const b=new TextEncoder().encode(String(expected||""));
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff|=a[i]^b[i];
  return diff===0;
}
function b64url(bytes) {
  let binary="";
  for(let i=0;i<bytes.length;i++) binary+=String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function signSession(payload, secret) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))));
}
async function issueSession(env) {
  const exp=Math.floor(Date.now()/1000)+14400;
  const nonce=b64url(crypto.getRandomValues(new Uint8Array(18)));
  const payload=exp+"."+nonce;
  return "v1."+payload+"."+await signSession(payload,env.ADMIN_SESSION_SECRET);
}
async function validSession(request, env) {
  if(!env.ADMIN_SESSION_SECRET) return false;
  const header=request.headers.get("Authorization")||"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  const parts=token.split(".");
  if(parts.length!==4||parts[0]!=="v1") return false;
  const exp=Number(parts[1]);
  if(!Number.isSafeInteger(exp)||exp<Math.floor(Date.now()/1000)||exp>Math.floor(Date.now()/1000)+14400) return false;
  const payload=parts[1]+"."+parts[2];
  const expected=await signSession(payload,env.ADMIN_SESSION_SECRET);
  if(expected.length!==parts[3].length) return false;
  let diff=0; for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^parts[3].charCodeAt(i);
  return diff===0;
}
const failedLogins=new Map();
async function handle(request, env) {
  const url=new URL(request.url), path=url.pathname.replace(/\/$/,"")||"/";
  const origin=allowedOrigin(request,env);
  if(origin===null) return json({error:"Origin not allowed"},403);
  const headers=corsHeaders(origin);
  if(path.startsWith("/api/admin/")&&!origin) return json({error:"Origin required"},403);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(path==="/api/adult"||path.startsWith("/api/adult/")) {
    const policy=evaluateAdultGeoPolicy(request,env);
    if(!policy.allowed) return json({error:"Adult content is not available in this location.",code:"ADULT_GEO_RESTRICTED",policy},451,headers);
    if(!policy.enabled) return json({error:"Adult catalog is disabled pending provider rights verification.",code:"ADULT_PROVIDER_RIGHTS_PENDING",policy},503,headers);
    return json({error:"Adult provider integration is not configured.",code:"ADULT_PROVIDER_NOT_CONFIGURED",policy},503,headers);
  }
  if(path==="/api/admin/login"&&request.method==="POST") {
    if(!env.ADMIN_PIN || !/^\d{6}$/.test(String(env.ADMIN_PIN))) return json({error:"Admin PIN is not configured as a six-digit Worker Secret."},503,headers);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const now=Date.now(), attempt=failedLogins.get(ip)||{count:0,first:now,blockedUntil:0};
    if(attempt.blockedUntil>now) return json({error:"Too many attempts. Try again later."},429,{"retry-after":String(Math.ceil((attempt.blockedUntil-now)/1000)),...headers});
    let body={}; try { body=await request.json(); } catch { return json({error:"Invalid request."},400,headers); }
    const pin=String(body.pin||"");
    if(!/^\d{6}$/.test(pin)||!safeSecretCompare(pin,env.ADMIN_PIN)) {
      const next=attempt.first+900000<now?{count:1,first:now,blockedUntil:0}:{...attempt,count:attempt.count+1};
      if(next.count>=5) next.blockedUntil=now+900000;
      failedLogins.set(ip,next);
      return json({error:next.blockedUntil>now?"Too many attempts. Try again in 15 minutes.":"Incorrect PIN."},next.blockedUntil>now?429:401,headers);
    }
    failedLogins.delete(ip);
    if(!env.ADMIN_SESSION_SECRET) return json({error:"Admin session signing secret is not configured."},503,headers);
    return json({ok:true,token:await issueSession(env),expiresIn:14400},200,headers);
  }
  if(path==="/api/admin/session"&&request.method==="GET") {
    return await validSession(request,env)?json({ok:true,role:"admin"},200,headers):json({error:"Admin session required"},401,headers);
  }
  if(path==="/api/admin/logout"&&request.method==="POST") {
    return await validSession(request,env)?json({ok:true},200,headers):json({error:"Admin session required"},401,headers);
  }
  if(path==="/api/public/articles"&&request.method==="GET") {
    if(!env.DB) return json({error:"CMS database is not configured"},503,headers);
    const slug=url.searchParams.get("slug");
    if(slug) {
      const row=await env.DB.prepare("SELECT id,slug,title,excerpt,body,published_at,updated_at FROM articles WHERE slug=? AND status='published'").bind(slug).first();
      return row?json({data:row},200,headers):json({error:"Article not found"},404,headers);
    }
    const rows=await env.DB.prepare("SELECT id,slug,title,excerpt,body,published_at,updated_at FROM articles WHERE status='published' ORDER BY published_at DESC, updated_at DESC LIMIT 100").all();
    return json({data:rows.results||[],count:rows.results?.length||0},200,headers);
  }
  if(path==="/api/admin/articles"&&(request.method==="GET"||request.method==="POST")) {
    if(!await validSession(request,env)) return json({error:"Admin session required"},401,headers);
    if(!env.DB) return json({error:"CMS database is not configured"},503,headers);
    if(request.method==="GET") {
      const rows=await env.DB.prepare("SELECT id,slug,title,excerpt,body,status,created_at,updated_at,published_at FROM articles ORDER BY updated_at DESC LIMIT 200").all();
      return json({data:rows.results||[],count:rows.results?.length||0},200,headers);
    }
    let body={}; try{body=await request.json();}catch{return json({error:"Invalid JSON body"},400,headers);}
    const title=String(body.title||"").trim(), slug=String(body.slug||"").trim().toLowerCase();
    const excerpt=String(body.excerpt||"").trim(), content=String(body.body||"");
    const status=body.status==="published"?"published":"draft";
    if(title.length<2||title.length>160||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>180||excerpt.length>320||content.length>50000)
      return json({error:"Invalid article fields or limits exceeded"},400,headers);
    const id=crypto.randomUUID(), now=new Date().toISOString(), publishedAt=status==="published"?now:null;
    try {
      await env.DB.prepare("INSERT INTO articles (id,slug,title,excerpt,body,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,slug,title,excerpt,content,status,now,now,publishedAt).run();
    } catch(error) { return json({error:"Could not save article. Check whether the slug already exists."},409,headers); }
    return json({ok:true,data:{id,slug,title,excerpt,body:content,status,created_at:now,updated_at:now,published_at:publishedAt}},201,headers);
  }
  const articleMatch=path.match(/^\/api\/admin\/articles\/([0-9a-f-]{36})$/i);
  if(articleMatch&&(request.method==="PUT"||request.method==="DELETE")) {
    if(!await validSession(request,env)) return json({error:"Admin session required"},401,headers);
    if(!env.DB) return json({error:"CMS database is not configured"},503,headers);
    const id=articleMatch[1];
    if(request.method==="DELETE") {
      const result=await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
      return result.meta?.changes?json({ok:true},200,headers):json({error:"Article not found"},404,headers);
    }
    let body={}; try{body=await request.json();}catch{return json({error:"Invalid JSON body"},400,headers);}
    const title=String(body.title||"").trim(), slug=String(body.slug||"").trim().toLowerCase();
    const excerpt=String(body.excerpt||"").trim(), content=String(body.body||"");
    const status=body.status==="published"?"published":"draft";
    if(title.length<2||title.length>160||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>180||excerpt.length>320||content.length>50000)
      return json({error:"Invalid article fields or limits exceeded"},400,headers);
    const now=new Date().toISOString();
    const existing=await env.DB.prepare("SELECT published_at FROM articles WHERE id=?").bind(id).first();
    if(!existing) return json({error:"Article not found"},404,headers);
    const publishedAt=status==="published"?(existing.published_at||now):null;
    try {
      await env.DB.prepare("UPDATE articles SET slug=?,title=?,excerpt=?,body=?,status=?,updated_at=?,published_at=? WHERE id=?")
        .bind(slug,title,excerpt,content,status,now,publishedAt,id).run();
    } catch(error) { return json({error:"Could not update article. Check whether the slug already exists."},409,headers); }
    return json({ok:true,data:{id,slug,title,excerpt,body:content,status,updated_at:now,published_at:publishedAt}},200,headers);
  }
  if(path.startsWith("/api/admin/")) {
    if(!await validSession(request,env)) return json({error:"Admin session required"},401,headers);
    return json({error:"Admin endpoint not implemented"},404,headers);
  }
  if(request.method!=="GET") return json({error:"Method not allowed"},405,{"allow":"GET, OPTIONS",...headers});
  if(path==="/health") return json({ok:true,service:"clipviet-catalog-api-preview",environment:"preview",providers:listProviders(env)},200,headers);
  if(path==="/api/providers") {
    const data=listProviders(env);
    return json({data,count:data.length,protocol:"AppleCMS V10"},200,headers);
  }
  if(path==="/api/catalog/categories") {
    const explicit=url.searchParams.get("sourceId");
    const candidates=explicit?[explicit]:["souavzy","apiyutu","lbapi9","slapibf","jipinvip1"];
    let lastError=null;
    for(const providerId of candidates) {
      try {
        const data=await getProviderCategories(providerId,env);
        return json({sourceId:providerId,data,count:data.length,failover:!explicit&&providerId!=="souavzy"},200,headers);
      } catch(error) { lastError=error; if(explicit) break; }
    }
    if (lastError?.status === 403) return json({
      success: true, data: [], count: 0,
      rightsGate: { policy: "deny-by-default", providerApproved: false, reason: "provider_pending_approval", playbackEnabled: false }
    }, 200, headers);
    return json({error:"All eligible providers failed",providerId:lastError?.providerId||explicit||"souavzy"},lastError?.status||502,headers);
  }
  if(path==="/api/catalog/videos") {
    const explicit=url.searchParams.get("sourceId"), categoryId=url.searchParams.get("categoryId")||undefined;
    const keyword=url.searchParams.get("keyword")||undefined, page=url.searchParams.get("page")||"1";
    const candidates=explicit?[explicit]:["souavzy","apiyutu","lbapi9","slapibf","jipinvip1"];
    let lastError=null, lastEmpty=null;
    for(const providerId of candidates) {
      try {
        const data=await listProviderVideos(providerId,{page,categoryId,keyword},env);
        if (Array.isArray(data.items) && data.items.length) return json({...data,failover:!explicit&&providerId!=="souavzy"},200,headers);
        if (data.rightsGate?.providerApproved === true) { lastEmpty=data; continue; }
        return json({...data,failover:!explicit&&providerId!=="souavzy"},200,headers);
      } catch(error) { lastError=error; if(explicit||categoryId) break; }
    }
    if (lastEmpty) return json({...lastEmpty,rightsGate:{...lastEmpty.rightsGate,reason:"no_approved_video_rights"}},200,headers);
    if (lastError?.status === 403) return json({
      success: true, items: [], data: [], results: [], total: 0,
      page: Number(page) || 1, pageCount: 0, limit: 30,
      rightsGate: { policy: "deny-by-default", providerApproved: false, approvedCount: 0, playbackEnabled: false, reason: "provider_pending_approval" }
    }, 200, headers);
    return json({error:"All eligible providers failed",providerId:lastError?.providerId||explicit||"souavzy"},lastError?.status||502,headers);
  }
  const match=path.match(/^\/api\/providers\/([a-z0-9-]+)\/(categories|videos)(?:\/([0-9]+))?$/);
  if(match) {
    const [,providerId,resource,videoId]=match;
    try {
      if(resource==="categories") {
        const data=await getProviderCategories(providerId,env);
        return json({sourceId:providerId,data,count:data.length},200,headers);
      }
      if(videoId) {
        const data=await getProviderVideo(providerId,videoId,env);
        return data?json({data},200,headers):json({error:"Video not found"},404,headers);
      }
      const data=await listProviderVideos(providerId,{
        page:url.searchParams.get("page")||"1",
        categoryId:url.searchParams.get("categoryId")||undefined,
        keyword:url.searchParams.get("keyword")||undefined
      },env);
      return json(data,200,headers);
    } catch(error) {
      return json({error:error?.message||"Provider request failed",providerId},error?.status||502,headers);
    }
  }
  return json({error:"Not found"},404,headers);
}
export default {async fetch(request,env) {
  try { return await handle(request,env); }
  catch(error) {
    console.error("catalog_api_error",error instanceof Error?error.message:"unknown");
    return json({error:"Internal server error"},500);
  }
}};

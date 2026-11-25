import { listProviders, getProviderCategories, listProviderVideos, getProviderVideo } from "../../telegram-api/src/applecms.js";

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
  return allowed.has(origin) ? origin : null;
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
function decodeBase64Url(value) {
  const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,"=");
  const binary=atob(padded);
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}
let accessJwksCache={expiresAt:0,keys:[]};
async function getAccessJwks(teamDomain) {
  if(accessJwksCache.expiresAt>Date.now()&&accessJwksCache.keys.length) return accessJwksCache.keys;
  const response=await fetch("https://"+teamDomain+"/cdn-cgi/access/certs",{
    headers:{accept:"application/json"},
    cf:{cacheTtl:600,cacheEverything:true}
  });
  if(!response.ok) throw new Error("Cloudflare Access signing keys unavailable");
  const payload=await response.json();
  if(!Array.isArray(payload.keys)||!payload.keys.length) throw new Error("Cloudflare Access signing keys missing");
  accessJwksCache={expiresAt:Date.now()+10*60*1000,keys:payload.keys};
  return accessJwksCache.keys;
}
async function accessIdentity(request,env) {
  const teamDomain=String(env.ACCESS_TEAM_DOMAIN||"").trim().toLowerCase();
  const audience=String(env.ACCESS_AUD||"").trim();
  const allowedEmails=new Set(String(env.ADMIN_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean));
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)||!audience||!allowedEmails.size) return null;
  const token=request.headers.get("cf-access-jwt-assertion")||"";
  const parts=token.split(".");
  if(parts.length!==3) return null;
  try {
    const header=decodeJwtPart(parts[0]);
    const claims=decodeJwtPart(parts[1]);
    if(header.alg!=="RS256"||typeof header.kid!=="string") return null;
    const now=Math.floor(Date.now()/1000);
    if(claims.iss!=="https://"+teamDomain) return null;
    const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(!audiences.includes(audience)) return null;
    if(!Number.isFinite(claims.exp)||claims.exp<=now) return null;
    if(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now+30)) return null;
    const email=String(claims.email||"").trim().toLowerCase();
    if(!allowedEmails.has(email)) return null;
    const jwks=await getAccessJwks(teamDomain);
    const jwk=jwks.find(key=>key.kid===header.kid&&key.kty==="RSA"&&(!key.use||key.use==="sig")&&(!key.alg||key.alg==="RS256"));
    if(!jwk) return null;
    const publicKey=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,decodeBase64Url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    return valid?{email,subject:String(claims.sub||"")}:null;
  } catch {
    return null;
  }
}
async function handle(request, env) {
  const url=new URL(request.url), path=url.pathname.replace(/\/$/,"")||"/";
  const origin=allowedOrigin(request,env);
  if(origin===null) return json({error:"Origin not allowed"},403);
  const headers=corsHeaders(origin);
  if(path.startsWith("/api/admin/")&&!origin) return json({error:"Origin required"},403);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
  let adminIdentity=null;
  if(path.startsWith("/api/admin/")&&request.method!=="OPTIONS") {
    adminIdentity=await accessIdentity(request,env);
    if(!adminIdentity) return json({error:"Cloudflare Access authentication required"},401,headers);
  }
  if(path==="/api/admin/session"&&request.method==="GET") {
    return json({ok:true,role:"admin"},200,headers);
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
    return json({error:"All eligible providers failed",providerId:lastError?.providerId||explicit||"souavzy"},lastError?.status||502,headers);
  }
  if(path==="/api/catalog/videos") {
    const explicit=url.searchParams.get("sourceId"), categoryId=url.searchParams.get("categoryId")||undefined;
    const keyword=url.searchParams.get("keyword")||undefined, page=url.searchParams.get("page")||"1";
    const candidates=explicit?[explicit]:["souavzy","apiyutu","lbapi9","slapibf","jipinvip1"];
    let lastError=null;
    for(const providerId of candidates) {
      try {
        const data=await listProviderVideos(providerId,{page,categoryId,keyword},env);
        return json({...data,failover:!explicit&&providerId!=="souavzy"},200,headers);
      } catch(error) { lastError=error; if(explicit||categoryId) break; }
    }
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

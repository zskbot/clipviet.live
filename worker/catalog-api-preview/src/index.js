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
    "access-control-allow-methods":"GET, POST, OPTIONS",
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
  if(path==="/api/admin/login"&&request.method==="POST") {
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const now=Date.now(), entry=failedLogins.get(ip)||{count:0,until:now+600000};
    if(now>entry.until){entry.count=0;entry.until=now+600000;}
    if(entry.count>=5) return json({error:"Quá nhiều lần đăng nhập sai. Thử lại sau 10 phút."},429,headers);
    let body={}; try{body=await request.json();}catch{return json({error:"Dữ liệu đăng nhập không hợp lệ."},400,headers);}
    const password=typeof body.password==="string"?body.password:"";
    if(!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET) return json({error:"Admin authentication secrets are not configured."},503,headers);
    if(!password||password.length>256||!safeSecretCompare(password,env.ADMIN_PASSWORD)) {
      entry.count++; failedLogins.set(ip,entry);
      return json({error:"Tài khoản hoặc mật khẩu không chính xác."},401,headers);
    }
    failedLogins.delete(ip);
    return json({ok:true,token:await issueSession(env),expiresIn:14400},200,headers);
  }
  if(path==="/api/admin/session"&&request.method==="GET") {
    return await validSession(request,env)?json({ok:true,role:"admin"},200,headers):json({error:"Admin session required"},401,headers);
  }
  if(path==="/api/admin/logout"&&request.method==="POST") {
    return await validSession(request,env)?json({ok:true},200,headers):json({error:"Admin session required"},401,headers);
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

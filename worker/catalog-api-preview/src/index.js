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
    "access-control-allow-methods":"GET, OPTIONS",
    "access-control-allow-headers":"Accept, Range",
    "access-control-expose-headers":"Accept-Ranges, Content-Range, Content-Length",
    "access-control-max-age":"600",
    "vary":"Origin"
  } : {};
}
async function handle(request, env) {
  const url=new URL(request.url), path=url.pathname.replace(/\/$/,"")||"/";
  const origin=allowedOrigin(request,env);
  if (origin===null) return json({error:"Origin not allowed"},403);
  const headers=corsHeaders(origin);
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers});
  if (request.method!=="GET") return json({error:"Method not allowed"},405,{"allow":"GET, OPTIONS",...headers});
  if (path==="/health") return json({ok:true,service:"clipviet-catalog-api-preview",environment:"preview",providers:listProviders(env)},200,headers);
  if (path==="/api/providers") {
    const data=listProviders(env);
    return json({data,count:data.length,protocol:"AppleCMS V10"},200,headers);
  }
  if (path==="/api/catalog/categories") {
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
  if (path==="/api/catalog/videos") {
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

const SOURCE_KEYS = [
  ["souavzy","APPLECMS_SOUAVZY_URL"],
  ["apiyutu","APPLECMS_APIYUTU_URL"],
  ["lbapi9","APPLECMS_LBAPI9_URL"],
  ["slapibf","APPLECMS_SLAPIBF_URL"],
  ["jipinvip1","APPLECMS_JIPINVIP1_URL"]
];
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=30, s-maxage=60","access-control-allow-origin":"*","x-content-type-options":"nosniff"}});
const asHttps = value => { try { const u=new URL(value); return u.protocol==="https:"?u.href:""; } catch { return ""; } };
const listOf = payload => { const candidates=[payload,payload?.list,payload?.data?.list,payload?.result?.list,payload?.data,payload?.videos]; return candidates.find(Array.isArray)||[]; };
const sourceConfig = env => SOURCE_KEYS.map(([id,key])=>({id,key,url:asHttps(env?.[key])})).filter(x=>x.url);
const parsePlayLines = item => {
  const from=String(item.vod_play_from||"").split("$$$");
  const urls=String(item.vod_play_url||"").split("$$$");
  return urls.map((line,index)=>{
    const episodes=line.split("#").map(part=>{
      const cut=part.lastIndexOf("$");
      if(cut<0)return null;
      const name=part.slice(0,cut).trim()||"Tập";
      const url=asHttps(part.slice(cut+1).trim());
      return url?{name,url,type:/\\.m3u8(?:$|\\?)/i.test(url)?"hls":"mp4"}:null;
    }).filter(Boolean);
    return {name:from[index]?.trim()||("Đường phát "+(index+1)),episodes};
  }).filter(line=>line.episodes.length);
};
const mapItem = (item,source) => ({
  id:String(item.vod_id??item.id??""),
  sourceId:source.id,
  title:String(item.vod_name??item.title??"Video chưa có tiêu đề"),
  description:String(item.vod_content??item.vod_blurb??item.description??""),
  poster:asHttps(item.vod_pic??item.poster??item.thumbnail_url??""),
  categoryName:String(item.type_name??item.vod_type??item.category??""),
  year:String(item.vod_year??item.year??""),
  area:String(item.vod_area??item.area??""),
  duration:String(item.vod_duration??item.duration??""),
  sourceName:source.id.toUpperCase(),
  apiManaged:true,
  playbackEnabled:Boolean(item.vod_play_url)
});
async function requestSource(source,params) {
  const url=new URL(source.url);
  for(const [key,value] of Object.entries(params)) if(value!==undefined&&value!==null&&value!=="") url.searchParams.set(key,String(value));
  const response=await fetch(url.href,{headers:{accept:"application/json"},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error(source.id+" HTTP "+response.status);
  return response.json();
}
export async function catalog(request,env) {
  const config=sourceConfig(env);
  if(!config.length)return json({success:false,error:"AppleCMS sources are not configured",required:SOURCE_KEYS.map(x=>x[1]),items:[],total:0,page:1,limit:30,pageCount:0},503);
  const u=new URL(request.url),page=Math.max(1,Math.min(100000,Number(u.searchParams.get("page"))||1)),limit=Math.max(1,Math.min(100,Number(u.searchParams.get("limit"))||30));
  const keyword=(u.searchParams.get("keyword")||u.searchParams.get("wd")||"").trim().slice(0,100);
  const category=(u.searchParams.get("categoryId")||u.searchParams.get("t")||"").trim();
  const settled=await Promise.allSettled(config.map(async source=>{
    const payload=await requestSource(source,{ac:"list",pg:page,pagesize:limit,limit,wd:keyword,t:category});
    const raw=listOf(payload);
    const pageCount=Math.max(1,Number(payload?.pagecount??payload?.data?.pagecount)||1);
    const total=Math.max(0,Number(payload?.total??payload?.data?.total)||pageCount*Number(payload?.limit??payload?.data?.limit??limit));
    return {source,items:raw.map(item=>mapItem(item,source)).filter(x=>x.id),pageCount,total};
  }));
  const sources=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);
  if(!sources.length)return json({success:false,error:"All AppleCMS sources failed",sources:settled.map((x,i)=>({source:config[i].id,ok:false,error:String(x.reason?.message||x.reason)})),items:[],total:0,page,pageCount:0},502);
  const items=sources.flatMap(x=>x.items),total=sources.reduce((sum,x)=>sum+x.total,0),pageCount=Math.max(...sources.map(x=>x.pageCount));
  return json({success:true,endpoint:"/api/videos",source:"applecms-workers",sources:sources.map(x=>({id:x.source.id,total:x.total,pageCount:x.pageCount})),failedSources:settled.map((x,i)=>x.status==="rejected"?{id:config[i].id,error:String(x.reason?.message||x.reason)}:null).filter(Boolean),items,data:items,results:items,total,page,limit:items.length||limit,pageCount,hasMore:page<pageCount});
}
export async function detail(request,env) {
  const u=new URL(request.url),sourceId=u.searchParams.get("sourceId")||"",vodId=u.searchParams.get("vodId")||"";
  const source=sourceConfig(env).find(x=>x.id===sourceId);
  if(!source||!vodId)return json({success:false,error:"Unknown source or missing vodId"},400);
  try {
    const payload=await requestSource(source,{ac:"detail",ids:vodId});
    const item=listOf(payload)[0];
    if(!item)return json({success:false,error:"Video not found at source"},404);
    const video=mapItem(item,source),lines=parsePlayLines(item);
    return json({success:true,data:{...video,lines},playbackEnabled:lines.length>0});
  } catch(error){return json({success:false,error:"AppleCMS detail request failed",detail:String(error?.message||error)},502);}
}

import { NextResponse } from "next/server";
import { getVideoFeed } from "@/lib/video-provider";
import { getMacCmsVideoById } from "@/lib/maccms-provider.mjs";
import { searchVideos } from "@/lib/video-search.mjs";
export const dynamic="force-dynamic"; export const revalidate=0;
function metadataOnly(video){const {videoUrl,playItems,embedUrl,...metadata}=video;return {...metadata,videoUrl:"",playItems:[],embedUrl:"",playbackAvailable:Boolean(videoUrl||(Array.isArray(playItems)&&playItems.length)||embedUrl)};}
export async function GET(request){
 try{
  const params=new URL(request.url).searchParams,id=params.get("id");
  if(id?.startsWith("maccms:")){
   const result=await getMacCmsVideoById(id);
   if(!result)return NextResponse.json({success:false,error:"Video metadata is not available or rights are pending."},{status:404});
   return NextResponse.json({success:true,result:metadataOnly(result),source:"maccms"},{headers:{"Cache-Control":"no-store"}});
  }
  const {results,source,providerStatus,providerErrors}=await getVideoFeed(),safeResults=results.map(metadataOnly);
  if(id){const result=safeResults.find(video=>video.id===id);if(!result)return NextResponse.json({success:false,error:"Video not found"},{status:404});return NextResponse.json({success:true,result,source},{headers:{"Cache-Control":"no-store"}});}
  let page;try{page=searchVideos(safeResults,params);}catch(error){return NextResponse.json({success:false,error:error.message},{status:400});}
  const pending=(providerStatus||[]).some(p=>p.state==="rights_pending"),failed=(providerStatus||[]).some(p=>p.state==="error");
  const catalogState=page.results.length?"READY":failed?"PROVIDERS_UNAVAILABLE":pending?"RIGHTS_PENDING":"NO_APPROVED_PROVIDERS";
  const message=page.results.length?null:pending?"Catalog đang chờ xác minh quyền metadata của nhà cung cấp và từng video.":failed?"Một hoặc nhiều nhà cung cấp đang lỗi; xem Provider Diagnostics.":"Chưa có video đủ điều kiện hiển thị. Không chèn video demo.";
  return NextResponse.json({success:true,...page,source,catalogState,message,providers:providerStatus||[],providerStatus:providerStatus||[],providerErrors:providerErrors||[],updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("[videos-api]",error);return NextResponse.json({success:false,error:"Video feed is temporarily unavailable"},{status:502,headers:{"Cache-Control":"no-store"}});}
}

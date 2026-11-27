import {NextResponse} from "next/server";
import {getMacCmsVideoById} from "@/lib/maccms-provider.mjs";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(_request,context){try{const params=await context.params,id=params?.id||"",video=await getMacCmsVideoById(id);
 if(!video)return NextResponse.json({success:false,enabled:false,error:"Video or provider rights are not approved for playback."},{status:403,headers:{"Cache-Control":"no-store"}});
 const sources=Array.isArray(video.playItems)?video.playItems:[];
 return NextResponse.json({success:true,enabled:sources.length>0,videoId:id,sources},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch{return NextResponse.json({success:false,enabled:false,error:"Playback authorization check failed."},{status:502,headers:{"Cache-Control":"no-store"}});}}

import {NextResponse} from "next/server";
import {diagnoseMacCmsProviders} from "@/lib/maccms-provider.mjs";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(){try{const providers=await diagnoseMacCmsProviders();return NextResponse.json({success:true,checkedAt:new Date().toISOString(),providers,
 summary:{total:providers.length,healthy:providers.filter(p=>p.diagnostic==="HEALTHY").length,pendingRights:providers.filter(p=>p.diagnostic==="PENDING_RIGHTS").length,errors:providers.filter(p=>p.operationalState==="ERROR").length}},
 {headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({success:false,error:"Provider diagnostics failed."},{status:502,headers:{"Cache-Control":"no-store"}});}}

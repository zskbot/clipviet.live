import {NextResponse} from "next/server";
import {getLegalProviderStatuses} from "@/lib/legal-video-providers";
import {getMacCmsProviderStatuses} from "@/lib/maccms-provider.mjs";
export const revalidate=0;
export async function GET(){return NextResponse.json({environment:process.env.VERCEL_ENV||process.env.NODE_ENV,providers:[...getMacCmsProviderStatuses(),...getLegalProviderStatuses()]},{headers:{"Cache-Control":"no-store"}});}

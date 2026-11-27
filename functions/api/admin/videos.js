import { adminVideosResponse } from "../../_lib/d1-catalog.js";
export async function onRequest({ request, env }) {
  try { return await adminVideosResponse(request, env); }
  catch (error) { return new Response(JSON.stringify({success:false,error:"Preview D1 Admin read failed",detail:String(error?.message||error)}),{status:503,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}}); }
}

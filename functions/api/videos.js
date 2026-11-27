import { videosResponse } from "../_lib/d1-catalog.js";
export async function onRequest({ request, env }) {
  try { return await videosResponse(request, env); }
  catch (error) {
    return new Response(JSON.stringify({ success:false, error:"Preview D1 catalog unavailable", detail:String(error?.message || error) }), {
      status:503, headers:{ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
    });
  }
}

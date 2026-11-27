import { detail } from "../_lib/applecms.js";
export async function onRequest({request,env}) {
  if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405,headers:{allow:"GET, HEAD"}});
  return detail(request,env);
}
// Dynamic item route keeps missing video IDs inside the JSON API contract.
import { onRequest as handleVideos } from "../videos.js";

export async function onRequest(context) {
  const id = typeof context.params?.id === "string" ? context.params.id : "";
  const url = new URL(context.request.url);
  if (id) url.searchParams.set("id", id);
  const request = new Request(url, {
    method: context.request.method,
    headers: context.request.headers
  });
  return handleVideos({ ...context, request });
}

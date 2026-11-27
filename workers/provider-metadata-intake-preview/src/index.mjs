import { handlePublicMetadataIntake } from "./public-intake.mjs";

export default {
  async fetch(request, env) {
    if (env.ENVIRONMENT !== "preview") {
      return new Response("Preview environment only.", { status: 404 });
    }
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/metadata-intake") {
      return handlePublicMetadataIntake(new Request(new URL("/metadata-intake", url), request), env);
    }
    return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
};

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }
    ],
    sitemap: "https://clipviet.live/sitemap.xml",
    host: "https://clipviet.live"
  };
}

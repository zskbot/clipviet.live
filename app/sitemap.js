export default function sitemap() {
  const now = new Date();
  return [
    { url: "https://clipviet.live/", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: "https://clipviet.live/providers", lastModified: now, changeFrequency: "weekly", priority: 0.5 }
  ];
}

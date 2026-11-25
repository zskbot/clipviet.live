# ClipViet Admin — Video API Preview

Route: `/admin/` (static frontend preview).

## What it does
- Accepts an HTTPS JSON API endpoint and optional Bearer token.
- Normalizes a JSON array or `results`, `videos`, `data` arrays.
- Reads `id`, `title`, `poster`/`thumbnail_url`, `videoUrl`/`video_url`/`url`, `category`.
- Plays direct HTTPS MP4/WebM URLs and native-HLS URLs where the browser supports HLS.
- Also accepts a direct HTTPS media URL without an API.

## Important limitations
- This is a browser-only preview utility. API URL is saved in localStorage on the current device; Bearer token is kept in sessionStorage for the current tab session.
- It does not write records to a server database or change the public catalogue.
- Browser fetch requires the provider to enable CORS for the Preview origin. The provider must return JSON.
- Native HLS support varies by browser. Safari/iOS supports HLS natively; other browsers may require an HLS playback library/server integration.
- There is no authenticated server-side admin backend in this static site. Do not treat this page as a protected production admin or enter privileged long-lived credentials.
- Only connect APIs and play media that you own or are authorized to access and distribute. Never expose private API keys in public source code.

## Provider response example
```json
{
  "results": [
    {
      "id": "clip-001",
      "title": "Demo clip",
      "category": "Documentary",
      "thumbnail_url": "https://cdn.example.com/poster.jpg",
      "video_url": "https://cdn.example.com/clip.mp4"
    }
  ]
}
```

(() => {
  const byId = (id) => document.getElementById(id);
  function init(kind) {
    const player = byId(kind === "audio" ? "audio-player" : "video-player");
    const urlInput = byId("media-url");
    const fileInput = byId("media-file");
    const status = byId("media-status");
    const queue = byId("queue");
    let currentObjectUrl = "";
    const safeUrl = (value) => {
      let url;
      try { url = new URL(value); } catch { throw new Error("URL không hợp lệ."); }
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Chỉ chấp nhận URL HTTPS không chứa thông tin đăng nhập.");
      return url.href;
    };
    const play = (src, label) => {
      if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = ""; }
      player.src = src;
      player.load();
      status.textContent = "Đang tải metadata: " + label;
      player.play().catch(() => { status.textContent = "Đã nạp media. Nhấn nút Play nếu trình duyệt chặn tự phát hoặc kiểm tra CORS/codec."; });
    };
    byId("load-url").addEventListener("click", () => {
      try { const src = safeUrl(urlInput.value.trim()); play(src, src); addQueue(src); }
      catch (error) { status.textContent = error.message; }
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const expected = kind === "audio" ? file.type.startsWith("audio/") : file.type.startsWith("video/");
      if (!expected) { status.textContent = "Tệp không đúng định dạng."; return; }
      currentObjectUrl = URL.createObjectURL(file);
      play(currentObjectUrl, file.name);
      addQueue(file.name);
    });
    function addQueue(label) {
      if (!queue) return;
      const item = document.createElement("li");
      item.textContent = label;
      queue.append(item);
    }
    player.addEventListener("error", () => { status.textContent = "Không phát được media. Kiểm tra URL, MIME, codec, CORS và quyền truy cập."; });
    player.addEventListener("playing", () => { status.textContent = "ĐANG PHÁT"; });
    player.addEventListener("ended", () => { status.textContent = "ĐÃ KẾT THÚC"; });
    window.addEventListener("pagehide", () => { if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl); });
  }
  window.ClipVietMedia = { init };
})();
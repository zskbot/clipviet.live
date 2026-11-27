(() => {
  const API = "http://127.0.0.1:8765";
  const byId = (id) => document.getElementById(id);
  const tokenInput = byId("bridge-token");
  const fileInput = byId("jasna-file");
  const rights = byId("rights-confirm");
  const consent = byId("consent-confirm");
  const startButton = byId("jasna-start");
  const downloadButton = byId("jasna-download");
  const bridgeStatus = byId("bridge-status");
  const jobStatus = byId("job-status");
  let bridgeReady = false;
  let activeJob = "";
  let outputName = "restored-video.mkv";

  function status(node, message, state = "info") {
    node.textContent = message;
    node.dataset.state = state;
  }
  function currentToken() { return tokenInput.value.trim(); }
  function updateControls() {
    startButton.disabled = !bridgeReady || !currentToken() || !fileInput.files?.[0] || !rights.checked || !consent.checked;
  }
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = currentToken();
    if (token) headers.set("X-ClipViet-Token", token);
    const response = await fetch(API + path, {
      ...options,
      headers,
      cache: "no-store",
      mode: "cors",
      credentials: "omit"
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.error || ("Local bridge HTTP " + response.status));
    return payload || response;
  }
  async function checkBridge() {
    bridgeReady = false;
    updateControls();
    status(bridgeStatus, "Đang kiểm tra 127.0.0.1:8765…");
    try {
      const health = await request("/health");
      if (!health.ok || !health.jasnaAvailable) throw new Error("Bridge đã chạy nhưng không tìm thấy Jasna CLI. Kiểm tra JASNA_BIN.");
      bridgeReady = true;
      status(bridgeStatus, "Đã kết nối local GPU bridge. Jasna CLI sẵn sàng.", "success");
    } catch (error) {
      status(bridgeStatus, error.message + " Hãy mở bridge trên máy tính rồi thử lại.", "error");
    }
    updateControls();
  }
  async function downloadResult() {
    if (!activeJob) return;
    try {
      const response = await fetch(API + "/jobs/" + encodeURIComponent(activeJob) + "/download", {
        headers: { "X-ClipViet-Token": currentToken() },
        cache: "no-store",
        mode: "cors",
        credentials: "omit"
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || ("Download HTTP " + response.status));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = outputName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      status(jobStatus, "Đã tạo tệp tải xuống: " + outputName, "success");
    } catch (error) {
      status(jobStatus, error.message, "error");
    }
  }
  async function pollJob(jobId) {
    activeJob = jobId;
    downloadButton.hidden = true;
    for (;;) {
      const job = await request("/jobs/" + encodeURIComponent(jobId));
      outputName = job.outputName || outputName;
      if (job.status === "completed") {
        status(jobStatus, "Xử lý hoàn tất. Tệp đang nằm trên máy local; nhấn nút tải xuống.", "success");
        downloadButton.hidden = false;
        return;
      }
      if (job.status === "failed") {
        throw new Error(job.error || "Jasna xử lý thất bại. Kiểm tra jasna.log trên máy tính.");
      }
      status(jobStatus, job.status === "queued" ? "Đang chờ GPU…" : "Jasna đang xử lý video trên GPU cục bộ…");
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }
  }
  byId("bridge-check").addEventListener("click", checkBridge);
  tokenInput.addEventListener("input", updateControls);
  fileInput.addEventListener("change", () => {
    downloadButton.hidden = true;
    const file = fileInput.files?.[0];
    status(jobStatus, file ? "Đã chọn " + file.name + " · " + (file.size / 1024 / 1024).toFixed(1) + " MB" : "Chưa có tệp.");
    updateControls();
  });
  rights.addEventListener("change", updateControls);
  consent.addEventListener("change", updateControls);
  startButton.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file || !currentToken() || !rights.checked || !consent.checked) return;
    startButton.disabled = true;
    downloadButton.hidden = true;
    status(jobStatus, "Đang gửi tệp trực tiếp tới bridge localhost. Không tải lên máy chủ ClipViet…");
    try {
      const accepted = await request("/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-ClipViet-Rights-Attested": "true",
          "X-ClipViet-Consent-Attested": "true"
        },
        body: file
      });
      status(jobStatus, "Đã tạo tác vụ " + accepted.id + ". Jasna sẽ xử lý trên GPU cục bộ…");
      await pollJob(accepted.id);
    } catch (error) {
      status(jobStatus, error.message, "error");
    } finally {
      updateControls();
    }
  });
  downloadButton.addEventListener("click", downloadResult);
  updateControls();
})();

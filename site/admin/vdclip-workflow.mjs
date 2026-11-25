const byId = (id) => document.getElementById(id);
const form = byId("vdclip-intake-form");
const status = byId("vdclip-status");
const output = byId("vdclip-packet");
const copyButton = byId("vdclip-copy-packet");
const openButton = byId("vdclip-open-app");

function httpsUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(label + " phải là URL hợp lệ."); }
  if (parsed.protocol !== "https:") throw new Error(label + " phải dùng HTTPS.");
  if (parsed.username || parsed.password) throw new Error(label + " không được chứa thông tin đăng nhập trong URL.");
  return parsed.href;
}

function buildPacket() {
  const sourceUrl = httpsUrl(byId("vdclip-source-url").value.trim(), "URL media nguồn");
  const evidenceUrl = httpsUrl(byId("vdclip-evidence-url").value.trim(), "URL hồ sơ quyền");
  const rightsRecord = byId("vdclip-rights-record").value.trim();
  const title = byId("vdclip-title").value.trim();
  const checkbox = byId("vdclip-rights-attested").checked;
  if (!rightsRecord) throw new Error("Cần mã hồ sơ quyền đã được ghi nhận trong Provider Registry.");
  if (!title) throw new Error("Cần tiêu đề nội dung.");
  if (!checkbox) throw new Error("Cần xác nhận đã kiểm tra quyền, độ tuổi và sự đồng thuận.");
  return {
    integration: "ClipViet.live -> VDClip (manual handoff)",
    status: "REVIEW_REQUIRED",
    source: { media_url: sourceUrl, title },
    rights: {
      registry_record_id: rightsRecord,
      evidence_url: evidenceUrl,
      operator_attestation: true,
      independently_verified_by_this_tool: false,
      public_distribution_enabled: false
    },
    processing: {
      destination: "VDClip web editor",
      method: "manual operator handoff",
      instruction: "Only proceed after an authorized reviewer independently verifies the rights record and source-specific permission."
    },
    created_at: new Date().toISOString()
  };
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const packet = buildPacket();
    output.textContent = JSON.stringify(packet, null, 2);
    status.textContent = "Đã tạo gói bàn giao. Trạng thái vẫn REVIEW_REQUIRED; chưa gửi video hoặc kích hoạt provider.";
    status.dataset.state = "ready";
    copyButton.disabled = false;
    openButton.disabled = false;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "error";
    copyButton.disabled = true;
    openButton.disabled = true;
    output.textContent = "Chưa tạo gói bàn giao.";
  }
});

copyButton?.addEventListener("click", async () => {
  if (!output.textContent || output.textContent.startsWith("Chưa")) return;
  try {
    await navigator.clipboard.writeText(output.textContent);
    status.textContent = "Đã sao chép gói bàn giao vào clipboard của thiết bị.";
  } catch {
    status.textContent = "Không thể truy cập clipboard. Hãy chọn và sao chép JSON hiển thị.";
  }
});

openButton?.addEventListener("click", () => {
  if (!output.textContent || output.textContent.startsWith("Chưa")) return;
  window.open("https://app.vdclip.com", "_blank", "noopener,noreferrer");
  status.textContent = "Đã mở VDClip. Hãy chỉ nhập media URL sau khi reviewer xác minh hồ sơ quyền; thao tác này không gửi dữ liệu tự động.";
});

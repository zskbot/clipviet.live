const $ = (id) => document.getElementById(id);
const root = $("provider-rows");
const status = $("provider-status");
const summary = $("review-summary");
const checklist = $("evidence-checklist");
$("year") && ($("year").textContent = new Date().getFullYear());

function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function statusLabel(value) {
  const labels = {
    PENDING: "CHỜ DUYỆT",
    VERIFIED: "ĐÃ XÁC MINH",
    APPROVED: "ĐÃ PHÊ DUYỆT",
    ENABLED: "ĐANG BẬT",
    NOT_CONFIGURED: "CHƯA CẤU HÌNH",
    DISABLED: "ĐÃ TẮT"
  };
  return labels[String(value || "").toUpperCase()] || String(value || "CHƯA RÕ").toUpperCase();
}
function providerCard(provider) {
  const article = node("article", undefined, "item");
  const info = node("div");
  info.append(
    node("strong", provider.name + " · " + provider.apiHost),
    node("small", "Provider: " + statusLabel(provider.providerStatus) + " · Connector: " + statusLabel(provider.connectorStatus)),
    node("small", "Quyền nội dung: " + provider.approvedContentRows + " APPROVED · " + provider.pendingContentRows + " PENDING · " + provider.rejectedContentRows + " REJECTED")
  );
  const pill = node("span", provider.approvedContentRows > 0 && provider.connectorStatus === "APPROVED" ? "CÓ HỒ SƠ ĐƯỢC DUYỆT" : "CHƯA ĐỦ ĐIỀU KIỆN", "status-pill");
  article.append(info, pill);
  return article;
}
function checklistItem(title, detail) {
  const li = node("li");
  li.append(node("strong", title), node("p", detail));
  checklist.append(li);
}
(async () => {
  try {
    const response = await fetch("../../api/admin/provider-review", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success !== true) throw new Error(payload.error || ("HTTP " + response.status));
    const providers = Array.isArray(payload.data) ? payload.data : [];
    root.replaceChildren();
    providers.forEach(provider => root.append(providerCard(provider)));
    const approved = Number(payload.approvedProviders || 0);
    const connectors = Number(payload.approvedConnectors || 0);
    const rights = Number(payload.approvedContentRows || 0);
    $("provider-total").textContent = providers.length + " PROVIDERS";
    $("approved-total").textContent = approved + " PROVIDERS APPROVED";
    $("connector-total").textContent = connectors + " CONNECTORS APPROVED";
    $("rights-total").textContent = rights + " RIGHTS ROWS APPROVED";
    $("page-total").textContent = Number(payload.eligiblePageCountAtPageSize30 || 0) + " ELIGIBLE PAGES";
    summary.textContent = "Đọc trực tiếp D1 Preview · " + (payload.mode || "read-only") + " · " + new Date().toLocaleString("vi-VN");
    checklist.replaceChildren();
    checklistItem("1. Chủ thể nắm quyền", "Tên pháp nhân/chủ sở hữu nội dung và thông tin liên hệ có thể xác minh.");
    checklistItem("2. Giấy phép phân phối", "Hợp đồng hoặc văn bản cấp quyền nêu rõ lãnh thổ, thời hạn, nền tảng, quyền lưu trữ, hiển thị và phát trực tuyến.");
    checklistItem("3. Bằng chứng theo từng video", "Mỗi video phải có source_content_id, URL nguồn, chủ sở hữu quyền, license reference và bằng chứng riêng.");
    checklistItem("4. Độ tuổi và sự đồng thuận", "Xác minh người biểu diễn là người trưởng thành và có sự đồng thuận hợp lệ; loại trừ nội dung rò rỉ, quay lén, cưỡng ép hoặc không rõ nguồn gốc.");
    checklistItem("5. Connector và phạm vi kỹ thuật", "Tài liệu API chính thức, phương thức xác thực, scope, khu vực, chế độ playback được cấp phép và thời hạn credential.");
    checklistItem("6. Kiểm tra lại trước khi bật", "Chỉ người có thẩm quyền mới chuyển trạng thái sau khi rà soát bằng chứng; mọi thay đổi phải có audit trail.");
    status.textContent = "Đã tải " + providers.length + " provider. Endpoint chỉ GET/HEAD; không crawl nguồn, không lấy danh sách video và không có thao tác ghi.";
  } catch (error) {
    root.replaceChildren(node("p", "Không tải được registry D1 Preview: " + error.message, "source-note"));
    status.textContent = "Không thể xác minh trạng thái hiện tại. Không sử dụng dữ liệu cache hoặc số liệu suy đoán.";
  }
})();

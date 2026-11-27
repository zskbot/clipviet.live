const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", apiHost: "api.souavzy.vip", apiBaseUrl: "https://api.souavzy.vip/api.php/provide/vod/" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", apiHost: "apiyutu.com", apiBaseUrl: "https://apiyutu.com/api.php/provide/vod/" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", apiHost: "lbapi9.com", apiBaseUrl: "https://lbapi9.com/api.php/provide/vod/" },
  { id: "slapibf", name: "Slapibf · Backup 3", apiHost: "slapibf.com", apiBaseUrl: "https://slapibf.com/api.php/provide/vod/" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", apiHost: "jipinvip1.com", apiBaseUrl: "https://jipinvip1.com/api.php/provide/vod/" }
];

const clean = (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
function safeHttps(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (!url.hostname.includes(".") || url.hostname === "localhost" || /^\d+(?:\.\d+){3}$/.test(url.hostname)) return null;
    if ([...url.searchParams.keys()].some(key => /key|token|secret|password|auth/i.test(key))) return null;
    return url.toString();
  } catch { return null; }
}

export function validateMetadataIntake(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Dữ liệu gửi lên không hợp lệ." };
  if (clean(input.website, 200)) return { error: "Yêu cầu không hợp lệ." };
  const provider = PROVIDERS.find(item => item.id === clean(input.providerId, 40));
  if (!provider) return { error: "Vui lòng chọn một provider có trong danh sách." };
  const rightsHolder = clean(input.rightsHolder, 180);
  const licenseReference = clean(input.licenseReference, 240);
  const evidenceUrl = safeHttps(input.evidenceUrl);
  const documentationUrl = safeHttps(input.documentationUrl);
  const licenseExpiresAt = clean(input.licenseExpiresAt, 40);
  const expiry = Date.parse(licenseExpiresAt);
  const regions = Array.isArray(input.regions) ? [...new Set(input.regions.map(x => clean(x, 8).toUpperCase()).filter(x => ["VN", "GLOBAL"].includes(x)))] : [];
  const contactEmail = clean(input.contactEmail, 180);
  if (!rightsHolder || !licenseReference || !evidenceUrl || !documentationUrl || !Number.isFinite(expiry) || expiry <= Date.now()) {
    return { error: "Cần có chủ thể quyền, mã giấy phép, URL bằng chứng, tài liệu API và ngày hết hạn trong tương lai." };
  }
  if (!regions.length) return { error: "Cần chọn phạm vi phân phối metadata (VN hoặc GLOBAL)." };
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { error: "Email liên hệ không hợp lệ." };
  return { data: { provider, rightsHolder, licenseReference, evidenceUrl, documentationUrl, licenseExpiresAt: new Date(expiry).toISOString(), regions, contactEmail, note: clean(input.note, 1000) } };
}

function page() {
  const options = PROVIDERS.map(p => `<option value="${p.id}">${p.name} — ${p.apiHost}</option>`).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClipViet · Metadata Provider Setup</title><style>
  :root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#050505;color:#f5f5f5}*{box-sizing:border-box}body{margin:0;padding:24px 16px}.wrap{max-width:760px;margin:0 auto}.eyebrow{font-size:11px;letter-spacing:.18em;color:#f87171}h1{font-size:clamp(25px,6vw,42px);margin:12px 0}p{color:#a3a3a3;line-height:1.65;font-size:13px}.notice{border:1px solid #854d0e;background:#451a031f;padding:14px;color:#fde68a;margin:20px 0;font-size:12px;line-height:1.6}form{border:1px solid #333;padding:18px;display:grid;gap:14px}.field{display:grid;gap:7px}label{font-size:11px;color:#a3a3a3}input,select,textarea{width:100%;background:#090909;border:1px solid #444;color:#fff;padding:12px;font:inherit;font-size:13px;border-radius:0}button{background:#fff;color:#000;border:1px solid #fff;padding:14px;font:inherit;font-weight:800;border-radius:0}button:disabled{opacity:.5}small{color:#737373;font-size:11px;line-height:1.5}.status{white-space:pre-wrap;border:1px solid #333;padding:12px;display:none;font-size:12px}.check{display:flex;gap:10px;align-items:flex-start}.check input{width:auto;margin-top:2px}.hp{position:absolute;left:-10000px}
  </style></head><body><main class="wrap"><div class="eyebrow">CLIPVIET / PUBLIC PREVIEW SETUP</div><h1>Metadata Provider Intake</h1><p>Khai báo nguồn API và gửi bằng chứng cho phép ClipViet hiển thị metadata như tên phim, ảnh poster, mô tả và danh mục. Không cần tài khoản, token hay API secret.</p><div class="notice"><b>METADATA_ONLY · PLAYBACK LOCKED</b><br>Biểu mẫu công khai chỉ tạo hồ sơ PENDING_REVIEW. Không tự duyệt provider, không cấp quyền phát video, không nhập URL stream và không bật playback. Provider chỉ được đưa vào catalog sau khi hồ sơ quyền được người có thẩm quyền xem xét.</div><form id="form"><div class="field"><label>PROVIDER</label><select name="providerId" required><option value="">Chọn nguồn</option>${options}</select></div><div class="field"><label>RIGHTS HOLDER / ĐƠN VỊ CẤP QUYỀN</label><input name="rightsHolder" required maxlength="180"></div><div class="field"><label>LICENSE REFERENCE / MÃ GIẤY PHÉP</label><input name="licenseReference" required maxlength="240"></div><div class="field"><label>EVIDENCE URL / BẰNG CHỨNG CẤP QUYỀN (HTTPS)</label><input name="evidenceUrl" type="url" placeholder="https://" required></div><div class="field"><label>API DOCUMENTATION URL (HTTPS)</label><input name="documentationUrl" type="url" placeholder="https://" required></div><div class="field"><label>LICENSE EXPIRY / NGÀY HẾT HẠN</label><input name="licenseExpiresAt" type="date" required></div><div class="field"><label>PHẠM VI ĐƯỢC PHÉP</label><div class="check"><input type="checkbox" name="regions" value="VN"><label>Việt Nam (VN)</label></div><div class="check"><input type="checkbox" name="regions" value="GLOBAL"><label>Toàn cầu (GLOBAL)</label></div></div><div class="field"><label>EMAIL LIÊN HỆ (KHÔNG BẮT BUỘC)</label><input name="contactEmail" type="email" maxlength="180"></div><div class="field"><label>GHI CHÚ</label><textarea name="note" rows="3" maxlength="1000"></textarea></div><div class="hp"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="check"><input type="checkbox" name="attest" required><label>Tôi xác nhận có quyền gửi hồ sơ và bằng chứng này cho mục đích xem xét metadata_only. Tôi hiểu việc gửi biểu mẫu không đồng nghĩa với phê duyệt.</label></div><button id="submit" type="submit">GỬI HỒ SƠ METADATA</button><div id="status" class="status" role="status"></div></form><p>Không gửi API key, mật khẩu, cookie, token, URL phát video hoặc dữ liệu cá nhân nhạy cảm. Dữ liệu gửi lên sẽ được lưu ở trạng thái chờ duyệt trong Preview.</p></main><script>
  const form=document.querySelector("#form"),button=document.querySelector("#submit"),status=document.querySelector("#status");
  form.addEventListener("submit",async event=>{event.preventDefault();button.disabled=true;status.style.display="block";status.textContent="Đang gửi hồ sơ…";const f=new FormData(form);const body={providerId:f.get("providerId"),rightsHolder:f.get("rightsHolder"),licenseReference:f.get("licenseReference"),evidenceUrl:f.get("evidenceUrl"),documentationUrl:f.get("documentationUrl"),licenseExpiresAt:f.get("licenseExpiresAt"),regions:f.getAll("regions"),contactEmail:f.get("contactEmail"),note:f.get("note"),website:f.get("website"),metadataOnlyAttestation:f.get("attest")==="on"};try{const response=await fetch("/metadata-intake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Không thể gửi hồ sơ.");status.textContent="ĐÃ TIẾP NHẬN · "+data.intakeId+"\nTrạng thái: PENDING_REVIEW\nPlayback vẫn bị khóa.";form.reset();}catch(error){status.textContent="LỖI · "+error.message;}finally{button.disabled=false;}});
  </script></body></html>`;
}

export async function handlePublicMetadataIntake(request, env, cors = {}) {
  if (request.method === "GET") return new Response(page(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...cors } });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET, POST, OPTIONS", ...cors } });
  if (!env.PROVIDER_DB) return new Response(JSON.stringify({ error: "Preview D1 binding is not configured." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return new Response(JSON.stringify({ error: "Request body too large." }), { status: 413, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
    body = JSON.parse(raw || "{}");
  } catch { return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }); }
  if (body.metadataOnlyAttestation !== true) return new Response(JSON.stringify({ error: "Metadata-only attestation is required." }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
  const parsed = validateMetadataIntake(body);
  if (parsed.error) return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
  const d = parsed.data, id = crypto.randomUUID(), now = new Date().toISOString();
  try {
    await env.PROVIDER_DB.prepare(`INSERT INTO provider_metadata_intake
      (id,provider_id,provider_name,api_host,api_base_url,rights_holder,license_reference,evidence_url,documentation_url,license_expires_at,regions_json,contact_email,note,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING_REVIEW',?,?)`)
      .bind(id,d.provider.id,d.provider.name,d.provider.apiHost,d.provider.apiBaseUrl,d.rightsHolder,d.licenseReference,d.evidenceUrl,d.documentationUrl,d.licenseExpiresAt,JSON.stringify(d.regions),d.contactEmail,d.note,now,now).run();
    return new Response(JSON.stringify({ success: true, intakeId: id, status: "PENDING_REVIEW", playbackEnabled: false, playbackMode: "none" }), { status: 201, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...cors } });
  } catch {
    return new Response(JSON.stringify({ error: "Could not save the intake record. Apply the Preview migration and retry." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
  }
}

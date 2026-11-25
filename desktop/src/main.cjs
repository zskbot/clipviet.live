const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const https = require("node:https");
const http = require("node:http");

let win;
const jobs = new Map();
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const secretFile = () => path.join(app.getPath("userData"), "clipviet-token.bin");

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), "utf8")); }
  catch { return { binaryPath: "", apiBase: "", allowedHosts: [] }; }
}
function writeSettings(value) {
  const safe = {
    binaryPath: String(value.binaryPath || "").slice(0, 1024),
    apiBase: String(value.apiBase || "").slice(0, 2048),
    allowedHosts: [...new Set((value.allowedHosts || []).map(x => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 100)
  };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(safe, null, 2), { mode: 0o600 });
  return safe;
}
function validHttpsUrl(input) {
  let u;
  try { u = new URL(input); } catch { throw new Error("URL không hợp lệ."); }
  if (u.protocol !== "https:" || u.username || u.password) throw new Error("Chỉ chấp nhận HTTPS URL không chứa thông tin đăng nhập.");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "127.0.0.1" || h === "::1" || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) throw new Error("Không cho phép địa chỉ local/private.");
  return { url: u.toString(), host: h };
}
function validPreviewApiUrl(input) {
  const parsed = validHttpsUrl(input);
  if (!parsed.host.endsWith(".clipviet-live-independent-preview.pages.dev")) {
    throw new Error("ClipViet API chỉ được kết nối tới Pages Preview độc lập; Production/custom domain bị chặn.");
  }
  return parsed.url;
}
function requireAllowed(url, settings) {
  const parsed = validHttpsUrl(url);
  if (!settings.allowedHosts.includes(parsed.host)) throw new Error("Host chưa có trong allowlist cục bộ. Hãy thêm host sau khi xác minh quyền sử dụng.");
  return parsed;
}
function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const req = client.get(target, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, timeout: 12000 }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; if (body.length > 2_000_000) req.destroy(new Error("API response quá lớn.")); });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`ClipViet API trả HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error("API không trả JSON hợp lệ.")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Hết thời gian chờ API.")));
    req.on("error", reject);
  });
}
function publish() {
  if (win && !win.isDestroyed()) win.webContents.send("jobs:update", [...jobs.values()]);
}
function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 760, minWidth: 760, minHeight: 560,
    backgroundColor: "#05070f",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, target) => { if (!target.startsWith("file://")) event.preventDefault(); });
  win.loadFile(path.join(__dirname, "index.html"));
}
app.whenReady().then(() => {
  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:save", (_e, value) => writeSettings(value));
  ipcMain.handle("token:save", (_e, token) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Mã hóa hệ điều hành chưa khả dụng; không lưu token.");
    fs.writeFileSync(secretFile(), safeStorage.encryptString(String(token || "")), { mode: 0o600 });
    return true;
  });
  ipcMain.handle("catalog:load", async () => {
    const s = readSettings();
    if (!s.apiBase) throw new Error("Chưa cấu hình ClipViet API URL.");
    const base = validHttpsUrl(s.apiBase).url.replace(/\/$/, "");
    const token = fs.existsSync(secretFile()) && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(fs.readFileSync(secretFile())) : "";
    const data = await requestJson(base + "/api/admin/videos", token);
    return Array.isArray(data) ? data : (data.videos || data.results || data.data || []);
  });
  ipcMain.handle("download:start", async (_e, payload) => {
    const s = readSettings();
    if (!payload || payload.rightsConfirmed !== true) throw new Error("Xác nhận quyền tải xuống/phân phối là bắt buộc.");
    const { url, host } = requireAllowed(payload.url, s);
    if (!s.binaryPath || !fs.existsSync(s.binaryPath)) throw new Error("Chưa chọn executable N_m3u8DL-RE hợp lệ.");
    const folder = path.resolve(payload.outputDir || path.join(app.getPath("downloads"), "ClipViet"));
    fs.mkdirSync(folder, { recursive: true });
    const name = String(payload.name || "clipviet-media").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80) || "clipviet-media";
    const id = require("node:crypto").randomUUID();
    const args = [url, "--save-dir", folder, "--save-name", name];
    const child = spawn(s.binaryPath, args, { shell: false, windowsHide: true });
    const job = { id, url, host, name, folder, status: "running", output: "", startedAt: new Date().toISOString() };
    jobs.set(id, job);
    const append = chunk => { job.output = (job.output + chunk.toString()).slice(-12000); publish(); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", err => { job.status = "error"; append(err.message); publish(); });
    child.on("close", code => { job.status = code === 0 ? "completed" : "failed"; job.exitCode = code; job.finishedAt = new Date().toISOString(); publish(); });
    publish();
    return { id };
  });
  ipcMain.handle("dialog:binary", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile"] });
    return r.canceled ? "" : r.filePaths[0];
  });
  ipcMain.handle("dialog:folder", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return r.canceled ? "" : r.filePaths[0];
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

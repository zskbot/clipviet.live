const enc = new TextEncoder();
const ITERATIONS = 310000;
const SESSION_SECONDS = 60 * 60 * 12;
const EMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", ...headers }
});
const hex = bytes => [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
const random = (n=32) => crypto.getRandomValues(new Uint8Array(n));
async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", typeof value==="string" ? enc.encode(value) : value)); }
function b64(bytes) { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); }
function fromB64(value) { return Uint8Array.from(atob(value),c=>c.charCodeAt(0)); }
function equal(a,b) { const x=enc.encode(a||""),y=enc.encode(b||""); if(!x.length||x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0; }
function cookie(request,name) { const raw=request.headers.get("cookie")||""; for(const item of raw.split(";")){const i=item.indexOf("=");if(i>0&&item.slice(0,i).trim()===name)return item.slice(i+1).trim();}return ""; }
function cookieHeader(value,maxAge) { return "cv_session="+value+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge; }
function clearCookie() { return "cv_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"; }
async function passwordHash(password,salt,iterations=ITERATIONS) {
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256));
}
function normalizeEmail(value) { return typeof value==="string" ? value.trim().toLowerCase() : ""; }
async function readBody(request) {
  const length=Number(request.headers.get("content-length")||0); if(length>4096)return null;
  const raw=await request.text(); if(raw.length>4096)return null;
  try{return JSON.parse(raw||"{}")}catch{return null}
}
function sameOrigin(request) { const origin=request.headers.get("origin"); return !origin || origin===new URL(request.url).origin; }
async function newSession(db,userId) {
  const token=b64(random(32)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const now=new Date(), expires=new Date(now.getTime()+SESSION_SECONDS*1000).toISOString();
  await db.prepare("INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?)")
    .bind(await digest(token),userId,expires,now.toISOString(),now.toISOString()).run();
  return token;
}
async function rateLimit(db,email,ip) {
  const bucket=await digest(email+"|"+ip), now=Date.now();
  const row=await db.prepare("SELECT failures,window_started_at,locked_until FROM auth_rate_limits WHERE bucket_hash=?").bind(bucket).first();
  if(row?.locked_until && Date.parse(row.locked_until)>now)return {blocked:true,bucket};
  if(!row || now-Date.parse(row.window_started_at)>15*60*1000) {
    await db.prepare("INSERT INTO auth_rate_limits(bucket_hash,failures,window_started_at,locked_until) VALUES(?,0,?,NULL) ON CONFLICT(bucket_hash) DO UPDATE SET failures=0,window_started_at=excluded.window_started_at,locked_until=NULL")
      .bind(bucket,new Date(now).toISOString()).run();
  }
  return {blocked:false,bucket};
}
async function failedLogin(db,bucket) {
  const now=new Date(), row=await db.prepare("SELECT failures,window_started_at FROM auth_rate_limits WHERE bucket_hash=?").bind(bucket).first();
  const fresh=!row || now.getTime()-Date.parse(row.window_started_at)>15*60*1000;
  const failures=(fresh?0:Number(row.failures||0))+1;
  const locked=failures>=5?new Date(now.getTime()+15*60*1000).toISOString():null;
  await db.prepare("INSERT INTO auth_rate_limits(bucket_hash,failures,window_started_at,locked_until) VALUES(?,?,?,?) ON CONFLICT(bucket_hash) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until")
    .bind(bucket,failures,fresh?now.toISOString():row.window_started_at,locked).run();
}
export async function sessionRole(request,env) {
  if(!env.PROVIDER_DB)return "";
  const token=cookie(request,"cv_session"); if(!token || token.length>128)return "";
  try {
    const row=await env.PROVIDER_DB.prepare("SELECT u.role,u.active,s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=?")
      .bind(await digest(token)).first();
    if(!row || row.active!==1 || Date.parse(row.expires_at)<=Date.now())return "";
    return row.role;
  } catch { return ""; }
}
export async function handleAuth(request,env) {
  const url=new URL(request.url), path=url.pathname, db=env.PROVIDER_DB;
  if(!db)return json({error:"Preview D1 is unavailable."},503);
  if(request.method==="GET"&&path==="/login")return authPage();
  if(request.method==="GET"&&path==="/auth/status") {
    const row=await db.prepare("SELECT COUNT(*) AS count FROM auth_users").first();
    return json({setupRequired:Number(row?.count||0)===0});
  }
  if(request.method==="GET"&&path==="/auth/me") {
    const role=await sessionRole(request,env); return role?json({authenticated:true,role}):json({authenticated:false},401);
  }
  if(!sameOrigin(request))return json({error:"Origin mismatch."},403);
  if(request.method==="POST"&&path==="/auth/bootstrap") {
    const body=await readBody(request);
    if(!body)return json({error:"Invalid request."},400);
    const email=normalizeEmail(body.email), password=typeof body.password==="string"?body.password:"";
    if(!EMAIL_RE.test(email)||password.length<8||password.length>128)return json({error:"Use a Gmail address and a password between 8 and 128 characters."},400);
    if(typeof env.AUTH_BOOTSTRAP_TOKEN!=="string"||!env.AUTH_BOOTSTRAP_TOKEN||!equal(body.bootstrapToken,env.AUTH_BOOTSTRAP_TOKEN))return json({error:"Bootstrap token is invalid or not configured."},403);
    const count=await db.prepare("SELECT COUNT(*) AS count FROM auth_users").first();
    if(Number(count?.count||0)!==0)return json({error:"Initial administrator has already been created."},409);
    const salt=random(16), hash=await passwordHash(password,salt), id=crypto.randomUUID(), now=new Date().toISOString();
    try {
      await db.prepare("INSERT INTO auth_users(id,email,password_hash,password_salt,password_iterations,role,active,created_at,last_login_at) VALUES(?,?,?,?,?,'admin',1,?,?)")
        .bind(id,email,hash,b64(salt),ITERATIONS,now,now).run();
      const token=await newSession(db,id);
      return json({ok:true,role:"admin"},200,{"set-cookie":cookieHeader(token,SESSION_SECONDS)});
    } catch { return json({error:"Account initialization failed; reload and try again."},409); }
  }
  if(request.method==="POST"&&path==="/auth/login") {
    const body=await readBody(request); if(!body)return json({error:"Invalid request."},400);
    const email=normalizeEmail(body.email), password=typeof body.password==="string"?body.password:"";
    if(!EMAIL_RE.test(email)||!password||password.length>128)return json({error:"Invalid email or password."},400);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown", limit=await rateLimit(db,email,ip);
    if(limit.blocked)return json({error:"Too many attempts. Try again in 15 minutes."},429);
    const user=await db.prepare("SELECT id,password_hash,password_salt,password_iterations,role,active FROM auth_users WHERE email=?").bind(email).first();
    const salt=user?.password_salt?fromB64(user.password_salt):random(16);
    const calculated=await passwordHash(password,salt,Number(user?.password_iterations||ITERATIONS));
    if(!user||user.active!==1||!equal(calculated,user.password_hash)) {
      await failedLogin(db,limit.bucket); return json({error:"Invalid email or password."},401);
    }
    await db.prepare("DELETE FROM auth_rate_limits WHERE bucket_hash=?").bind(limit.bucket).run();
    const now=new Date().toISOString();
    await db.prepare("UPDATE auth_users SET last_login_at=? WHERE id=?").bind(now,user.id).run();
    await db.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(now).run();
    const token=await newSession(db,user.id);
    return json({ok:true,role:user.role},200,{"set-cookie":cookieHeader(token,SESSION_SECONDS)});
  }
  if(request.method==="POST"&&path==="/auth/logout") {
    const token=cookie(request,"cv_session");
    if(token)await db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"set-cookie":clearCookie()});
  }
  return json({error:"Not found."},404);
}
function authPage() {
 const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050505"><meta name="color-scheme" content="dark"><title>ClipViet · Đăng nhập</title>
<style>
:root{color-scheme:dark;--bg:#050505;--panel:#0a0a0a;--line:#303030;--fg:#f5f5f5;--muted:#a1a1aa;--accent:#ef4444}*{box-sizing:border-box}
html{min-width:320px;min-height:100%;background:var(--bg);-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;min-height:100svh;min-height:100dvh;background:var(--bg);color:var(--fg);font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;padding:clamp(12px,4vw,28px);padding-top:max(clamp(12px,4vw,28px),env(safe-area-inset-top));padding-bottom:max(clamp(12px,4vw,28px),env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;overflow-x:hidden}
main{width:100%;max-width:440px;min-width:0;margin:auto}.panel{width:100%;min-width:0;border:1px solid var(--line);background:var(--panel);padding:clamp(16px,5vw,28px)}
.brand{display:flex;align-items:center;gap:12px;min-width:0;margin-bottom:24px}.brand-mark{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border:1px solid var(--accent);color:#fff}
.brand-name{font-size:16px;font-weight:800;letter-spacing:.09em;line-height:1.2}.brand-domain{font-size:10px;letter-spacing:.14em;color:var(--muted);margin-top:4px}
.tag{color:var(--accent);font-size:10px;letter-spacing:.18em}h1{font-size:clamp(20px,6vw,25px);line-height:1.25;margin:10px 0}
p{color:var(--muted);line-height:1.65;margin:10px 0 18px;overflow-wrap:anywhere}form{width:100%;min-width:0}
label{display:block;margin:18px 0 8px;color:#c4c4c4;font-size:11px;letter-spacing:.08em}
input{display:block;width:100%;max-width:100%;min-width:0;height:52px;border:1px solid #484848;background:#080808;color:#fff;padding:0 13px;border-radius:0;font:16px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none;appearance:none;-webkit-appearance:none}
input:focus-visible{border-color:#fff;outline:2px solid var(--accent);outline-offset:2px}
button{display:block;width:100%;min-width:0;min-height:52px;margin-top:20px;padding:12px 16px;border:1px solid var(--accent);background:#151515;color:#fff;border-radius:0;font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
button:active{background:#262626}button:focus-visible{outline:2px solid #fff;outline-offset:3px}button:disabled{opacity:.55;cursor:wait}
.error{color:#ff9b9b;white-space:pre-wrap;overflow-wrap:anywhere}.hidden{display:none!important}.note{font-size:10px;color:#777;margin:20px 0 0}.helper{font-size:11px;color:#858585;margin:8px 0 0}
@media(max-width:380px){body{padding-left:12px;padding-right:12px}.panel{padding:16px}.brand{margin-bottom:20px}.brand-mark{width:38px;height:38px;flex-basis:38px}}
</style></head><body><main><section class="panel" aria-labelledby="page-title">
<header class="brand"><div class="brand-mark" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24"><path d="M5 3.8 20 12 5 20.2V3.8Z" fill="currentColor"/></svg></div><div><div class="brand-name">CLIPVIET</div><div class="brand-domain">CLIPVIET.LIVE</div></div></header>
<div class="tag">SECURE ACCESS / PREVIEW</div><h1 id="page-title">Đăng nhập quản trị</h1><p>Sử dụng địa chỉ Gmail và mật khẩu riêng của ClipViet. Không nhập mật khẩu Google.</p>
<form id="login" novalidate><label for="login-email">GMAIL</label><input id="login-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="name@gmail.com" required><label for="login-password">MẬT KHẨU</label><input id="login-password" name="password" type="password" autocomplete="current-password" required><button id="submit" type="submit">ĐĂNG NHẬP</button></form>
<form id="setup" class="hidden" novalidate><p>Khởi tạo quản trị viên đầu tiên. Mật khẩu ClipViet tối thiểu 8 ký tự.</p><label for="setup-email">GMAIL</label><input id="setup-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="setup-password">MẬT KHẨU MỚI (TỐI THIỂU 8 KÝ TỰ)</label><input id="setup-password" name="password" type="password" minlength="8" autocomplete="new-password" required><div class="helper">Dùng mật khẩu riêng cho ClipViet, không dùng mật khẩu Gmail.</div><label for="bootstrap-token">MÃ KHỞI TẠO MỘT LẦN</label><input id="bootstrap-token" name="bootstrapToken" type="password" autocomplete="off" required><button id="setupSubmit" type="submit">TẠO TÀI KHOẢN ADMIN</button></form>
<p id="error" class="error hidden" role="alert" aria-live="polite"></p><p class="note">Phiên bảo mật 12 giờ · Cookie HttpOnly · Preview database</p>
</section></main><script>
const $=id=>document.getElementById(id);async function send(path,data){const r=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Yêu cầu không thành công");location.replace("/admin")}
function showError(m){$("error").textContent=m;$("error").classList.remove("hidden")}
async function init(){try{const r=await fetch("/auth/status",{cache:"no-store",credentials:"same-origin"});if(!r.ok)throw Error();const s=await r.json();if(s.setupRequired){$("login").classList.add("hidden");$("setup").classList.remove("hidden")}}catch(e){showError("Không thể tải trạng thái xác thực. Vui lòng tải lại trang.")}}
$("login").addEventListener("submit",async e=>{e.preventDefault();$("submit").disabled=true;try{const f=new FormData(e.currentTarget);await send("/auth/login",{email:f.get("email"),password:f.get("password")})}catch(x){showError(x.message)}finally{$("submit").disabled=false}});
$("setup").addEventListener("submit",async e=>{e.preventDefault();$("setupSubmit").disabled=true;try{const f=new FormData(e.currentTarget),password=String(f.get("password")||"");if(password.length<8)throw Error("Mật khẩu phải có ít nhất 8 ký tự.");await send("/auth/bootstrap",{email:f.get("email"),password,bootstrapToken:f.get("bootstrapToken")})}catch(x){showError(x.message)}finally{$("setupSubmit").disabled=false}});init();
</script></body></html>`;
 return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY"}});
}

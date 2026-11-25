import { sessionRole } from "./auth.mjs";
let jwksCache={keys:[],expiresAt:0};
const enc=new TextEncoder();
function b64u(s){const v=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));}
function part(s){return JSON.parse(new TextDecoder().decode(b64u(s)));}
function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function clean(v,n=200){return typeof v==="string"?v.trim().slice(0,n):"";}
export async function accessRole(request,env){
 const token=request.headers.get("Cf-Access-Jwt-Assertion")||"",domain=clean(env.ACCESS_TEAM_DOMAIN,120).toLowerCase(),aud=clean(env.ACCESS_AUD,200);
 if(!token||!/^([a-z0-9-]+)\.cloudflareaccess\.com$/.test(domain)||!aud)return "";
 const p=token.split(".");if(p.length!==3)return "";
 try{
  const h=part(p[0]),c=part(p[1]),now=Math.floor(Date.now()/1000),audList=Array.isArray(c.aud)?c.aud:[c.aud];
  if(h.alg!=="RS256"||c.iss!=="https://"+domain||!audList.includes(aud)||!c.sub||!Number.isFinite(c.exp)||c.exp<=now||(Number.isFinite(c.nbf)&&c.nbf>now+30))return "";
  if(jwksCache.expiresAt<Date.now()){
   const r=await fetch("https://"+domain+"/cdn-cgi/access/certs",{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5000)});
   if(!r.ok)return "";const j=await r.json();if(!Array.isArray(j.keys)||j.keys.length>20)return "";
   jwksCache={keys:j.keys,expiresAt:Date.now()+300000};
  }
  const jwk=jwksCache.keys.find(k=>k.kid===h.kid&&k.kty==="RSA"&&k.use==="sig");if(!jwk)return "";
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64u(p[2]),enc.encode(p[0]+"."+p[1])))return "";
  const groups=Array.isArray(c.groups)?c.groups:[];
  if(env.ACCESS_ADMIN_GROUP_ID&&groups.includes(env.ACCESS_ADMIN_GROUP_ID))return "admin";
  if(env.ACCESS_TECH_GROUP_ID&&groups.includes(env.ACCESS_TECH_GROUP_ID))return "technical";
  if(env.ACCESS_LEGAL_GROUP_ID&&groups.includes(env.ACCESS_LEGAL_GROUP_ID))return "legal";
 }catch{return "";}return "";
}
export async function resolveRole(request,env,equalSecret){
 const session=await sessionRole(request,env);if(session)return session;
 const role=await accessRole(request,env);if(role)return role;
 const supplied=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!supplied)return "";
 for(const [r,k] of [["technical",env.REGISTRY_TECH_TOKEN],["legal",env.REGISTRY_LEGAL_TOKEN]])if(k&&equalSecret(supplied,k))return r;
 return "";
}
function keyRing(env){
 let x;try{x=JSON.parse(env.REGISTRY_ENCRYPTION_KEYS||"{}");}catch{throw new Error("Invalid REGISTRY_ENCRYPTION_KEYS JSON.");}
 if(!x.activeKid||!x.keys||!x.keys[x.activeKid]||Object.keys(x.keys).length>5)throw new Error("Key ring requires activeKid and up to five keys.");
 const keys={};for(const [kid,v] of Object.entries(x.keys)){if(!/^[\w-]{1,32}$/.test(kid))throw new Error("Invalid key id.");let raw;try{raw=Uint8Array.from(atob(v),c=>c.charCodeAt(0));}catch{throw new Error("Invalid base64 key.");}if(raw.length!==32)throw new Error("AES-256 keys must be 32 bytes.");keys[kid]=raw;}
 return {activeKid:x.activeKid,keys};
}
async function cryptoKey(raw,use){return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,[use]);}
export async function encryptCredential(value,env,id){
 if(!value)return null;const ring=keyRing(env),kid=ring.activeKid,iv=crypto.getRandomValues(new Uint8Array(12)),aad=enc.encode("clipviet-provider-registry:"+id+":v1");
 const c=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad},await cryptoKey(ring.keys[kid],"encrypt"),enc.encode(value));
 return "v1:"+kid+":"+b64(iv)+":"+b64(new Uint8Array(c));
}
export async function decryptCredential(value,env,id){
 if(!value)return "";const ring=keyRing(env),p=value.split(":");
 if(p.length===4&&p[0]==="v1"){const [,kid,iv,c]=p;if(!ring.keys[kid])throw new Error("Missing old key id "+kid);const aad=enc.encode("clipviet-provider-registry:"+id+":v1");const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:Uint8Array.from(atob(iv),c=>c.charCodeAt(0)),additionalData:aad},await cryptoKey(ring.keys[kid],"decrypt"),Uint8Array.from(atob(c),c=>c.charCodeAt(0)));return new TextDecoder().decode(plain);}
 const legacy=value.split(".");if(legacy.length===2&&env.REGISTRY_ENCRYPTION_KEY){const raw=Uint8Array.from(atob(env.REGISTRY_ENCRYPTION_KEY),c=>c.charCodeAt(0));if(raw.length!==32)throw new Error("Invalid legacy key.");const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:Uint8Array.from(atob(legacy[0]),c=>c.charCodeAt(0))},await cryptoKey(raw,"decrypt"),Uint8Array.from(atob(legacy[1]),c=>c.charCodeAt(0)));return new TextDecoder().decode(plain);}
 throw new Error("Unsupported ciphertext format.");
}
export async function rotateCredentials(db,env,afterId=""){
 const rows=await db.prepare("SELECT id,api_credential_ciphertext FROM provider_registry WHERE api_credential_ciphertext IS NOT NULL AND id>? ORDER BY id LIMIT 25").bind(afterId).all(),items=rows.results||[];
 if(!items.length)return {rotated:0,nextCursor:null,complete:true};
 const ring=keyRing(env),now=new Date().toISOString(),ops=[];
 for(const row of items){const clear=await decryptCredential(row.api_credential_ciphertext,env,row.id),next=await encryptCredential(clear,env,row.id),event=crypto.randomUUID(),oldKid=row.api_credential_ciphertext.startsWith("v1:")?row.api_credential_ciphertext.split(":")[1]:"legacy";
  ops.push(db.prepare("UPDATE provider_registry SET api_credential_ciphertext=?,updated_at=?,last_event_id=? WHERE id=? AND api_credential_ciphertext=?").bind(next,now,event,row.id,row.api_credential_ciphertext));
  ops.push(db.prepare("INSERT INTO provider_audit(event_id,provider_id,action,actor_role,metadata_json,created_at) VALUES(?,?,?,?,?,?)").bind(event,row.id,"CREDENTIAL_KEY_ROTATED","admin",JSON.stringify({fromKeyId:oldKid,toKeyId:ring.activeKid}),now));
 }
 await db.batch(ops);return {rotated:items.length,nextCursor:items.at(-1).id,complete:items.length<25};
}

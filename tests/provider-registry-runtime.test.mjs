import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { accessRole, encryptCredential, decryptCredential, rotateCredentials } from "../workers/provider-registry/src/security.mjs";

globalThis.crypto ??= webcrypto;

const encoder = new TextEncoder();
const keyA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const keyB = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const domain = "clipviet-test.cloudflareaccess.com";
const audience = "clipviet-preview-audience";
const env = {
  ACCESS_TEAM_DOMAIN: domain,
  ACCESS_AUD: audience,
  ACCESS_ADMIN_GROUP_ID: "group-admin",
  ACCESS_TECH_GROUP_ID: "group-tech",
  ACCESS_LEGAL_GROUP_ID: "group-legal"
};

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}
function decodePart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
let signingPair;
let publicJwk;
let fetchCount = 0;

test("Access JWT validates RS256 signature, issuer, audience, time and role groups", async () => {
  signingPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  publicJwk = await crypto.subtle.exportKey("jwk", signingPair.publicKey);
  publicJwk.kid = "clipviet-test-key";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  globalThis.fetch = async (url, options) => {
    fetchCount += 1;
    assert.equal(String(url), `https://${domain}/cdn-cgi/access/certs`);
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  async function token(claimOverrides = {}, invalidSignature = false) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "clipviet-test-key" })));
    const claims = {
      iss: `https://${domain}`,
      aud: [audience],
      sub: "test-user-001",
      iat: now,
      nbf: now - 1,
      exp: now + 300,
      groups: ["group-admin"],
      ...claimOverrides
    };
    const payload = b64url(encoder.encode(JSON.stringify(claims)));
    const input = `${header}.${payload}`;
    const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingPair.privateKey, encoder.encode(input)));
    if (invalidSignature) signature[0] ^= 0xff;
    return `${input}.${b64url(signature)}`;
  }

  const good = await token();
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": good } }), env), "admin");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ groups: ["group-tech"] }) } }), env), "technical");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ groups: ["group-legal"] }) } }), env), "legal");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ groups: ["unmapped"] }) } }), env), "");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ aud: ["wrong"] }) } }), env), "");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ iss: "https://attacker.example" }) } }), env), "");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({ exp: Math.floor(Date.now()/1000)-10 }) } }), env), "");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": await token({}, true) } }), env), "");
  assert.equal(fetchCount, 1, "JWKS should be fetched once and reused from cache");
});

test("Access JWT rejects malformed token and missing Access configuration", async () => {
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": "bad.token" } }), env), "");
  assert.equal(await accessRole(new Request("https://registry.example", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } }), {}), "");
});

test("versioned AES-GCM binds ciphertext to provider identity and rejects tampering", async () => {
  const oldEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k1", keys: { k1: keyA } }) };
  const dualEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k2", keys: { k1: keyA, k2: keyB } }) };
  const cipher = await encryptCredential("synthetic-preview-secret", oldEnv, "provider-a");
  assert.match(cipher, /^v1:k1:/);
  assert.equal(await decryptCredential(cipher, dualEnv, "provider-a"), "synthetic-preview-secret");
  await assert.rejects(() => decryptCredential(cipher, dualEnv, "provider-b"));
  const parts = cipher.split(":");
  parts[3] = parts[3].slice(0, -2) + "AA";
  await assert.rejects(() => decryptCredential(parts.join(":"), dualEnv, "provider-a"));
});

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async all() {
    const afterId = this.args[0] || "";
    return { results: this.db.rows.filter(row => row.id > afterId && row.api_credential_ciphertext).sort((a,b) => a.id.localeCompare(b.id)).slice(0,25).map(row => ({...row})) };
  }
}
class FakeD1 {
  constructor(rows) { this.rows = rows; this.audit = []; }
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) {
    const nextRows = this.rows.map(row => ({...row}));
    const nextAudit = [...this.audit];
    for (const statement of statements) {
      const a = statement.args;
      if (statement.sql.startsWith("UPDATE provider_registry")) {
        const [cipher, updatedAt, eventId, id, oldCipher] = a;
        const row = nextRows.find(item => item.id === id);
        if (!row || row.api_credential_ciphertext !== oldCipher) throw new Error("optimistic update conflict");
        row.api_credential_ciphertext = cipher;
        row.updated_at = updatedAt;
        row.last_event_id = eventId;
      } else if (statement.sql.startsWith("INSERT INTO provider_audit")) {
        const [eventId, providerId, action, actorRole, metadataJson, createdAt] = a;
        nextAudit.push({ eventId, providerId, action, actorRole, metadataJson, createdAt });
      } else {
        throw new Error("Unexpected SQL in fake D1 batch");
      }
    }
    this.rows = nextRows;
    this.audit = nextAudit;
    return [];
  }
}

test("credential rotation processes 25-row batches, resumes by cursor and audits every record", async () => {
  const oldEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k1", keys: { k1: keyA } }) };
  const newEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k2", keys: { k1: keyA, k2: keyB } }) };
  const rows = [];
  for (let i = 1; i <= 26; i++) {
    const id = `provider-${String(i).padStart(2,"0")}`;
    rows.push({
      id,
      api_credential_ciphertext: await encryptCredential(`secret-${i}`, oldEnv, id),
      updated_at: "2026-01-01T00:00:00.000Z",
      last_event_id: "initial"
    });
  }
  const db = new FakeD1(rows);
  const first = await rotateCredentials(db, newEnv);
  assert.equal(first.rotated, 25);
  assert.equal(first.complete, false);
  assert.equal(first.nextCursor, "provider-25");
  assert.equal(db.audit.length, 25);

  const second = await rotateCredentials(db, newEnv, first.nextCursor);
  assert.equal(second.rotated, 1);
  assert.equal(second.complete, true);
  assert.equal(second.nextCursor, "provider-26");
  assert.equal(db.audit.length, 26);

  for (const row of db.rows) {
    assert.match(row.api_credential_ciphertext, /^v1:k2:/);
    const number = Number(row.id.slice("provider-".length));
    assert.equal(await decryptCredential(row.api_credential_ciphertext, newEnv, row.id), `secret-${number}`);
  }
  const final = await rotateCredentials(db, newEnv, second.nextCursor);
  assert.deepEqual(final, { rotated: 0, nextCursor: null, complete: true });
  assert.equal(db.audit.length, 26);
});

test("rotation refuses to discard an old key before all ciphertext is readable", async () => {
  const envWithoutOldKey = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k2", keys: { k2: keyB } }) };
  const oldEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({ activeKid: "k1", keys: { k1: keyA } }) };
  const cipher = await encryptCredential("still-needed", oldEnv, "provider-legacy");
  const db = new FakeD1([{ id: "provider-legacy", api_credential_ciphertext: cipher }]);
  await assert.rejects(() => rotateCredentials(db, envWithoutOldKey));
  assert.equal(db.rows[0].api_credential_ciphertext, cipher, "failed decrypt must not modify stored ciphertext");
  assert.equal(db.audit.length, 0);
});

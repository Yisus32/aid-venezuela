import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-please-change";

const {
  hashPassword, verifyPassword, signSession, readSession,
  sessionCookieHeader, clearCookieHeader, readCookie,
} = await import("./auth.ts");

test("hashPassword/verifyPassword round-trips and rejects wrong password", () => {
  const stored = hashPassword("1234");
  assert.ok(stored.startsWith("scrypt$"));
  assert.notEqual(stored, "1234");
  assert.equal(verifyPassword("1234", stored), true);
  assert.equal(verifyPassword("wrong", stored), false);
});

test("verifyPassword rejects malformed stored values", () => {
  assert.equal(verifyPassword("x", ""), false);
  assert.equal(verifyPassword("x", "plaintext"), false);
});

test("signSession/readSession round-trips", () => {
  const tok = signSession("user_123");
  assert.ok(tok && tok.includes("."));
  assert.deepEqual(readSession(tok), { uid: "user_123" });
});

test("readSession rejects tampered token", () => {
  const tok = signSession("user_123")!;
  const tampered = tok.slice(0, -2) + (tok.endsWith("aa") ? "bb" : "aa");
  assert.equal(readSession(tampered), null);
});

test("readSession rejects expired token", () => {
  const past = 1000;
  const tok = signSession("user_123", past)!;
  // now far in the future relative to the past-issued token
  assert.equal(readSession(tok, past + 1000 * 60 * 60 * 24 * 365), null);
});

test("readSession rejects null/garbage", () => {
  assert.equal(readSession(null), null);
  assert.equal(readSession("nodot"), null);
});

test("cookie headers and parsing", () => {
  const set = sessionCookieHeader("user_123");
  assert.match(set, /^aid_session=.+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=\d+/);
  assert.match(clearCookieHeader(), /Max-Age=0/);
  const req = new Request("https://x/", { headers: { cookie: "a=1; aid_session=TOK.MAC; b=2" } });
  assert.equal(readCookie(req), "TOK.MAC");
  assert.equal(readCookie(new Request("https://x/")), null);
});

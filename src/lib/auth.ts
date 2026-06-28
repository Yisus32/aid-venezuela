// AID-013: pure auth primitives — password hashing (scrypt) and stateless
// signed-session cookies (HMAC). No DB import here so it stays unit-testable.
import crypto from "node:crypto";

const COOKIE = "aid_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days, seconds

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = (stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  let expected: Buffer, actual: Buffer;
  try {
    const salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
    if (expected.length === 0) return false;
    actual = crypto.scryptSync(pw, salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length > 0 ? s : null;
}

const b64u = (buf: crypto.BinaryLike): string =>
  Buffer.from(buf as any).toString("base64url");

export function signSession(uid: string, now: number = Date.now()): string | null {
  const s = secret();
  if (!s) return null;
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + MAX_AGE * 1000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readSession(value: string | null, now: number = Date.now()): { uid: string } | null {
  const s = secret();
  if (!s || !value || !value.includes(".")) return null;
  const [payload, mac] = value.split(".");
  const expected = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data || typeof data.uid !== "string" || typeof data.exp !== "number" || data.exp < now) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export function sessionCookieHeader(uid: string): string {
  const token = signSession(uid) ?? "";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)aid_session=([^;]+)/);
  return m ? m[1] : null;
}

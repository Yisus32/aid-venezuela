# AID-013 Account-based Login, Roles & Moderation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared `ADMIN_TOKEN` with real nickname/password accounts and roles (user/admin), let logged-in users submit centers/professionals into a moderation queue that admins approve, and let admins manage other admins.

**Architecture:** Astro SSR routes + Prisma/Postgres. Auth is a stateless HMAC-signed HttpOnly cookie (`SESSION_SECRET`); roles are read from the DB per request so promotions take effect immediately. Pure crypto/cookie logic lives in `src/lib/auth.ts` (unit-tested); DB-backed account/submission logic + request guards live in `src/lib/accounts.ts`. Moderation uses a separate `Submission` table; approval calls the existing `writePoint()`.

**Tech Stack:** Astro 7, Prisma 7 (Postgres via `@prisma/adapter-pg`), Node 26 (`node:crypto` scrypt/HMAC, built-in `node --test` runner with native TypeScript).

## Global Constraints

- Node `>=22.12.0` (CI/runtime is Node 26; type-stripping + `node --test` are native — no test deps).
- No new runtime dependencies: hashing/signing use `node:crypto` only.
- Passwords NEVER stored or returned in plaintext; never logged.
- Session cookie: name `aid_session`, `HttpOnly; SameSite=Lax; Path=/`, add `; Secure` when `NODE_ENV === "production"`, `Max-Age` = 30 days.
- All API routes set `export const prerender = false;`.
- UI copy in Spanish (matches the site). Generic auth errors: login fail → "Usuario o clave incorrectos"; duplicate nickname → "Ese apodo ya existe".
- Validation: nickname 2–24 chars (`/^[\w.-]{2,24}$/`), password length ≥ 4.
- `ADMIN_TOKEN` is removed entirely from code; `SESSION_SECRET` replaces it as the required secret.
- Follow the repo's existing inline-`<script>` pattern in `.astro` files (no new build tooling for the client).

---

## File Structure

- `src/lib/auth.ts` (new) — pure: `hashPassword`, `verifyPassword`, `signSession`, `readSession`, cookie header/parse helpers. No Prisma import (keeps it unit-testable).
- `src/lib/auth.test.ts` (new) — `node --test` unit tests for the above.
- `src/lib/accounts.ts` (new) — Prisma-backed: user CRUD, submission CRUD, `getCurrentUser`/`requireUser`/`requireAdmin`.
- `src/lib/admin-auth.ts` (modify) — remove `checkAdmin`; keep `reqMeta`.
- `src/pages/api/auth/{signup,login,logout,me}.ts` (new).
- `src/pages/api/submissions.ts` (new).
- `src/pages/api/admin/submissions/index.ts` + `[id]/approve.ts` + `[id]/reject.ts` (new).
- `src/pages/api/admin/users/index.ts` + `[id]/role.ts` (new).
- `src/pages/api/admin/points.ts`, `points/[filename].ts`, `audit.ts` (modify: token→session, audit actorNickname).
- `src/lib/db.ts` (modify: `logAudit`/`AuditEntry` gain optional `actorNickname`).
- `prisma/schema.prisma` (modify: `Role`, `User`, `Submission`, `AuditLog.actorNickname`) + migration.
- `src/layouts/Layout.astro` (modify: sidebar auth widget + submission form).
- `src/pages/admin-db-9760b48605/index.astro` (modify: login gate + Pendientes/Usuarios tabs).
- `scripts/seed-users.mjs` (new) — idempotent greg/1234 admin.
- `package.json` (modify: add `"test": "node --test"`).

---

## Task 1: Auth crypto/cookie library (`src/lib/auth.ts`) — TDD

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`
- Modify: `package.json` (add test script)

**Interfaces:**
- Produces:
  - `hashPassword(pw: string): string` → `"scrypt$<saltHex>$<hashHex>"`
  - `verifyPassword(pw: string, stored: string): boolean`
  - `signSession(uid: string, now?: number): string | null` (null if no `SESSION_SECRET`)
  - `readSession(value: string | null, now?: number): { uid: string } | null`
  - `sessionCookieHeader(uid: string): string` / `clearCookieHeader(): string`
  - `readCookie(request: Request): string | null`

- [ ] **Step 1: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
    "test": "node --test",
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/auth.test.ts`:
```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth.ts'` (file not created yet).

- [ ] **Step 4: Implement `src/lib/auth.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/auth.ts src/lib/auth.test.ts
git commit -m "AID-013: auth crypto/cookie lib with unit tests"
```

---

## Task 2: Prisma schema — User, Submission, Role, audit actor

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration (via `prisma migrate`)

**Interfaces:**
- Produces: Prisma models `User`, `Submission`, enum `Role`; `AuditLog.actorNickname`.

- [ ] **Step 1: Add the models to `prisma/schema.prisma`**

Append after the existing enums (after the `Urgency` enum):
```prisma
enum Role {
  user
  admin
}
```

Append at the end of the file:
```prisma
/// AID-013: a login account. nickname+password only (no email/PII).
model User {
  id           String       @id @default(cuid())
  nickname     String       @unique
  passwordHash String       // "scrypt$<saltHex>$<hashHex>"
  role         Role         @default(user)
  createdAt    DateTime     @default(now())
  submissions  Submission[]
}

/// AID-013: moderation queue. A user-proposed center/professional awaiting review.
model Submission {
  id            String    @id @default(cuid())
  payload       Json      // ImageEntry-shaped proposed record
  status        String    @default("pending") // pending | approved | rejected
  submittedBy   User      @relation(fields: [submittedById], references: [id])
  submittedById String
  reviewedAt    DateTime?
  reviewNote    String?
  createdAt     DateTime  @default(now())

  @@index([status])
}
```

- [ ] **Step 2: Add `actorNickname` to `AuditLog`**

In the existing `model AuditLog`, add after the `userAgent String?` line:
```prisma
  actorNickname String?
```

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name aid013_accounts`
Expected: migration created under `prisma/migrations/`, applied to the dev DB, Prisma Client regenerated.

> If the dev DB is not reachable locally, instead run `npx prisma migrate dev --create-only --name aid013_accounts` to generate the SQL, then `npx prisma generate`. Note in the commit message that `migrate deploy` must run on the server.

- [ ] **Step 4: Verify the client typings**

Run: `node -e "import('@prisma/client').then(m=>{const p=new (m.PrismaClient)(); console.log(typeof p.user, typeof p.submission);}).catch(e=>{console.log('client ok (no db needed for types)')})"`
Expected: prints `function function` (or the "client ok" fallback). Either confirms the client was regenerated with the new models.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "AID-013: Prisma models User, Submission, Role + audit actorNickname"
```

---

## Task 3: Accounts/submissions data layer + request guards (`src/lib/accounts.ts`)

**Files:**
- Create: `src/lib/accounts.ts`

**Interfaces:**
- Consumes: `getPrisma()` from `./prisma`; `readCookie`, `readSession` from `./auth`.
- Produces:
  - `createUser(nickname, passwordHash, role?): Promise<SafeUser>` (throws `Error("DUPLICATE")` on unique violation)
  - `findByNickname(nickname): Promise<{ id; nickname; passwordHash; role } | null>`
  - `listUsers(): Promise<SafeUser[]>`
  - `setRole(id, role): Promise<void>`
  - `countAdmins(): Promise<number>`
  - `createSubmission(payload, submittedById): Promise<{ id }>`
  - `listSubmissions(status?): Promise<Submission[]>`
  - `getSubmission(id): Promise<Submission | null>`
  - `markSubmission(id, status, reviewNote?): Promise<void>`
  - `getCurrentUser(request): Promise<SafeUser | null>`
  - `requireUser(request): Promise<SafeUser | null>` (null ⇒ caller returns 401)
  - `requireAdmin(request): Promise<SafeUser | null>` (null ⇒ caller returns 401/403)
  - type `SafeUser = { id: string; nickname: string; role: "user" | "admin" }`

- [ ] **Step 1: Implement `src/lib/accounts.ts`**

```ts
// AID-013: DB-backed accounts + moderation queue, and request auth guards.
import { getPrisma } from "./prisma";
import { readCookie, readSession } from "./auth";

export type SafeUser = { id: string; nickname: string; role: "user" | "admin" };

export async function createUser(
  nickname: string,
  passwordHash: string,
  role: "user" | "admin" = "user",
): Promise<SafeUser> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  try {
    const u = await prisma.user.create({
      data: { nickname, passwordHash, role },
      select: { id: true, nickname: true, role: true },
    });
    return u as SafeUser;
  } catch (e: any) {
    if (e?.code === "P2002") throw new Error("DUPLICATE");
    throw e;
  }
}

export async function findByNickname(nickname: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.user.findUnique({
    where: { nickname },
    select: { id: true, nickname: true, passwordHash: true, role: true },
  });
}

export async function listUsers(): Promise<SafeUser[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.user.findMany({
    select: { id: true, nickname: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  }) as any;
}

export async function setRole(id: string, role: "user" | "admin"): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  await prisma.user.update({ where: { id }, data: { role } });
}

export async function countAdmins(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;
  return prisma.user.count({ where: { role: "admin" } });
}

export async function createSubmission(payload: any, submittedById: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  return prisma.submission.create({
    data: { payload, submittedById },
    select: { id: true },
  });
}

export async function listSubmissions(status?: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.submission.findMany({
    where: status ? { status } : undefined,
    include: { submittedBy: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSubmission(id: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.submission.findUnique({ where: { id } });
}

export async function markSubmission(id: string, status: string, reviewNote?: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  await prisma.submission.update({
    where: { id },
    data: { status, reviewNote: reviewNote ?? null, reviewedAt: new Date() },
  });
}

export async function getCurrentUser(request: Request): Promise<SafeUser | null> {
  const sess = readSession(readCookie(request));
  if (!sess) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const u = await prisma.user.findUnique({
    where: { id: sess.uid },
    select: { id: true, nickname: true, role: true },
  });
  return (u as SafeUser) ?? null;
}

export async function requireUser(request: Request): Promise<SafeUser | null> {
  return getCurrentUser(request);
}

export async function requireAdmin(request: Request): Promise<SafeUser | null> {
  const u = await getCurrentUser(request);
  return u && u.role === "admin" ? u : null;
}
```

- [ ] **Step 2: Type-check by building the affected module**

Run: `npx astro check --minimumSeverity error 2>&1 | tail -20` (if `astro check` is unavailable, run `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20`).
Expected: no errors referencing `src/lib/accounts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/accounts.ts
git commit -m "AID-013: accounts/submissions data layer and auth guards"
```

---

## Task 4: Auth endpoints (`signup`, `login`, `logout`, `me`)

**Files:**
- Create: `src/pages/api/auth/signup.ts`, `login.ts`, `logout.ts`, `me.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `sessionCookieHeader`, `clearCookieHeader` from `../../../lib/auth`; `createUser`, `findByNickname`, `getCurrentUser` from `../../../lib/accounts`.
- Produces: HTTP endpoints used by the sidebar and admin page.

- [ ] **Step 1: Implement `src/pages/api/auth/signup.ts`**

```ts
import type { APIRoute } from "astro";
import { hashPassword, sessionCookieHeader } from "../../../lib/auth";
import { createUser } from "../../../lib/accounts";

export const prerender = false;

const NICK = /^[\w.-]{2,24}$/;

export const POST: APIRoute = async ({ request }) => {
  if (!process.env.SESSION_SECRET) return new Response("Auth no configurada", { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  const nickname = String(body?.nickname ?? "").trim();
  const password = String(body?.password ?? "");
  if (!NICK.test(nickname)) return new Response("Apodo inválido (2–24, letras/números)", { status: 400 });
  if (password.length < 4) return new Response("La clave debe tener al menos 4 caracteres", { status: 400 });
  try {
    const user = await createUser(nickname, hashPassword(password));
    return new Response(JSON.stringify({ nickname: user.nickname, role: user.role }), {
      status: 201,
      headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(user.id) },
    });
  } catch (e: any) {
    if (e?.message === "DUPLICATE") return new Response("Ese apodo ya existe", { status: 409 });
    return new Response("Error", { status: 500 });
  }
};
```

- [ ] **Step 2: Implement `src/pages/api/auth/login.ts`**

```ts
import type { APIRoute } from "astro";
import { verifyPassword, sessionCookieHeader } from "../../../lib/auth";
import { findByNickname } from "../../../lib/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!process.env.SESSION_SECRET) return new Response("Auth no configurada", { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  const nickname = String(body?.nickname ?? "").trim();
  const password = String(body?.password ?? "");
  const user = await findByNickname(nickname);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return new Response("Usuario o clave incorrectos", { status: 401 });
  }
  return new Response(JSON.stringify({ nickname: user.nickname, role: user.role }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(user.id) },
  });
};
```

- [ ] **Step 3: Implement `src/pages/api/auth/logout.ts`**

```ts
import type { APIRoute } from "astro";
import { clearCookieHeader } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": clearCookieHeader() },
  });
```

- [ ] **Step 4: Implement `src/pages/api/auth/me.ts`**

```ts
import type { APIRoute } from "astro";
import { getCurrentUser } from "../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  return Response.json(user ? { nickname: user.nickname, role: user.role } : null);
};
```

- [ ] **Step 5: Manual verification (dev server)**

Run in one terminal: `npm run dev`
Then:
```bash
# signup
curl -i -s -X POST localhost:4321/api/auth/signup -H 'content-type: application/json' -d '{"nickname":"tester","password":"1234"}' | tee /tmp/aid_signup.txt | grep -E "HTTP|set-cookie"
# extract cookie and call /me
C=$(grep -i set-cookie /tmp/aid_signup.txt | sed 's/.*aid_session=/aid_session=/; s/;.*//')
curl -s localhost:4321/api/auth/me -H "cookie: $C"   # → {"nickname":"tester","role":"user"}
# duplicate
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4321/api/auth/login -H 'content-type: application/json' -d '{"nickname":"tester","password":"wrong"}'  # → 401
```
Expected: signup → `201` + `set-cookie`; `/me` → tester/user; wrong password → `401`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/auth
git commit -m "AID-013: auth endpoints (signup, login, logout, me)"
```

---

## Task 5: Public submission endpoint (`/api/submissions`)

**Files:**
- Create: `src/pages/api/submissions.ts`

**Interfaces:**
- Consumes: `requireUser` from `../../lib/accounts`; `createSubmission`.
- Produces: `POST /api/submissions` for logged-in users; a `sanitizeSubmission(body)` shape (title required, category in {center,professional}, needs→string[]).

- [ ] **Step 1: Implement `src/pages/api/submissions.ts`**

```ts
import type { APIRoute } from "astro";
import { requireUser, createSubmission } from "../../lib/accounts";

export const prerender = false;

function sanitize(body: any) {
  const s = (v: any) => (typeof v === "string" ? v.trim() : "");
  const category = body?.category === "professional" ? "professional" : "center";
  const title = s(body?.title);
  if (!title) throw new Error("Falta el título");
  const needs = Array.isArray(body?.needs)
    ? body.needs.map((n: any) => s(n)).filter(Boolean)
    : s(body?.needs).split("\n").map((x: string) => x.trim()).filter(Boolean);
  const contactKeys = ["phone", "whatsapp", "instagram", "website", "email"] as const;
  const contact: Record<string, string> = {};
  for (const k of contactKeys) { const v = s(body?.contact?.[k]); if (v) contact[k] = v; }
  const lat = Number(body?.coords?.lat), lng = Number(body?.coords?.lng);
  return {
    category, title,
    organization: s(body?.organization) || undefined,
    specialty: s(body?.specialty) || undefined,
    description: s(body?.description) || undefined,
    location: {
      country: s(body?.location?.country) || "Venezuela",
      state: s(body?.location?.state),
      city: s(body?.location?.city),
      address: s(body?.location?.address) || undefined,
    },
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { coords: { lat, lng } } : {}),
    ...(needs.length ? { needs } : {}),
    ...(Object.keys(contact).length ? { contact } : {}),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const user = await requireUser(request);
  if (!user) return new Response("Inicia sesión para enviar", { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  let payload;
  try { payload = sanitize(body); } catch (e: any) { return new Response(e?.message || "Datos inválidos", { status: 400 }); }
  await createSubmission(payload, user.id);
  return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } });
};
```

- [ ] **Step 2: Manual verification**

With dev server running and the `tester` cookie from Task 4 (`$C`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4321/api/submissions -H "cookie: $C" -H 'content-type: application/json' -d '{"category":"center","title":"Centro Prueba","needs":"Agua\nRopa"}'  # → 201
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4321/api/submissions -H 'content-type: application/json' -d '{"title":"x"}'  # → 401 (no cookie)
```
Expected: logged-in → `201`; anonymous → `401`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/submissions.ts
git commit -m "AID-013: public submission endpoint with server-side sanitize"
```

---

## Task 6: Admin moderation endpoints (list/approve/reject)

**Files:**
- Create: `src/pages/api/admin/submissions/index.ts`, `[id]/approve.ts`, `[id]/reject.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `listSubmissions`, `getSubmission`, `markSubmission` from accounts; `writePoint`, `logAudit` from `../../../../lib/db`; `reqMeta` from `../../../../lib/admin-auth`.
- Produces: admin-only moderation HTTP endpoints. Approve generates `filename` like `points.ts` and is idempotent (re-approving returns ok without a duplicate Point).

- [ ] **Step 1: Implement `src/pages/api/admin/submissions/index.ts`**

```ts
import type { APIRoute } from "astro";
import { requireAdmin, listSubmissions } from "../../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  const status = url.searchParams.get("status") ?? "pending";
  return Response.json(await listSubmissions(status === "all" ? undefined : status));
};
```

- [ ] **Step 2: Implement `src/pages/api/admin/submissions/[id]/approve.ts`**

```ts
import type { APIRoute } from "astro";
import { requireAdmin, getSubmission, markSubmission } from "../../../../../lib/accounts";
import { writePoint, logAudit } from "../../../../../lib/db";
import { reqMeta } from "../../../../../lib/admin-auth";

export const prerender = false;

const slug = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const sub = await getSubmission(params.id!);
  if (!sub) return new Response("No encontrado", { status: 404 });
  if (sub.status === "approved") return Response.json({ ok: true, already: true });
  const payload: any = { ...(sub.payload as any) };
  if (!payload.filename) {
    payload.filename = "reg-" + (slug(payload.title) || "centro") + "-" + Math.random().toString(36).slice(2, 7);
  }
  await writePoint(payload);
  await markSubmission(sub.id, "approved");
  await logAudit({
    action: "create", filename: payload.filename, title: payload.title, category: payload.category,
    actorNickname: admin.nickname, ...reqMeta(request, clientAddress),
  });
  return Response.json({ ok: true, filename: payload.filename });
};
```

- [ ] **Step 3: Implement `src/pages/api/admin/submissions/[id]/reject.ts`**

```ts
import type { APIRoute } from "astro";
import { requireAdmin, getSubmission, markSubmission } from "../../../../../lib/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  const sub = await getSubmission(params.id!);
  if (!sub) return new Response("No encontrado", { status: 404 });
  let note = "";
  try { note = String((await request.json())?.reviewNote ?? ""); } catch { /* optional */ }
  await markSubmission(sub.id, "rejected", note || undefined);
  return Response.json({ ok: true });
};
```

- [ ] **Step 4: Manual verification**

This needs an admin session. After Task 9 (seed) you can log in as greg; for now verify the 401 guard:
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/api/admin/submissions            # → 401 (no session)
curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/api/admin/submissions -H "cookie: $C"  # → 401 (tester is not admin)
```
Expected: both `401`. (Full approve/reject flow is verified end-to-end in Task 11/12.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/submissions
git commit -m "AID-013: admin moderation endpoints (list/approve/reject)"
```

---

## Task 7: Admin user management endpoints (list/role)

**Files:**
- Create: `src/pages/api/admin/users/index.ts`, `[id]/role.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `listUsers`, `setRole`, `countAdmins`, `getCurrentUser` from accounts.
- Produces: admin-only user list + role toggle; refuses to demote the last admin.

- [ ] **Step 1: Implement `src/pages/api/admin/users/index.ts`**

```ts
import type { APIRoute } from "astro";
import { requireAdmin, listUsers } from "../../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  return Response.json(await listUsers());
};
```

- [ ] **Step 2: Implement `src/pages/api/admin/users/[id]/role.ts`**

```ts
import type { APIRoute } from "astro";
import { requireAdmin, setRole, countAdmins, getCurrentUser } from "../../../../../lib/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  const role = body?.role === "admin" ? "admin" : "user";
  // Guard: don't allow demoting the last remaining admin.
  if (role === "user" && (await countAdmins()) <= 1) {
    return new Response("No puedes quitar al último administrador", { status: 400 });
  }
  await setRole(params.id!, role);
  return Response.json({ ok: true });
};
```

- [ ] **Step 3: Manual verification (guard only, pre-seed)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/api/admin/users            # → 401
```
Expected: `401`. (Full flow verified in Task 11/12 after seeding greg.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/users
git commit -m "AID-013: admin user management endpoints (list/role) with last-admin guard"
```

---

## Task 8: Migrate existing admin endpoints token→session + remove `checkAdmin`

**Files:**
- Modify: `src/lib/admin-auth.ts` (remove `checkAdmin`)
- Modify: `src/lib/db.ts` (`AuditEntry`/`logAudit` gain `actorNickname`)
- Modify: `src/pages/api/admin/points.ts`, `src/pages/api/admin/points/[filename].ts`, `src/pages/api/admin/audit.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `../../../lib/accounts` (points/audit), `../../../../lib/accounts` ([filename]).
- Produces: admin CRUD/audit now gated by admin session; audit records `actorNickname`.

- [ ] **Step 1: Remove `checkAdmin` from `src/lib/admin-auth.ts`**

Delete the `checkAdmin` function (lines defining it) and its leading comment, keeping `reqMeta`. The file's first comment block can be trimmed to describe only `reqMeta`. Result keeps only the `reqMeta` export.

- [ ] **Step 2: Extend audit to carry `actorNickname` in `src/lib/db.ts`**

In `interface AuditEntry`, add:
```ts
  actorNickname?: string | null;
```
In `logAudit`, inside the `data: { ... }` object passed to `prisma.auditLog.create`, add:
```ts
        actorNickname: data.actorNickname ?? null,
```

- [ ] **Step 3: Update `src/pages/api/admin/points.ts`**

Replace the import line `import { checkAdmin, reqMeta } from "../../../lib/admin-auth";` with:
```ts
import { reqMeta } from "../../../lib/admin-auth";
import { requireAdmin } from "../../../lib/accounts";
```
In `GET`, replace `if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });` with:
```ts
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
```
In `POST`, replace the guard with:
```ts
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
```
and in its `logAudit({...})` add `actorNickname: admin.nickname,` before the `...reqMeta(...)` spread.

- [ ] **Step 4: Update `src/pages/api/admin/points/[filename].ts`**

Read the file first. Replace the `checkAdmin` import with `requireAdmin` from `../../../../lib/accounts` (note the extra `../`), keep `reqMeta`. In every handler (PATCH, DELETE) replace `if (!checkAdmin(request)) ...` with:
```ts
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
```
and add `actorNickname: admin.nickname,` to each `logAudit({...})` call.

- [ ] **Step 5: Update `src/pages/api/admin/audit.ts`**

Read the file first. Replace the `checkAdmin` import/guard with:
```ts
import { requireAdmin } from "../../../lib/accounts";
```
and `if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });`

- [ ] **Step 6: Verify no `checkAdmin`/`ADMIN_TOKEN`/`x-admin-token` remain in server code**

Run: `grep -rn "checkAdmin\|ADMIN_TOKEN\|x-admin-token" src/ scripts/ || echo "clean"`
Expected: only matches inside `src/pages/admin-db-9760b48605/index.astro` (rewritten in Task 11) — everything in `src/lib` and `src/pages/api` is gone. Note any remaining API matches and fix them.

- [ ] **Step 7: Type-check**

Run: `npx astro check --minimumSeverity error 2>&1 | tail -20`
Expected: no errors in the modified API files.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/db.ts src/pages/api/admin/points.ts src/pages/api/admin/points/[filename].ts src/pages/api/admin/audit.ts
git commit -m "AID-013: gate admin API by session role; drop ADMIN_TOKEN; audit actorNickname"
```

---

## Task 9: Seed greg/1234 as admin (`scripts/seed-users.mjs`)

**Files:**
- Create: `scripts/seed-users.mjs`

**Interfaces:**
- Consumes: `@prisma/client`, and `hashPassword` from `../src/lib/auth.ts` (Node 26 imports `.ts` natively).
- Produces: idempotent admin seed.

- [ ] **Step 1: Implement `scripts/seed-users.mjs`**

```js
// AID-013: ensure the demo admin account exists. Idempotent — only sets the
// password on first creation; never overwrites an existing user's password.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.ts";

const NICK = process.env.SEED_ADMIN_NICK || "greg";
const PASS = process.env.SEED_ADMIN_PASS || "1234";

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { nickname: NICK } });
  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
      console.log(`Promoted existing user "${NICK}" to admin.`);
    } else {
      console.log(`Admin "${NICK}" already exists — no change.`);
    }
  } else {
    await prisma.user.create({ data: { nickname: NICK, passwordHash: hashPassword(PASS), role: "admin" } });
    console.log(`Created admin "${NICK}".`);
  }
} finally {
  await prisma.$disconnect();
}
```

- [ ] **Step 2: Add a convenience script to `package.json`**

In `"scripts"` add:
```json
    "seed-users": "node scripts/seed-users.mjs",
```

- [ ] **Step 3: Run the seed (requires DATABASE_URL + SESSION_SECRET)**

Run: `npm run seed-users`
Expected: prints `Created admin "greg".` (or "already exists" on re-run). Re-run once to confirm idempotency: `npm run seed-users` → "already exists".

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-users.mjs package.json
git commit -m "AID-013: idempotent seed for greg/1234 admin account"
```

---

## Task 10: Public sidebar auth widget + submission form (`Layout.astro`)

**Files:**
- Modify: `src/layouts/Layout.astro`

**Interfaces:**
- Consumes: `/api/auth/me`, `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/submissions`.
- Produces: a sidebar auth panel (id `auth-panel`) and a submission `<dialog id="submit-dialog">`.

- [ ] **Step 1: Read the sidebar region**

Read `src/layouts/Layout.astro` around the brand/nav block (≈ lines 60–170) to find where to insert the auth panel within the sidebar markup, and confirm the existing inline-`<script>` location at the bottom.

- [ ] **Step 2: Add the auth panel markup**

Insert inside the sidebar (e.g. just below the brand block, before or after `<nav class="nav">`):
```html
<div id="auth-panel" class="auth-panel" data-state="loading">
  <!-- logged-out -->
  <form id="auth-form" class="auth-form" hidden>
    <h3 id="auth-title">Iniciar sesión</h3>
    <input name="nickname" placeholder="Apodo" autocomplete="username" required />
    <input name="password" type="password" placeholder="Clave" autocomplete="current-password" required />
    <p class="auth-error" id="auth-error" role="alert"></p>
    <button type="submit" class="btn-auth" id="auth-submit">Entrar</button>
    <button type="button" class="auth-toggle" id="auth-toggle">¿No tienes cuenta? Regístrate</button>
  </form>
  <!-- logged-in -->
  <div id="auth-me" class="auth-me" hidden>
    <span>Hola, <strong id="auth-nick"></strong></span>
    <button type="button" id="btn-suggest" class="btn-auth">Sugerir centro / profesional</button>
    <button type="button" id="btn-logout" class="auth-toggle">Cerrar sesión</button>
  </div>
</div>
```

- [ ] **Step 3: Add the submission dialog markup**

Add near the end of `<body>` (a focused subset of the admin editor; includes an optional map picker reusing Leaflet which Layout.astro already loads):
```html
<dialog id="submit-dialog" class="submit-dialog">
  <form id="submit-form">
    <h3>Sugerir un centro / profesional</h3>
    <label>Tipo
      <select name="category"><option value="center">Centro</option><option value="professional">Profesional</option></select>
    </label>
    <label>Título * <input name="title" required /></label>
    <label>Organización <input name="organization" /></label>
    <label>Especialidad <input name="specialty" /></label>
    <label>País <input name="country" value="Venezuela" /></label>
    <label>Estado <input name="state" /></label>
    <label>Ciudad <input name="city" /></label>
    <label>Dirección <input name="address" /></label>
    <label>Descripción <textarea name="description" rows="2"></textarea></label>
    <label>Necesidades (una por línea) <textarea name="needs" rows="3"></textarea></label>
    <fieldset><legend>Contacto</legend>
      <input name="c_phone" placeholder="Teléfono" /><input name="c_whatsapp" placeholder="WhatsApp" />
      <input name="c_instagram" placeholder="Instagram" /><input name="c_website" placeholder="Web" />
      <input name="c_email" placeholder="Correo" />
    </fieldset>
    <div class="map-pick"><span>Ubicación (opcional): clic en el mapa</span><div id="submit-map"></div></div>
    <input type="hidden" name="lat" /><input type="hidden" name="lng" />
    <p class="submit-status" id="submit-status"></p>
    <menu>
      <button type="button" id="submit-cancel">Cancelar</button>
      <button type="button" id="submit-send" class="btn-auth">Enviar para revisión</button>
    </menu>
  </form>
</dialog>
```

- [ ] **Step 4: Add the client script**

Append to the existing bottom `<script>` (or add a new `<script>` before `</body>`):
```html
<script>
  const panel = document.getElementById("auth-panel");
  const form = document.getElementById("auth-form");
  const meBox = document.getElementById("auth-me");
  const errEl = document.getElementById("auth-error");
  const titleEl = document.getElementById("auth-title");
  const submitBtn = document.getElementById("auth-submit");
  const toggle = document.getElementById("auth-toggle");
  let mode = "login"; // or "signup"

  function setMode(m) {
    mode = m;
    titleEl.textContent = m === "login" ? "Iniciar sesión" : "Crear cuenta";
    submitBtn.textContent = m === "login" ? "Entrar" : "Crear cuenta";
    toggle.textContent = m === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión";
    errEl.textContent = "";
    form.querySelector('[name=password]').setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
  }
  function render(user) {
    panel.dataset.state = user ? "in" : "out";
    form.hidden = !!user; meBox.hidden = !user;
    if (user) document.getElementById("auth-nick").textContent = user.nickname;
  }
  async function refresh() {
    try { render(await (await fetch("/api/auth/me")).json()); }
    catch { render(null); }
  }
  toggle.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const nickname = form.nickname.value.trim();
    const password = form.password.value;
    const r = await fetch("/api/auth/" + (mode === "login" ? "login" : "signup"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    });
    if (r.ok) { form.reset(); await refresh(); }
    else errEl.textContent = await r.text();
  });
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" }); render(null); setMode("login");
  });

  // Submission dialog
  const dlg = document.getElementById("submit-dialog");
  const sform = document.getElementById("submit-form");
  const sstatus = document.getElementById("submit-status");
  let smap, smarker;
  function initSubmitMap() {
    if (smap || typeof L === "undefined") return;
    smap = L.map("submit-map", { scrollWheelZoom: false }).setView([8, -66], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(smap);
    smap.on("click", (e) => {
      sform.lat.value = e.latlng.lat.toFixed(6); sform.lng.value = e.latlng.lng.toFixed(6);
      if (smarker) smarker.setLatLng(e.latlng); else smarker = L.marker(e.latlng).addTo(smap);
    });
  }
  document.getElementById("btn-suggest").addEventListener("click", () => {
    sstatus.textContent = ""; dlg.showModal(); setTimeout(() => { initSubmitMap(); smap && smap.invalidateSize(); }, 80);
  });
  document.getElementById("submit-cancel").addEventListener("click", () => dlg.close());
  document.getElementById("submit-send").addEventListener("click", async () => {
    const g = (n) => (sform.elements[n]?.value || "").trim();
    const lat = parseFloat(g("lat")), lng = parseFloat(g("lng"));
    const payload = {
      category: g("category"), title: g("title"),
      organization: g("organization"), specialty: g("specialty"), description: g("description"),
      location: { country: g("country"), state: g("state"), city: g("city"), address: g("address") },
      needs: g("needs"),
      contact: { phone: g("c_phone"), whatsapp: g("c_whatsapp"), instagram: g("c_instagram"), website: g("c_website"), email: g("c_email") },
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { coords: { lat, lng } } : {}),
    };
    sstatus.textContent = "Enviando…";
    const r = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { sstatus.textContent = "¡Enviado para revisión!"; sform.reset(); setTimeout(() => dlg.close(), 1200); }
    else sstatus.textContent = "Error: " + (await r.text());
  });

  setMode("login");
  refresh();
</script>
```

- [ ] **Step 5: Add minimal styles**

Add to the page's `<style>` (match existing tokens/colors; keep it compact):
```css
.auth-panel { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.12); display: flex; flex-direction: column; gap: 8px; }
.auth-form, .auth-me { display: flex; flex-direction: column; gap: 8px; }
.auth-form input { padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); color: inherit; }
.auth-error { color: #ffb4ab; font-size: 12px; min-height: 14px; margin: 0; }
.btn-auth { padding: 8px 12px; border-radius: 8px; border: none; background: var(--gold, #e8a33d); color: #14213d; font-weight: 700; cursor: pointer; }
.auth-toggle { background: none; border: none; color: inherit; opacity: 0.8; font-size: 12px; cursor: pointer; text-align: left; padding: 0; }
.submit-dialog { width: min(560px, 94vw); border: none; border-radius: 14px; padding: 20px; }
.submit-dialog form { display: flex; flex-direction: column; gap: 8px; }
.submit-dialog label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.submit-dialog input, .submit-dialog select, .submit-dialog textarea { padding: 8px 10px; border: 1px solid #d8dbe2; border-radius: 8px; }
.submit-dialog fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border: 1px solid #e3e6ec; border-radius: 8px; }
#submit-map { height: 200px; border-radius: 8px; overflow: hidden; }
.submit-dialog menu { display: flex; justify-content: flex-end; gap: 8px; padding: 0; margin: 6px 0 0; }
.submit-status { font-size: 13px; min-height: 16px; margin: 0; }
.auth-panel[data-state="loading"] .auth-form, .auth-panel[data-state="loading"] .auth-me { display: none; }
```

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`, open `localhost:4321`. Confirm: the sidebar shows a login form; signing up a new nickname switches to "Hola, …" with a logout + suggest button; "Sugerir" opens the dialog and a submission returns "¡Enviado para revisión!"; logout returns to the form.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "AID-013: sidebar auth widget + public submission form"
```

---

## Task 11: Admin page login gate + Pendientes/Usuarios tabs

**Files:**
- Modify: `src/pages/admin-db-9760b48605/index.astro`

**Interfaces:**
- Consumes: `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`, `/api/admin/submissions`, `/api/admin/submissions/:id/approve|reject`, `/api/admin/users`, `/api/admin/users/:id/role`, plus the existing `/api/admin/points*` (now cookie-gated).
- Produces: account-gated admin page with two new tabs.

- [ ] **Step 1: Replace the frontmatter token wiring**

In the `---` frontmatter, remove `const token = process.env.ADMIN_TOKEN ?? "";` and change `const ready = dbAvailable() && !!token;` to `const ready = dbAvailable();`. Keep the `entries` read. (The page will fetch fresh data after the login gate confirms an admin.)

- [ ] **Step 2: Replace the token gate with a login gate (client script)**

Remove the `TOKEN`/`ensureToken`/`clearToken`/`gate()` logic and every `"x-admin-token": TOKEN` header (the session cookie is sent automatically — change those `fetch` calls to drop the header entirely). Replace the bottom `gate()` IIFE with:
```js
(async function gate() {
  let me = null;
  try { me = await (await fetch("/api/auth/me")).json(); } catch {}
  if (!me) {
    document.body.innerHTML = '<form id="lg" style="max-width:280px;margin:80px auto;font-family:system-ui;display:flex;flex-direction:column;gap:10px">'
      + '<h2>Admin · iniciar sesión</h2>'
      + '<input name="nickname" placeholder="Apodo" required>'
      + '<input name="password" type="password" placeholder="Clave" required>'
      + '<p id="lgerr" style="color:#d64533;min-height:16px;margin:0"></p>'
      + '<button>Entrar</button></form>';
    document.getElementById("lg").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: f.nickname.value.trim(), password: f.password.value }) });
      if (r.ok) location.reload(); else document.getElementById("lgerr").textContent = await r.text();
    });
    return;
  }
  if (me.role !== "admin") {
    document.body.innerHTML = '<p style="padding:40px;font-family:system-ui">No autorizado. Tu cuenta no es de administrador.</p>';
    return;
  }
  // admin confirmed → load data
  await refresh();
})();
```

- [ ] **Step 3: Add the two nav tabs**

In `<nav class="tabs">` add after the existing buttons:
```html
<button class="tab" type="button" data-view="pendientes">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  Pendientes <span id="pend-count" class="tab-badge" hidden>0</span>
</button>
<button class="tab" type="button" data-view="usuarios">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
  Usuarios
</button>
```

- [ ] **Step 4: Add the two view sections**

After `<section id="view-auditoria">` add:
```html
<section id="view-pendientes" class="view">
  <div class="view-tools"><p class="audit-note">Sugerencias enviadas por usuarios. Aprobar crea el registro; rechazar lo descarta.</p>
    <button type="button" id="pend-refresh" class="btn ghost">Actualizar</button></div>
  <div class="audit-wrap"><table class="audit-table">
    <thead><tr><th>Fecha</th><th>De</th><th>Tipo</th><th>Título</th><th>Estado/Ciudad</th><th></th></tr></thead>
    <tbody id="pend-rows"><tr><td colspan="6">—</td></tr></tbody>
  </table></div>
</section>
<section id="view-usuarios" class="view">
  <div class="view-tools"><p class="audit-note">Cuentas registradas. Puedes nombrar o quitar administradores.</p>
    <button type="button" id="users-refresh" class="btn ghost">Actualizar</button></div>
  <div class="audit-wrap"><table class="audit-table">
    <thead><tr><th>Apodo</th><th>Rol</th><th>Creado</th><th></th></tr></thead>
    <tbody id="users-rows"><tr><td colspan="4">—</td></tr></tbody>
  </table></div>
</section>
```

- [ ] **Step 5: Wire the new tabs' data (client script)**

Add these functions and hook them into the existing tab-switch handler (which toggles `view-<v>` and currently lazy-loads audit):
```js
async function loadPending() {
  const tb = document.getElementById("pend-rows");
  tb.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
  try {
    const rows = await (await fetch("/api/admin/submissions?status=pending")).json();
    const badge = document.getElementById("pend-count");
    badge.textContent = rows.length; badge.hidden = rows.length === 0;
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="6">Sin pendientes.</td></tr>'; return; }
    tb.innerHTML = rows.map((s) => {
      const p = s.payload || {};
      const when = new Date(s.createdAt).toLocaleString("es-VE");
      const cat = p.category === "professional" ? "Profesional" : "Centro";
      const loc = [p.location?.state, p.location?.city].filter(Boolean).join(" / ") || "—";
      return `<tr data-id="${esc(s.id)}"><td>${esc(when)}</td><td>${esc(s.submittedBy?.nickname || "—")}</td>`
        + `<td>${cat}</td><td>${esc(p.title || "—")}</td><td>${esc(loc)}</td>`
        + `<td class="actions"><button class="icon-btn approve" data-id="${esc(s.id)}" title="Aprobar">✓</button>`
        + `<button class="icon-btn danger reject" data-id="${esc(s.id)}" title="Rechazar">✕</button></td></tr>`;
    }).join("");
  } catch { tb.innerHTML = '<tr><td colspan="6">Error.</td></tr>'; }
}
document.getElementById("pend-rows").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button"); if (!b) return;
  const id = b.dataset.id;
  if (b.classList.contains("approve")) {
    await fetch(`/api/admin/submissions/${id}/approve`, { method: "POST" });
    await loadPending(); await refresh();
  } else if (b.classList.contains("reject")) {
    if (!confirm("¿Rechazar esta sugerencia?")) return;
    await fetch(`/api/admin/submissions/${id}/reject`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await loadPending();
  }
});
document.getElementById("pend-refresh").addEventListener("click", loadPending);

async function loadUsers() {
  const tb = document.getElementById("users-rows");
  tb.innerHTML = '<tr><td colspan="4">Cargando…</td></tr>';
  try {
    const rows = await (await fetch("/api/admin/users")).json();
    tb.innerHTML = rows.map((u) => {
      const when = new Date(u.createdAt).toLocaleDateString("es-VE");
      const isAdmin = u.role === "admin";
      const action = isAdmin
        ? `<button class="icon-btn role-btn" data-id="${esc(u.id)}" data-role="user">Quitar admin</button>`
        : `<button class="icon-btn role-btn" data-id="${esc(u.id)}" data-role="admin">Hacer admin</button>`;
      return `<tr><td>${esc(u.nickname)}</td><td>${isAdmin ? "Admin" : "Usuario"}</td><td>${esc(when)}</td><td class="actions">${action}</td></tr>`;
    }).join("");
  } catch { tb.innerHTML = '<tr><td colspan="4">Error.</td></tr>'; }
}
document.getElementById("users-rows").addEventListener("click", async (ev) => {
  const b = ev.target.closest(".role-btn"); if (!b) return;
  const r = await fetch(`/api/admin/users/${b.dataset.id}/role`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: b.dataset.role }) });
  if (!r.ok) alert(await r.text());
  await loadUsers();
});
document.getElementById("users-refresh").addEventListener("click", loadUsers);
```
Then in the existing `.tab` click handler, extend the lazy-load branch:
```js
if (v === "auditoria" && !auditLoaded) loadAudit();
if (v === "pendientes") loadPending();
if (v === "usuarios") loadUsers();
```
And call `loadPending()` once inside `refresh()` (so the badge populates on load) — add `loadPending();` at the end of the existing `refresh()` function.

- [ ] **Step 6: Add a tiny badge style**

In the page `<style is:global>` add:
```css
.tab-badge { background: var(--gold); color: #14213d; border-radius: 20px; padding: 1px 7px; font-size: 11px; font-weight: 700; margin-left: 4px; }
.audit-table .approve { color: #2f7d32; } .audit-table .reject { color: var(--urgent); }
```

- [ ] **Step 7: Verify end-to-end in the browser**

Run `npm run dev`. Visit `/admin-db-9760b48605/`:
- Logged-out → login form. Log in as `greg`/`1234` → page loads.
- Go to **Pendientes** → the submission created in Task 10 appears → click ✓ Aprobar → it disappears and shows up under **Registros**.
- Go to **Usuarios** → `greg` (Admin) and `tester` (Usuario) listed → make `tester` admin, then revert. Confirm "No puedes quitar al último administrador" if you try to demote the only admin.
- Verify a non-admin (`tester`) visiting the page sees "No autorizado".

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin-db-9760b48605/index.astro
git commit -m "AID-013: admin page login gate + Pendientes/Usuarios tabs"
```

---

## Task 12: Build, docs/env, final verification

**Files:**
- Modify: `README.md` or env docs if present (document `SESSION_SECRET`, remove `ADMIN_TOKEN`); otherwise add a short `docs/superpowers/specs` note.

- [ ] **Step 1: Grep for any leftover token references in docs/config**

Run: `grep -rn "ADMIN_TOKEN" . --include=*.md --include=*.ts --include=*.astro --include=*.mjs --include=*.example 2>/dev/null || echo clean`
Expected: `clean` (or only this plan/spec mentioning the removal). Fix any stragglers (e.g. `.env.example`): replace `ADMIN_TOKEN` with `SESSION_SECRET`.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: PASS (Task 1 tests).

- [ ] **Step 3: Type-check / build**

Run: `npx astro check --minimumSeverity error 2>&1 | tail -25`
Expected: no errors. (A full `npm run build` requires DB + env; run it if the environment allows.)

- [ ] **Step 4: Full manual smoke (dev server)**

Confirm the complete flow once more: anonymous can still browse the map/acopios/personal (NOT gated); signup → suggest → admin approves → appears publicly; logout works; admin role management works; admin API rejects requests without a session (`curl` the endpoints from Tasks 6–8 expecting 401 when logged out).

- [ ] **Step 5: Commit any doc/env changes**

```bash
git add -A
git commit -m "AID-013: document SESSION_SECRET, remove ADMIN_TOKEN references"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** account model (Task 2,3), signup/login/logout/me (Task 4), submission queue (Task 5,6), admin moderation UI (Task 11), user/role management + last-admin guard (Task 7,11), token→session migration & ADMIN_TOKEN removal (Task 8,12), seed greg/1234 (Task 9), sidebar widget + submission form with optional map (Task 10), audit actorNickname (Task 2,8) — all mapped.
- **Placeholder scan:** no TBD/TODO; every code step shows full code.
- **Type consistency:** `SafeUser`, `requireAdmin`/`requireUser` returning `SafeUser|null`, `markSubmission(id,status,note?)`, `readSession→{uid}`, cookie name `aid_session`, audit field `actorNickname` are used consistently across tasks.
- **Known constraint:** endpoint/UI tasks use manual verification (no HTTP test harness exists; adding one is out of scope). Pure logic (auth.ts) is unit-tested.

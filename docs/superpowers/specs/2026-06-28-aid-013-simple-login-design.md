# AID-013 — Account-based Login, Roles & Moderation

**Status:** Approved design (brainstorming)
**Date:** 2026-06-28
**Supersedes parts of:** `requirements/aid_013_simple_login.md` (the original "static JSON / localStorage / plaintext password" model is replaced by real DB-backed accounts — see Background).

## Background & Intent

The original requirement asked for a throwaway nickname/password login (plaintext, localStorage) only to gate "suggest a center/professional" from the public sidebar.

During brainstorming the scope changed: **all users have an account (nickname + password), greg is an administrator, admins approve moderation and can name other admins, and the `ADMIN_TOKEN` is retired entirely** (the user considers the shared token unsuitable here). This turns AID-013 into a small but real auth + moderation system backed by the existing Prisma/Postgres database (already active, ~150 points).

The existing admin page (`/admin-db-9760b48605/`) already carries the note *"Replace with real auth before any sensitive production use"* and *"No hay cuentas de usuario"* — this work does exactly that.

## Goals

- Account model with roles: `user` and `admin`.
- Public sidebar: signup / login / logout; logged-in users can submit a new center/professional.
- Submissions go to a **moderation queue**; admins approve (→ becomes a live `Point`) or reject.
- Admins can promote/demote other users.
- Replace `ADMIN_TOKEN` access on all admin endpoints and the admin page with **session + admin role**.
- Preseed `greg` / `1234` as admin (demo account from the original spec).

## Non-Goals (YAGNI)

- No email, phone, real names, password reset, OAuth/SSO.
- No email verification.
- The public submission form is a focused subset of the admin editor (no audit metadata, no advanced repeatable rows beyond what's listed below).
- No per-session revocation list / device management (logout simply clears the cookie).

## Data Model (Prisma)

Add to `prisma/schema.prisma`:

```prisma
enum Role {
  user
  admin
}

model User {
  id           String       @id @default(cuid())
  nickname     String       @unique
  passwordHash String       // scrypt: "scrypt$<saltHex>$<hashHex>"
  role         Role         @default(user)
  createdAt    DateTime     @default(now())
  submissions  Submission[]
}

model Submission {
  id            String    @id @default(cuid())
  payload       Json      // proposed center/professional, ImageEntry-shaped
  status        String    @default("pending") // pending | approved | rejected
  submittedBy   User      @relation(fields: [submittedById], references: [id])
  submittedById String
  reviewedAt    DateTime?
  reviewNote    String?
  createdAt     DateTime  @default(now())

  @@index([status])
}
```

Add `actorNickname String?` to `AuditLog` so the audit trail records *which admin* made a change now that accounts exist. The existing IP/country/userAgent fields stay.

**Decision:** moderation lives in a **separate `Submission` table**, not a `published` flag on `Point`. This keeps `getEntries()` and every public component untouched and guarantees unmoderated content can never leak into public views. On approval the existing `writePoint()` creates the real `Point`.

## Authentication & Session

- **Password hashing:** `scrypt` from `node:crypto` (no new dependency). Store as `scrypt$<saltHex>$<hashHex>`. Verify with `crypto.timingSafeEqual`.
- **Session:** HttpOnly, `SameSite=Lax`, `Secure` (in prod), signed cookie named `aid_session`.
  - Payload: `{ uid, exp }` (userId + expiry, e.g. 30 days), serialized and signed with HMAC-SHA256 using `SESSION_SECRET`.
  - Cookie format: `base64url(payloadJson).base64url(hmac)`.
  - The **role is NOT baked into the cookie** — protected routes load the user from the DB by `uid` and read the current `role`. This makes promotion/demotion take effect immediately.
- **New env var:** `SESSION_SECRET` (required for auth to function; if missing, auth endpoints return 503 and the app behaves as logged-out).

### `src/lib/auth.ts` (new)

Single module owning auth concerns, so routes stay thin:

- `hashPassword(pw): string`
- `verifyPassword(pw, stored): boolean`
- `signSession(uid): string` / `readSession(cookieValue): { uid } | null`
- `setSessionCookie(uid)` / `clearSessionCookie()` helpers returning `Set-Cookie` strings
- `getCurrentUser(request): Promise<{ id, nickname, role } | null>` — reads cookie, verifies, loads user
- `requireUser(request)` / `requireAdmin(request)` — throw/return 401/403 helpers used by routes

`src/lib/admin-auth.ts`: `checkAdmin(token)` is removed; `reqMeta()` stays (still used for audit metadata).

## Endpoints

All under `src/pages/api/`. `prerender = false`.

| Method | Route | Access | Behavior |
|---|---|---|---|
| POST | `/api/auth/signup` | public | `{nickname, password}` → create user (role `user`), set cookie. 409 + "Ese apodo ya existe" on duplicate. Basic validation (nickname 2–24 chars, password ≥4). |
| POST | `/api/auth/login` | public | `{nickname, password}` → verify, set cookie. Generic 401 "Usuario o clave incorrectos". |
| POST | `/api/auth/logout` | any | clear cookie. |
| GET | `/api/auth/me` | any | `{nickname, role}` or `null`. |
| POST | `/api/submissions` | logged-in user | validate payload, create `Submission(status=pending)`. |
| GET | `/api/admin/submissions` | admin | list submissions (default pending). |
| POST | `/api/admin/submissions/[id]/approve` | admin | `writePoint(payload)` (auto-generate filename like points.ts), set `status=approved`, `reviewedAt`, write audit (`create`). |
| POST | `/api/admin/submissions/[id]/reject` | admin | set `status=rejected`, optional `reviewNote`. |
| GET | `/api/admin/users` | admin | list `{id, nickname, role, createdAt}`. |
| POST | `/api/admin/users/[id]/role` | admin | `{role}` → promote/demote. Guard: cannot demote the last remaining admin. |

**Migrated endpoints** (token → session+admin role): `GET/POST /api/admin/points`, `PATCH/DELETE /api/admin/points/[filename]`, `GET /api/admin/audit`. Each swaps `if (!checkAdmin(request))` for `if (!(await requireAdmin(request)))`.

## UI

### Public sidebar (`src/layouts/Layout.astro`)

Auth widget (logged-out): "Iniciar sesión" (nickname, password, Entrar) with a toggle to "Crear cuenta" (signup). Generic errors. Passwords use `type="password"`.

Logged-in: greeting "Hola, {nickname}", "Cerrar sesión", and a **"Sugerir centro / profesional"** button that opens a focused submission form. State is driven by `GET /api/auth/me` on load; client JS in a small inline/island script (consistent with the site's existing inline-script pattern).

**Submission form fields** (subset of the admin editor): category, title*, organization, specialty, country/state/city, address, description, needs (one per line), contact (phone/whatsapp/instagram/website/email). Coordinates optional via a reused Leaflet `pick-map` selector (same component pattern as the admin editor); admin can still adjust on approval. POST to `/api/submissions`; on success show "Enviado para revisión".

> Note: AID-015 will later upgrade the location inputs (dependent country→state→city selectors) and needs (checklist). The submission form should be structured so those upgrades drop in.

### Admin page (`src/pages/admin-db-9760b48605/index.astro`)

- Replace the `prompt("Token…")` gate with a **login gate**: on load call `/api/auth/me`; if not logged in show an inline login form; if logged in but not admin show "No autorizado". The page stays at its unguessable URL (defense in depth) but real access is the admin role.
- New tabs alongside **Registros** and **Auditoría**:
  - **Pendientes** — table of pending submissions; row click opens the existing editor prefilled from `payload`; Aprobar / Rechazar actions.
  - **Usuarios** — list users with a role toggle (promote/demote), guarded against removing the last admin.
- All `fetch`es drop the `x-admin-token` header and rely on the session cookie (same-origin, sent automatically).

## Seed & Migration

- Prisma migration for `Role`, `User`, `Submission` (and optional `AuditLog.actorNickname`).
- `scripts/seed-users.mjs`: idempotent — ensures a `greg` admin exists with password `1234` (upsert by nickname; only sets password on create). Documented for local + deploy.
- Document `SESSION_SECRET` in the env setup (alongside `DATABASE_URL`); `ADMIN_TOKEN` is removed from code and docs.

## Error Handling & Edge Cases

- Missing `SESSION_SECRET` or DB → auth endpoints 503; sidebar renders logged-out; admin page shows "auth no configurada".
- Duplicate nickname → 409 generic message.
- Invalid/expired/tampered cookie → treated as logged-out (signature check fails closed).
- Demoting/last-admin protection on the role endpoint.
- Submission payload validation server-side (don't trust client): require title + category; strip unknown fields; coerce `needs` to string[].
- Approve is idempotent-safe: if a submission is already approved, return its existing result rather than creating a duplicate `Point`.

## Security Notes

- Passwords never stored or returned in plaintext; never logged.
- Cookie is HttpOnly (not readable by JS → mitigates XSS token theft) and signed (tamper-evident).
- This is still "low-stakes" auth (no rate limiting, no lockout) — acceptable for this project, noted as a known limitation. Rate limiting can be added later if abuse appears.

## Testing

- Unit: `hashPassword`/`verifyPassword` round-trip; `signSession`/`readSession` accept valid and reject tampered/expired cookies.
- Integration (per endpoint): signup→login→me→logout flow; duplicate nickname; submission as user; approve/reject as admin; non-admin blocked (403) on admin routes; logged-out blocked (401).
- Last-admin demotion guard.
- Manual: full sidebar flow + admin Pendientes/Usuarios tabs in the running app.

## Files Touched (summary)

- `prisma/schema.prisma` (+ migration)
- `src/lib/auth.ts` (new), `src/lib/admin-auth.ts` (remove `checkAdmin`)
- `src/lib/db.ts` (helpers for submissions/users, or a new `src/lib/accounts.ts`)
- `src/pages/api/auth/{signup,login,logout,me}.ts` (new)
- `src/pages/api/submissions.ts` (new)
- `src/pages/api/admin/submissions/*.ts`, `src/pages/api/admin/users/*.ts` (new)
- `src/pages/api/admin/points.ts`, `points/[filename].ts`, `audit.ts` (auth swap)
- `src/layouts/Layout.astro` (auth widget + submission form)
- `src/pages/admin-db-9760b48605/index.astro` (login gate + Pendientes/Usuarios tabs)
- `scripts/seed-users.mjs` (new)

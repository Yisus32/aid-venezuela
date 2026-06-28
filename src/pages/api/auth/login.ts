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

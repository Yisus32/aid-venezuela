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

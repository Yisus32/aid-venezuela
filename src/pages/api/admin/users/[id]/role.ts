import type { APIRoute } from "astro";
import { requireAdmin, setRole, countAdmins, getUserById } from "../../../../../lib/accounts";

export const prerender = false;

// The supreme admin can never be demoted (by anyone, including themselves).
const SUPREME = process.env.SEED_ADMIN_NICK || "greg";

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  const role = body?.role === "admin" ? "admin" : "user";

  if (role === "user") {
    const target = await getUserById(params.id!);
    if (!target) return new Response("Usuario no encontrado", { status: 404 });
    if (target.nickname === SUPREME) {
      return new Response("No puedes quitarle el admin al administrador principal", { status: 400 });
    }
    if (target.id === admin.id) {
      return new Response("No puedes quitarte el admin a ti mismo", { status: 400 });
    }
    if ((await countAdmins()) <= 1) {
      return new Response("No puedes quitar al último administrador", { status: 400 });
    }
  }

  await setRole(params.id!, role);
  return Response.json({ ok: true });
};

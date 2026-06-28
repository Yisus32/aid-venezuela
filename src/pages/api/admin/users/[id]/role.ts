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

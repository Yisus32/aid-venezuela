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

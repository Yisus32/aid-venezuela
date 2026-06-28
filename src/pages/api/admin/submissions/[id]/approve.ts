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

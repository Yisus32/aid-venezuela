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
  // The admin may approve with edited content (from the editor modal); fall back
  // to the originally submitted payload when no override is sent.
  let override: any = null;
  try { override = await request.json(); } catch { /* no body → use stored payload */ }
  const payload: any = override && override.title ? { ...override } : { ...(sub.payload as any) };
  if (!payload.filename) {
    payload.filename = "reg-" + (slug(payload.title) || "centro") + "-" + sub.id.slice(-6);
  }
  await writePoint(payload);
  await markSubmission(sub.id, "approved");
  await logAudit({
    action: "create", filename: payload.filename, title: payload.title, category: payload.category,
    actorNickname: admin.nickname, ...reqMeta(request, clientAddress),
  });
  return Response.json({ ok: true, filename: payload.filename });
};

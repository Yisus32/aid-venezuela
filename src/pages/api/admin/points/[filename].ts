import type { APIRoute } from "astro";
import { writePoint, deletePoint, logAudit } from "../../../../lib/db";
import { reqMeta } from "../../../../lib/admin-auth";
import { requireAdmin } from "../../../../lib/accounts";

export const prerender = false;

// PATCH: update the entry with this filename. DELETE: remove it.
export const PATCH: APIRoute = async ({ request, params, clientAddress }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    body.filename = params.filename;
    if (!body.title) throw new Error("Falta 'title'");
    await writePoint(body);
    await logAudit({
      action: "update",
      filename: body.filename,
      title: body.title,
      category: body.category,
      actorNickname: admin.nickname,
      ...reqMeta(request, clientAddress),
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request, params, clientAddress }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  try {
    const removed = await deletePoint(params.filename!);
    await logAudit({
      action: "delete",
      filename: params.filename!,
      title: removed?.title,
      category: removed?.category,
      actorNickname: admin.nickname,
      ...reqMeta(request, clientAddress),
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

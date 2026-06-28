import type { APIRoute } from "astro";
import { getEntries, writePoint, logAudit } from "../../../lib/db";
import { reqMeta } from "../../../lib/admin-auth";
import { requireAdmin } from "../../../lib/accounts";

export const prerender = false;

// GET: list all entries (for the admin table). POST: create a new entry.
export const GET: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  return Response.json(await getEntries());
};

const slug = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    if (!body?.title) throw new Error("Falta el título");
    // Centers no longer need images, so the identifier is auto-generated.
    if (!body.filename) {
      body.filename = "reg-" + (slug(body.title) || "centro") + "-" + Math.random().toString(36).slice(2, 7);
    }
    await writePoint(body);
    await logAudit({
      action: "create",
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

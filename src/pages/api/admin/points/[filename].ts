import type { APIRoute } from "astro";
import { writePoint, deletePoint } from "../../../../lib/db";
import { checkAdmin } from "../../../../lib/admin-auth";

export const prerender = false;

// PATCH: update the entry with this filename. DELETE: remove it.
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    body.filename = params.filename;
    if (!body.title) throw new Error("Falta 'title'");
    await writePoint(body);
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });
  try {
    await deletePoint(params.filename!);
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

import type { APIRoute } from "astro";
import { getEntries, writePoint } from "../../../lib/db";
import { checkAdmin } from "../../../lib/admin-auth";

export const prerender = false;

// GET: list all entries (for the admin table). POST: create a new entry.
export const GET: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await getEntries());
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    if (!body?.filename) throw new Error("Falta 'filename'");
    if (!body?.title) throw new Error("Falta 'title'");
    await writePoint(body);
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

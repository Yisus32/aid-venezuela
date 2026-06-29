import type { APIRoute } from "astro";
import { requireAdmin, listUsers } from "../../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  return Response.json(await listUsers());
};

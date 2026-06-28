import type { APIRoute } from "astro";
import { requireAdmin, listSubmissions } from "../../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  const status = url.searchParams.get("status") ?? "pending";
  return Response.json(await listSubmissions(status === "all" ? undefined : status));
};

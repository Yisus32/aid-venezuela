import type { APIRoute } from "astro";
import { getAuditLog } from "../../../lib/db";
import { requireAdmin } from "../../../lib/accounts";

export const prerender = false;

// Recent audit entries (most recent first). Session-protected.
export const GET: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  return Response.json(await getAuditLog(300));
};

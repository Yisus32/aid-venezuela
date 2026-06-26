import type { APIRoute } from "astro";
import { getAuditLog } from "../../../lib/db";
import { checkAdmin } from "../../../lib/admin-auth";

export const prerender = false;

// Recent audit entries (most recent first). Token-protected.
export const GET: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await getAuditLog(300));
};

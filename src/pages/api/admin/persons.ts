import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/accounts";
import { fetchSosPersons } from "../../../lib/sos";
import { getModerationMap, annotate, groupDuplicates } from "../../../lib/moderation";

// AID-016: admin view of ALL imported persons (incl. hidden), annotated with
// their moderation status/flag and a duplicate heuristic. requireAdmin-guarded.
export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const status = (url.searchParams.get("status") || "").trim().slice(0, 40);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "40", 10) || 40, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const raw = await fetchSosPersons({ q, status, limit, offset });
  const items = groupDuplicates(annotate(raw, await getModerationMap()));
  return Response.json({ items, source: "SOS Venezuela 2026" });
};

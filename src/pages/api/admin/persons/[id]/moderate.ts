import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../../lib/accounts";
import { setModeration } from "../../../../../lib/moderation";

// AID-016: set a person's publication status / flag. Upsert keyed by the SOS
// externalId; never touches the upstream record. requireAdmin-guarded.
export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const admin = await requireAdmin(request);
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const externalId = params.id;
  if (!externalId) return new Response("Falta id", { status: 400 });
  try {
    const body = await request.json().catch(() => ({}));
    const data: { status?: "visible" | "hidden"; flagReason?: string | null; by?: string | null } = {
      by: admin.nickname,
    };
    if (body.status === "visible" || body.status === "hidden") data.status = body.status;
    if (body.flagReason === null) data.flagReason = null;
    else if (typeof body.flagReason === "string") data.flagReason = body.flagReason.slice(0, 80);
    if (data.status === undefined && data.flagReason === undefined) {
      return new Response("Nada que actualizar", { status: 400 });
    }
    const row = await setModeration(externalId, data);
    return Response.json({ ok: true, mod: { status: row.status, flagReason: row.flagReason ?? null } });
  } catch (e: any) {
    return new Response(e?.message || "Error", { status: 400 });
  }
};

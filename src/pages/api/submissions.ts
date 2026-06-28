import type { APIRoute } from "astro";
import { requireUser, createSubmission } from "../../lib/accounts";

export const prerender = false;

function sanitize(body: any) {
  const s = (v: any) => (typeof v === "string" ? v.trim() : "");
  const category = body?.category === "professional" ? "professional" : "center";
  const title = s(body?.title);
  if (!title) throw new Error("Falta el título");
  const needs = Array.isArray(body?.needs)
    ? body.needs.map((n: any) => s(n)).filter(Boolean)
    : s(body?.needs).split("\n").map((x: string) => x.trim()).filter(Boolean);
  const contactKeys = ["phone", "whatsapp", "instagram", "website", "email"] as const;
  const contact: Record<string, string> = {};
  for (const k of contactKeys) { const v = s(body?.contact?.[k]); if (v) contact[k] = v; }
  const lat = Number(body?.coords?.lat), lng = Number(body?.coords?.lng);
  return {
    category, title,
    organization: s(body?.organization) || undefined,
    specialty: s(body?.specialty) || undefined,
    description: s(body?.description) || undefined,
    location: {
      country: s(body?.location?.country) || "Venezuela",
      state: s(body?.location?.state),
      city: s(body?.location?.city),
      address: s(body?.location?.address) || undefined,
    },
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { coords: { lat, lng } } : {}),
    ...(needs.length ? { needs } : {}),
    ...(Object.keys(contact).length ? { contact } : {}),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const user = await requireUser(request);
  if (!user) return new Response("Inicia sesión para enviar", { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  let payload;
  try { payload = sanitize(body); } catch (e: any) { return new Response(e?.message || "Datos inválidos", { status: 400 }); }
  await createSubmission(payload, user.id);
  return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } });
};

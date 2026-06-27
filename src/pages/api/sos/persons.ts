import type { APIRoute } from "astro";

// Proxy del directorio de personas de SOS Venezuela 2026. Reenvía búsqueda y
// paginación, cachea la respuesta y resiste caídas/rate-limit (la API limita a
// ~90 req/min por IP; con el proxy solo nuestra función la consulta). Datos:
// "SOS Venezuela 2026". No desenmascaramos nada: se muestra tal cual llega.
export const prerender = false;

const UPSTREAM = "https://sosvenezuela2026.com/api/persons/list";

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const status = (url.searchParams.get("status") || "").trim().slice(0, 40);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const up = new URL(UPSTREAM);
  if (q) up.searchParams.set("q", q);
  if (status) up.searchParams.set("status", status);
  up.searchParams.set("limit", String(limit));
  up.searchParams.set("offset", String(offset));

  let items: unknown[] = [];
  try {
    const r = await fetch(up, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) items = d;
    }
  } catch {
    /* upstream caído → lista vacía; el cliente muestra el estado de error */
  }

  return new Response(JSON.stringify({ items, source: "SOS Venezuela 2026" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120",
    },
  });
};

import type { APIRoute } from "astro";

// Proxy de estadísticas agregadas (desaparecidos/encontrados) de SOS Venezuela
// 2026. Cacheado; si la API no responde, devolvemos nulos para que la cabecera
// de la pestaña Personas no se rompa. Datos: "SOS Venezuela 2026".
export const prerender = false;

const UPSTREAM = "https://sosvenezuela2026.com/api/persons/stats";

export const GET: APIRoute = async () => {
  let stats: { missing: number | null; found: number | null; total: number | null } = {
    missing: null,
    found: null,
    total: null,
  };
  try {
    const r = await fetch(UPSTREAM, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const d = await r.json();
      stats = {
        missing: Number.isFinite(d?.missing) ? d.missing : null,
        found: Number.isFinite(d?.found) ? d.found : null,
        total: Number.isFinite(d?.total) ? d.total : null,
      };
    }
  } catch {
    /* upstream caído → nulos */
  }

  return new Response(JSON.stringify({ ...stats, source: "SOS Venezuela 2026" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};

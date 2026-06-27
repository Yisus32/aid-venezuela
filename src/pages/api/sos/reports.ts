import type { APIRoute } from "astro";

// Proxy de reportes del mapa (colapsos, fugas, vías…) y de análisis de daño
// estructural recientes de SOS Venezuela 2026. Los reportes traen coordenadas
// (lat_pub/lng_pub) y se pintan en el mapa; los daños no traen coordenadas y se
// listan aparte. Cacheado y resistente a caídas. Datos: "SOS Venezuela 2026".
export const prerender = false;

const REPORTS = "https://sosvenezuela2026.com/api/reports";
const DAMAGE = "https://sosvenezuela2026.com/api/damage/recent";

async function getJson(u: string): Promise<unknown[]> {
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) return d;
    }
  } catch {
    /* upstream caído */
  }
  return [];
}

export const GET: APIRoute = async () => {
  const [reports, damage] = await Promise.all([getJson(REPORTS), getJson(DAMAGE)]);
  return new Response(JSON.stringify({ reports, damage, source: "SOS Venezuela 2026" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120",
    },
  });
};

import type { APIRoute } from "astro";
import { fetchSosPersons } from "../../../lib/sos";
import { getModerationMap, filterVisible } from "../../../lib/moderation";

// Proxy del directorio de personas de SOS Venezuela 2026. Reenvía búsqueda y
// paginación, cachea la respuesta y resiste caídas/rate-limit (la API limita a
// ~90 req/min por IP; con el proxy solo nuestra función la consulta). Datos:
// "SOS Venezuela 2026". No desenmascaramos nada: se muestra tal cual llega.
// AID-016: las personas marcadas como ocultas en moderación se suprimen aquí.
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const status = (url.searchParams.get("status") || "").trim().slice(0, 40);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const raw = await fetchSosPersons({ q, status, limit, offset });
  // Drop hidden entries (if the DB is unavailable, getModerationMap returns {}).
  const items = filterVisible(raw, await getModerationMap());

  return new Response(JSON.stringify({ items, source: "SOS Venezuela 2026" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120",
    },
  });
};

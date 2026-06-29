// Shared fetch for the SOS Venezuela 2026 persons directory. Used by the public
// proxy (api/sos/persons) and the admin moderation endpoint (api/admin/persons).
// Fail-soft: on any upstream error returns [] so callers degrade gracefully.

const UPSTREAM = "https://sosvenezuela2026.com/api/persons/list";

export interface SosPersonsParams {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function fetchSosPersons(p: SosPersonsParams): Promise<any[]> {
  const up = new URL(UPSTREAM);
  if (p.q) up.searchParams.set("q", p.q);
  if (p.status) up.searchParams.set("status", p.status);
  up.searchParams.set("limit", String(p.limit ?? 30));
  up.searchParams.set("offset", String(p.offset ?? 0));
  try {
    const r = await fetch(up, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) return d;
    }
  } catch {
    /* upstream caído → []; el caller muestra el estado de error */
  }
  return [];
}

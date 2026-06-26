// Live official figures, scraped server-side (no CORS limits here).
//
// The dashboard cards call this on every reload; it fetches the official
// source, extracts the numbers, and returns JSON with CORS headers. If the
// source is unreachable or a number isn't found, that field stays `null` and
// the card shows "—" — we never invent figures.
//
// IMPORTANT: the regexes below are a TEMPLATE. Adjust them (or the SOURCE) to
// match the real markup of the official page once its structure is known.

const SOURCE = {
  name: "Protección Civil (Venezuela)",
  url: "https://www.proteccioncivil.gob.ve",
};

// Pull the first integer that appears next to a keyword (handles 1.234 / 1,234).
function near(html, keyword) {
  const re = new RegExp(
    "([\\d][\\d.,]*)\\s*(?:[a-záéíóú ]*\\b)?" + keyword,
    "i",
  );
  const alt = new RegExp(keyword + "[^\\d]{0,40}([\\d][\\d.,]*)", "i");
  const m = html.match(re) || html.match(alt);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export default async () => {
  let figures = { fallecidos: null, rescatados: null, desaparecidos: null };
  let updatedAt = null;

  try {
    const res = await fetch(SOURCE.url, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      figures = {
        fallecidos: near(html, "fallecid") ?? near(html, "muert") ?? near(html, "deceso"),
        rescatados: near(html, "rescatad"),
        desaparecidos: near(html, "desaparecid"),
      };
      updatedAt = new Date().toISOString();
    }
  } catch {
    /* source unreachable → figures stay null */
  }

  return new Response(JSON.stringify({ updatedAt, source: SOURCE, figures }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      // cache 5 min at the edge so we don't hammer the source on every reload
      "cache-control": "public, max-age=300",
    },
  });
};

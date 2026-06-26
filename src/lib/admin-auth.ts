// AID-09: minimal guard for the admin API. The admin page lives at an
// unguessable URL (auth by obscurity) and carries this shared token; the API
// routes require it in the `x-admin-token` header. Replace with real auth
// before any sensitive production use.
export function checkAdmin(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false; // not configured → locked
  return request.headers.get("x-admin-token") === token;
}

/** Best-effort "from where" metadata for the audit log. */
export function reqMeta(request: Request, clientAddress?: string) {
  const h = request.headers;
  const ip =
    clientAddress ||
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    null;
  let country = h.get("x-country") || null;
  if (!country) {
    const geo = h.get("x-nf-geo");
    if (geo) {
      try {
        country = JSON.parse(Buffer.from(geo, "base64").toString())?.country?.code || null;
      } catch {
        /* ignore */
      }
    }
  }
  return { ip, country, userAgent: h.get("user-agent") };
}

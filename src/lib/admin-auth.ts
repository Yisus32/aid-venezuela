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

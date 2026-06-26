// AID-09: minimal guard for the admin API. The admin page lives at an
// unguessable URL (auth by obscurity) and carries this shared token; the API
// routes require it in the `x-admin-token` header. Replace with real auth
// before any sensitive production use.
export function checkAdmin(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false; // not configured → locked
  return request.headers.get("x-admin-token") === token;
}

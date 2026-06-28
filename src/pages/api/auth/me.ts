import type { APIRoute } from "astro";
import { getCurrentUser } from "../../../lib/accounts";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  return Response.json(user ? { nickname: user.nickname, role: user.role } : null);
};

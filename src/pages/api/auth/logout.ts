import type { APIRoute } from "astro";
import { clearCookieHeader } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": clearCookieHeader() },
  });

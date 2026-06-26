// AID-09: serverless-friendly Prisma client. Prisma 7 connects through a driver
// adapter (here, node-postgres) instead of a direct URL in schema.prisma, which
// works with pooled serverless Postgres (Netlify DB / Neon / Supabase).
//
// If DATABASE_URL is not set, getPrisma() returns null and the data layer falls
// back to the static public/images.json — so the site keeps working with no DB.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let cached: PrismaClient | null | undefined;

export function getPrisma(): PrismaClient | null {
  if (cached !== undefined) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    cached = null;
    return cached;
  }
  const adapter = new PrismaPg({ connectionString });
  cached = new PrismaClient({ adapter });
  return cached;
}

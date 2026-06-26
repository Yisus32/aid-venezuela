import { defineConfig } from "prisma/config";

// AID-09: Prisma 7 moves the Migrate connection URL out of schema.prisma.
// Set DATABASE_URL in the environment (or a .env file) before running
// `npx prisma migrate deploy`. The runtime PrismaClient (scripts/seed-db.mjs
// and any API routes) needs a driver adapter or Accelerate URL per Prisma 7 —
// finalize that when the Prisma Compute database is provisioned.
export default defineConfig({
  schema: "prisma/schema.prisma",
});

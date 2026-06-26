import { defineConfig } from "prisma/config";

// AID-09: Prisma 7 moves the Migrate/DB-push connection URL out of
// schema.prisma to here. Uses the DIRECT (non-pooled) connection — migrations
// and DDL must not go through the serverless pooler. The runtime app uses the
// pooled DATABASE_URL via the driver adapter in src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});

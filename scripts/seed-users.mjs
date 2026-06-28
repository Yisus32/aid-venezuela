// AID-013: ensure the demo admin account exists. Idempotent — only sets the
// password on first creation; never overwrites an existing user's password.
// NOTE: bare `new PrismaClient()` fails on Prisma 7 — must use the adapter form.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth.ts";

const NICK = process.env.SEED_ADMIN_NICK || "greg";
const PASS = process.env.SEED_ADMIN_PASS || "1234";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const existing = await prisma.user.findUnique({ where: { nickname: NICK } });
  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
      console.log(`Promoted existing user "${NICK}" to admin.`);
    } else {
      console.log(`Admin "${NICK}" already exists — no change.`);
    }
  } else {
    await prisma.user.create({ data: { nickname: NICK, passwordHash: hashPassword(PASS), role: "admin" } });
    console.log(`Created admin "${NICK}".`);
  }
} finally {
  await prisma.$disconnect();
}

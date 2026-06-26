// AID-09: one-time migration of public/images.json into the Prisma database.
//
//   DATABASE_URL=... node scripts/seed-db.mjs
//
// Idempotent: clears the tables, then re-inserts every entry from images.json.
// Requires `npm install @prisma/client` and a generated client (`npx prisma generate`).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set DATABASE_URL before seeding. Aborting.");
    process.exit(1);
  }
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const db = JSON.parse(
    readFileSync(join(__dirname, "..", "public", "images.json"), "utf-8"),
  );

  // Clear in FK-safe order.
  await prisma.collectionPoint.deleteMany();
  await prisma.person.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.point.deleteMany();
  await prisma.location.deleteMany();
  await prisma.organization.deleteMany();

  const orgCache = new Map();
  async function orgId(name) {
    if (!name) return null;
    if (orgCache.has(name)) return orgCache.get(name);
    const org = await prisma.organization.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    orgCache.set(name, org.id);
    return org.id;
  }

  let n = 0;
  for (const e of db.entries) {
    const loc = await prisma.location.create({
      data: {
        country: e.location?.country ?? "",
        state: e.location?.state ?? "",
        city: e.location?.city ?? "",
        address: e.location?.address ?? null,
        lat: e.coords?.lat ?? null,
        lng: e.coords?.lng ?? null,
      },
    });

    await prisma.point.create({
      data: {
        filename: e.filename,
        code: e.code ?? "",
        category: e.category,
        urgency: e.urgency ?? null,
        title: e.title ?? "",
        specialty: e.specialty ?? null,
        description: e.description ?? null,
        schedule: e.schedule ?? null,
        needs: e.needs ?? [],
        acceptsMonetary: !!e.acceptsMonetary,
        notes: e.notes ?? null,
        source: e.source ?? null,
        path: e.path ?? "",
        format: e.format ?? "",
        fileSize: e.fileSize ?? 0,
        organizationId: await orgId(e.organization),
        locationId: loc.id,
        ...(e.contact && {
          contact: {
            create: {
              phone: e.contact.phone ?? null,
              whatsapp: e.contact.whatsapp ?? null,
              instagram: e.contact.instagram ?? null,
              website: e.contact.website ?? null,
              email: e.contact.email ?? null,
            },
          },
        }),
        ...(e.people?.length && {
          people: {
            create: e.people.map((p) => ({
              name: p.name,
              specialty: p.specialty ?? null,
              registry: p.registry ?? null,
              contact: p.contact ?? null,
            })),
          },
        }),
        ...(e.collectionPoints?.length && {
          collectionPoints: {
            create: e.collectionPoints.map((c) => ({
              state: c.state ?? null,
              location: c.location,
            })),
          },
        }),
      },
    });
    n += 1;
  }

  console.log(`Seeded ${n} points into the database.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

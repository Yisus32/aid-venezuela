// AID-09: single data-access point for the humanitarian entries.
// Reads from the Prisma database when DATABASE_URL is configured; otherwise
// falls back to the static public/images.json (current behaviour). This lets us
// migrate to the DB without touching every component — they all call getEntries().
import fs from "node:fs";
import path from "node:path";
import type { ImageEntry } from "../types";
import { getPrisma } from "./prisma";

function mapPoint(p: any): ImageEntry {
  return {
    filename: p.filename,
    path: p.path ?? "",
    format: p.format ?? "",
    fileSize: p.fileSize ?? 0,
    code: p.code ?? "",
    category: p.category,
    ...(p.urgency && { urgency: p.urgency }),
    title: p.title,
    ...(p.organization?.name && { organization: p.organization.name }),
    ...(p.specialty && { specialty: p.specialty }),
    ...(p.description && { description: p.description }),
    location: {
      country: p.location?.country ?? "",
      state: p.location?.state ?? "",
      city: p.location?.city ?? "",
      ...(p.location?.address && { address: p.location.address }),
    },
    ...(p.location?.lat != null &&
      p.location?.lng != null && {
        coords: { lat: p.location.lat, lng: p.location.lng },
      }),
    ...(p.schedule && { schedule: p.schedule }),
    ...(p.contact && {
      contact: {
        ...(p.contact.phone && { phone: p.contact.phone }),
        ...(p.contact.whatsapp && { whatsapp: p.contact.whatsapp }),
        ...(p.contact.instagram && { instagram: p.contact.instagram }),
        ...(p.contact.website && { website: p.contact.website }),
        ...(p.contact.email && { email: p.contact.email }),
      },
    }),
    ...(p.needs?.length && { needs: p.needs }),
    ...(p.acceptsMonetary && { acceptsMonetary: true }),
    ...(p.people?.length && {
      people: p.people.map((pp: any) => ({
        name: pp.name,
        ...(pp.specialty && { specialty: pp.specialty }),
        ...(pp.registry && { registry: pp.registry }),
        ...(pp.contact && { contact: pp.contact }),
      })),
    }),
    ...(p.collectionPoints?.length && {
      collectionPoints: p.collectionPoints.map((c: any) => ({
        ...(c.state && { state: c.state }),
        location: c.location,
      })),
    }),
    ...(p.notes && { notes: p.notes }),
    ...(p.source && { source: p.source }),
  };
}

const INCLUDE = {
  organization: true,
  location: true,
  contact: true,
  people: true,
  collectionPoints: true,
} as const;

export function dbAvailable(): boolean {
  return getPrisma() !== null;
}

function locationData(e: ImageEntry) {
  return {
    country: e.location?.country ?? "",
    state: e.location?.state ?? "",
    city: e.location?.city ?? "",
    address: e.location?.address ?? null,
    lat: e.coords?.lat ?? null,
    lng: e.coords?.lng ?? null,
  };
}
function pointScalars(e: ImageEntry, organizationId: string | null) {
  return {
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
    organizationId,
  };
}
function nestedCreate(e: ImageEntry) {
  return {
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
  };
}

/** Create or update a point (keyed by its unique filename) and its relations. */
export async function writePoint(e: ImageEntry): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  if (!e.filename) throw new Error("filename is required");

  const organizationId = e.organization
    ? (
        await prisma.organization.upsert({
          where: { name: e.organization },
          update: {},
          create: { name: e.organization },
        })
      ).id
    : null;

  const existing = await prisma.point.findUnique({
    where: { filename: e.filename },
    select: { id: true, locationId: true },
  });

  if (existing) {
    await prisma.location.update({
      where: { id: existing.locationId },
      data: locationData(e),
    });
    await prisma.contact.deleteMany({ where: { pointId: existing.id } });
    await prisma.person.deleteMany({ where: { pointId: existing.id } });
    await prisma.collectionPoint.deleteMany({ where: { pointId: existing.id } });
    await prisma.point.update({
      where: { id: existing.id },
      data: { ...pointScalars(e, organizationId), ...nestedCreate(e) },
    });
  } else {
    const loc = await prisma.location.create({ data: locationData(e) });
    await prisma.point.create({
      data: {
        filename: e.filename,
        ...pointScalars(e, organizationId),
        locationId: loc.id,
        ...nestedCreate(e),
      },
    });
  }
}

/** Delete a point (and its cascading relations) by filename. Returns the
 * deleted record's title/category for the audit log, or null if not found. */
export async function deletePoint(
  filename: string,
): Promise<{ title: string; category: string } | null> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  const p = await prisma.point.findUnique({
    where: { filename },
    select: { id: true, locationId: true, title: true, category: true },
  });
  if (!p) return null;
  await prisma.point.delete({ where: { id: p.id } });
  await prisma.location.delete({ where: { id: p.locationId } }).catch(() => {});
  return { title: p.title, category: p.category };
}

// ---- Audit log (AID-09): records who saved what and from where. ----
export interface AuditEntry {
  action: string;
  filename: string;
  title?: string | null;
  category?: string | null;
  ip?: string | null;
  country?: string | null;
  userAgent?: string | null;
}
export async function logAudit(data: AuditEntry): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        filename: data.filename,
        title: data.title ?? null,
        category: data.category ?? null,
        ip: data.ip ?? null,
        country: data.country ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record:", err);
  }
}
export async function getAuditLog(limit = 300) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/** All entries — from the DB if configured, else the static JSON snapshot. */
export async function getEntries(): Promise<ImageEntry[]> {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const points = await prisma.point.findMany({
        include: INCLUDE,
        orderBy: [{ category: "asc" }, { title: "asc" }],
      });
      return points.map(mapPoint);
    } catch (err) {
      console.error("[db] DB read failed, falling back to images.json:", err);
    }
  }
  const raw = JSON.parse(
    fs.readFileSync(path.resolve("public/images.json"), "utf-8"),
  );
  return raw.entries as ImageEntry[];
}

export type { ImageEntry };

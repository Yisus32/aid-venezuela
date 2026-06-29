// Service-layer moderation for imported SOS persons (AID-016). Hidden entries
// are suppressed from the public feed; the API data is never deleted or altered.
//
// The pure helpers below take the moderation map as data so they're testable.
// DB I/O (getModerationMap/setModeration) lives at the bottom and is guarded by
// dbAvailable().

export interface ModEntry {
  status: "visible" | "hidden";
  flagReason: string | null;
}
export type ModMap = Record<string, ModEntry>;

export function filterVisible<T extends { id: string }>(items: T[], mod: ModMap): T[] {
  return items.filter((it) => mod[it.id]?.status !== "hidden");
}

export function annotate<T extends { id: string }>(items: T[], mod: ModMap): (T & { _mod: ModEntry })[] {
  return items.map((it) => ({
    ...it,
    _mod: mod[it.id] || { status: "visible", flagReason: null },
  }));
}

const fold = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Duplicate key: a shared photo is a strong signal; otherwise fall back to
// name+location so generic names ("Menor reportado") in different places don't
// collapse together.
function dupKey(item: any): string {
  if (item.photo_path) return "p:" + item.photo_path;
  return "n:" + [fold(item.display_name), fold(item.municipio), fold(item.parroquia)].join("|");
}

export function groupDuplicates<T extends Record<string, any>>(items: T[]): (T & { _dupKey: string; _duplicate: boolean })[] {
  const counts: Record<string, number> = {};
  const keyed = items.map((it) => {
    const k = dupKey(it);
    counts[k] = (counts[k] || 0) + 1;
    return { it, k };
  });
  return keyed.map(({ it, k }) => ({ ...it, _dupKey: k, _duplicate: counts[k] > 1 }));
}

// ---- DB I/O (thin; not covered by the pure unit tests) ----

export async function getModerationMap(): Promise<ModMap> {
  const { getPrisma } = await import("./prisma");
  const prisma = getPrisma();
  if (!prisma) return {};
  try {
    const rows = await prisma.personModeration.findMany();
    const map: ModMap = {};
    for (const r of rows) map[r.externalId] = { status: r.status, flagReason: r.flagReason ?? null };
    return map;
  } catch {
    // Table not migrated yet (or transient DB error): degrade to "show all"
    // instead of 500-ing the public persons feed.
    return {};
  }
}

export async function setModeration(
  externalId: string,
  data: { status?: "visible" | "hidden"; flagReason?: string | null; by?: string | null },
) {
  const { getPrisma } = await import("./prisma");
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB no disponible");
  const update: any = {};
  if (data.status !== undefined) update.status = data.status;
  if (data.flagReason !== undefined) update.flagReason = data.flagReason;
  if (data.by !== undefined) update.moderatedBy = data.by;
  return prisma.personModeration.upsert({
    where: { externalId },
    create: {
      externalId,
      status: data.status ?? "visible",
      flagReason: data.flagReason ?? null,
      moderatedBy: data.by ?? null,
    },
    update,
  });
}

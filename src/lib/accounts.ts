// AID-013: DB-backed accounts + moderation queue, and request auth guards.
import { getPrisma } from "./prisma";
import { readCookie, readSession } from "./auth";

export type SafeUser = { id: string; nickname: string; role: "user" | "admin" };

export async function createUser(
  nickname: string,
  passwordHash: string,
  role: "user" | "admin" = "user",
): Promise<SafeUser> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  try {
    const u = await prisma.user.create({
      data: { nickname, passwordHash, role },
      select: { id: true, nickname: true, role: true },
    });
    return u as SafeUser;
  } catch (e: any) {
    if (e?.code === "P2002") throw new Error("DUPLICATE");
    throw e;
  }
}

export async function findByNickname(nickname: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.user.findUnique({
    where: { nickname },
    select: { id: true, nickname: true, passwordHash: true, role: true },
  });
}

export async function listUsers(): Promise<SafeUser[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.user.findMany({
    select: { id: true, nickname: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  }) as any;
}

export async function setRole(id: string, role: "user" | "admin"): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  await prisma.user.update({ where: { id }, data: { role } });
}

export async function countAdmins(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;
  return prisma.user.count({ where: { role: "admin" } });
}

export async function createSubmission(payload: any, submittedById: string | null = null) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  return prisma.submission.create({
    data: { payload, submittedById },
    select: { id: true },
  });
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true, role: true },
  });
  return (u as SafeUser) ?? null;
}

export async function listSubmissions(status?: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.submission.findMany({
    where: status ? { status } : undefined,
    include: { submittedBy: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSubmission(id: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.submission.findUnique({ where: { id } });
}

export async function markSubmission(id: string, status: string, reviewNote?: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not configured");
  await prisma.submission.update({
    where: { id },
    data: { status, reviewNote: reviewNote ?? null, reviewedAt: new Date() },
  });
}

export async function getCurrentUser(request: Request): Promise<SafeUser | null> {
  const sess = readSession(readCookie(request));
  if (!sess) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const u = await prisma.user.findUnique({
    where: { id: sess.uid },
    select: { id: true, nickname: true, role: true },
  });
  return (u as SafeUser) ?? null;
}

export async function requireUser(request: Request): Promise<SafeUser | null> {
  return getCurrentUser(request);
}

export async function requireAdmin(request: Request): Promise<SafeUser | null> {
  const u = await getCurrentUser(request);
  return u && u.role === "admin" ? u : null;
}

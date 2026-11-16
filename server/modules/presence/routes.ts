import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { networkAccounts, userPresence, users } from "../../../db/schema";
import { requireAuthenticatedUser, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const presenceRouter = Router();
const ONLINE_WINDOW_SECONDS = 70;
const heartbeatSchema = z.object({
  module: z.string().trim().min(1).max(100).optional().default("Overview"),
  portalMode: z.enum(["student", "consultant", "learning"]).optional().nullable()
});

presenceRouter.post("/presence/heartbeat", asyncRoute(async (request, response) => {
  const user = await requireAuthenticatedUser(request);
  if (!(["student", "consultant"] as string[]).includes(user.role)) {
    response.status(204).end();
    return;
  }
  const input = heartbeatSchema.parse(request.body ?? {});
  const db = requireDatabase();
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_SECONDS * 1000);
  const [existing] = await db.select().from(userPresence).where(eq(userPresence.userId, user.id)).limit(1);
  const onlineSinceAt = existing && existing.lastSeenAt > cutoff ? existing.onlineSinceAt : now;
  await db.insert(userPresence).values({
    userId: user.id,
    lastSeenAt: now,
    onlineSinceAt,
    currentModule: input.module,
    portalMode: input.portalMode ?? (user.role === "consultant" ? "consultant" : "student"),
    updatedAt: now
  }).onConflictDoUpdate({
    target: userPresence.userId,
    set: {
      lastSeenAt: now,
      onlineSinceAt,
      currentModule: input.module,
      portalMode: input.portalMode ?? (user.role === "consultant" ? "consultant" : "student"),
      updatedAt: now
    }
  });
  response.status(204).end();
}));

presenceRouter.get("/admin/presence/online", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_SECONDS * 1000);
  const rows = await db.select({
    id: users.id,
    name: users.displayName,
    email: users.email,
    phone: users.phone,
    role: users.role,
    accountPrefix: networkAccounts.prefix,
    accountNumericPart: networkAccounts.numericPart,
    currentModule: userPresence.currentModule,
    portalMode: userPresence.portalMode,
    onlineSinceAt: userPresence.onlineSinceAt,
    lastSeenAt: userPresence.lastSeenAt
  }).from(userPresence)
    .innerJoin(users, eq(users.id, userPresence.userId))
    .leftJoin(networkAccounts, and(eq(networkAccounts.ownerUserId, users.id), eq(networkAccounts.isMainAccount, true)))
    .where(and(
      gt(userPresence.lastSeenAt, cutoff),
      eq(users.isActive, true),
      inArray(users.role, ["student", "consultant"]),
      isNull(users.removedAt)
    ))
    .orderBy(desc(userPresence.lastSeenAt));

  const seen = new Set<string>();
  const onlineUsers = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    accountNumber: row.accountPrefix && row.accountNumericPart !== null ? `${row.accountPrefix}${row.accountNumericPart}` : null,
    currentModule: row.currentModule,
    portalMode: row.portalMode,
    onlineSinceAt: row.onlineSinceAt,
    lastSeenAt: row.lastSeenAt
  }));

  response.json({
    users: onlineUsers,
    summary: {
      total: onlineUsers.length,
      students: onlineUsers.filter((user) => user.role === "student").length,
      consultants: onlineUsers.filter((user) => user.role === "consultant").length
    },
    serverTime: now.toISOString(),
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS
  });
}));

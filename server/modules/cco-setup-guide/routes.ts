import { asc, desc, eq, gt, lt } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { auditLogs, ccoSetupGuideVideos } from "../../../db/schema";
import { HttpError, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const ccoSetupGuideRouter = Router();

const createVideoSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(4000).nullable().optional(),
  videoProvider: z.enum(["youtube", "vimeo"]).default("youtube"),
  videoId: z.string().trim().min(2).max(500),
  isPublished: z.boolean().default(false)
});

const updateVideoSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  videoProvider: z.enum(["youtube", "vimeo"]).optional(),
  videoId: z.string().trim().min(2).max(500).optional(),
  isPublished: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");

const moveSchema = z.object({ direction: z.enum(["UP", "DOWN"]) });

ccoSetupGuideRouter.get("/public/cco-setup-guide/videos", asyncRoute(async (_request, response) => {
  const db = requireDatabase();
  const videos = await db.select({
    id: ccoSetupGuideVideos.id,
    title: ccoSetupGuideVideos.title,
    description: ccoSetupGuideVideos.description,
    videoProvider: ccoSetupGuideVideos.videoProvider,
    videoId: ccoSetupGuideVideos.videoId,
    position: ccoSetupGuideVideos.position
  }).from(ccoSetupGuideVideos)
    .where(eq(ccoSetupGuideVideos.isPublished, true))
    .orderBy(asc(ccoSetupGuideVideos.position), asc(ccoSetupGuideVideos.createdAt));
  response.json({ videos });
}));

ccoSetupGuideRouter.get("/admin/cco-setup-guide/videos", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const videos = await db.select().from(ccoSetupGuideVideos)
    .orderBy(asc(ccoSetupGuideVideos.position), asc(ccoSetupGuideVideos.createdAt));
  response.json({ videos });
}));

ccoSetupGuideRouter.post("/admin/cco-setup-guide/videos", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = createVideoSchema.parse(request.body);
  const db = requireDatabase();
  const positions = await db.select({ position: ccoSetupGuideVideos.position }).from(ccoSetupGuideVideos);
  const position = positions.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  const [video] = await db.insert(ccoSetupGuideVideos).values({
    title: input.title,
    description: input.description || null,
    videoProvider: input.videoProvider,
    videoId: input.videoId,
    position,
    isPublished: input.isPublished
  }).returning();
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "CCO_SETUP_GUIDE_VIDEO_CREATED",
    entityType: "CCO_SETUP_GUIDE_VIDEO",
    entityId: video.id,
    metadata: { position, isPublished: input.isPublished }
  });
  response.status(201).json({ video });
}));

ccoSetupGuideRouter.patch("/admin/cco-setup-guide/videos/:id", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = updateVideoSchema.parse(request.body);
  const db = requireDatabase();
  const id = String(request.params.id);
  const [existing] = await db.select().from(ccoSetupGuideVideos).where(eq(ccoSetupGuideVideos.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "CCO Setup Guide video not found.");
  const [video] = await db.update(ccoSetupGuideVideos).set({
    ...input,
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    updatedAt: new Date()
  }).where(eq(ccoSetupGuideVideos.id, id)).returning();
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "CCO_SETUP_GUIDE_VIDEO_UPDATED",
    entityType: "CCO_SETUP_GUIDE_VIDEO",
    entityId: video.id,
    metadata: { changed: Object.keys(input) }
  });
  response.json({ video });
}));

ccoSetupGuideRouter.post("/admin/cco-setup-guide/videos/:id/move", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = moveSchema.parse(request.body);
  const db = requireDatabase();
  const id = String(request.params.id);
  const [current] = await db.select().from(ccoSetupGuideVideos).where(eq(ccoSetupGuideVideos.id, id)).limit(1);
  if (!current) throw new HttpError(404, "CCO Setup Guide video not found.");
  const neighbor = input.direction === "UP"
    ? await db.select().from(ccoSetupGuideVideos).where(lt(ccoSetupGuideVideos.position, current.position)).orderBy(desc(ccoSetupGuideVideos.position)).limit(1)
    : await db.select().from(ccoSetupGuideVideos).where(gt(ccoSetupGuideVideos.position, current.position)).orderBy(asc(ccoSetupGuideVideos.position)).limit(1);
  const other = neighbor[0];
  if (!other) {
    response.json({ moved: false });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(ccoSetupGuideVideos).set({ position: other.position, updatedAt: new Date() }).where(eq(ccoSetupGuideVideos.id, current.id));
    await tx.update(ccoSetupGuideVideos).set({ position: current.position, updatedAt: new Date() }).where(eq(ccoSetupGuideVideos.id, other.id));
  });
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "CCO_SETUP_GUIDE_VIDEO_MOVED",
    entityType: "CCO_SETUP_GUIDE_VIDEO",
    entityId: current.id,
    metadata: { direction: input.direction }
  });
  response.json({ moved: true });
}));

ccoSetupGuideRouter.delete("/admin/cco-setup-guide/videos/:id", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const id = String(request.params.id);
  const [existing] = await db.select().from(ccoSetupGuideVideos).where(eq(ccoSetupGuideVideos.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "CCO Setup Guide video not found.");
  await db.delete(ccoSetupGuideVideos).where(eq(ccoSetupGuideVideos.id, id));
  const remaining = await db.select({ id: ccoSetupGuideVideos.id }).from(ccoSetupGuideVideos)
    .orderBy(asc(ccoSetupGuideVideos.position), asc(ccoSetupGuideVideos.createdAt));
  for (let index = 0; index < remaining.length; index += 1) {
    await db.update(ccoSetupGuideVideos).set({ position: index + 1, updatedAt: new Date() }).where(eq(ccoSetupGuideVideos.id, remaining[index].id));
  }
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "CCO_SETUP_GUIDE_VIDEO_DELETED",
    entityType: "CCO_SETUP_GUIDE_VIDEO",
    entityId: existing.id,
    metadata: { title: existing.title }
  });
  response.status(204).end();
}));

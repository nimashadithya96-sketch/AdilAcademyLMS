import { asc, desc, eq, gt, lt } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { auditLogs, studentTrainingVideos } from "../../../db/schema";
import { HttpError, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const studentTrainingRouter = Router();

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

// Public catalog: published video metadata is visible, but provider / video ID are never exposed.
studentTrainingRouter.get("/public/student-training/videos", asyncRoute(async (_request, response) => {
  const db = requireDatabase();
  const videos = await db.select({
    id: studentTrainingVideos.id,
    title: studentTrainingVideos.title,
    description: studentTrainingVideos.description,
    position: studentTrainingVideos.position
  }).from(studentTrainingVideos)
    .where(eq(studentTrainingVideos.isPublished, true))
    .orderBy(asc(studentTrainingVideos.position), asc(studentTrainingVideos.createdAt));
  response.json({ videos });
}));

// Registered account access: published video playback data is available only after authentication.
// A consultant is also an already-registered Adil Academy account, so consultant accounts keep access.
studentTrainingRouter.get("/student/student-training/videos", asyncRoute(async (request, response) => {
  await requireRole(request, ["student", "consultant"]);
  const db = requireDatabase();
  const videos = await db.select({
    id: studentTrainingVideos.id,
    title: studentTrainingVideos.title,
    description: studentTrainingVideos.description,
    videoProvider: studentTrainingVideos.videoProvider,
    videoId: studentTrainingVideos.videoId,
    position: studentTrainingVideos.position
  }).from(studentTrainingVideos)
    .where(eq(studentTrainingVideos.isPublished, true))
    .orderBy(asc(studentTrainingVideos.position), asc(studentTrainingVideos.createdAt));
  response.json({ videos, unlocked: true });
}));

studentTrainingRouter.get("/admin/student-training/videos", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const videos = await db.select().from(studentTrainingVideos)
    .orderBy(asc(studentTrainingVideos.position), asc(studentTrainingVideos.createdAt));
  response.json({ videos });
}));

studentTrainingRouter.post("/admin/student-training/videos", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = createVideoSchema.parse(request.body);
  const db = requireDatabase();
  const positions = await db.select({ position: studentTrainingVideos.position }).from(studentTrainingVideos);
  const position = positions.reduce((max, item) => Math.max(max, item.position), 0) + 1;

  const [video] = await db.insert(studentTrainingVideos).values({
    title: input.title,
    description: input.description || null,
    videoProvider: input.videoProvider,
    videoId: input.videoId,
    position,
    isPublished: input.isPublished
  }).returning();

  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "STUDENT_TRAINING_VIDEO_CREATED",
    entityType: "STUDENT_TRAINING_VIDEO",
    entityId: video.id,
    metadata: { position, isPublished: input.isPublished }
  });

  response.status(201).json({ video });
}));

studentTrainingRouter.patch("/admin/student-training/videos/:id", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = updateVideoSchema.parse(request.body);
  const db = requireDatabase();
  const id = String(request.params.id);

  const [existing] = await db.select().from(studentTrainingVideos).where(eq(studentTrainingVideos.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "Student Training video not found.");

  const [video] = await db.update(studentTrainingVideos).set({
    ...input,
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    updatedAt: new Date()
  }).where(eq(studentTrainingVideos.id, id)).returning();

  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "STUDENT_TRAINING_VIDEO_UPDATED",
    entityType: "STUDENT_TRAINING_VIDEO",
    entityId: video.id,
    metadata: { changed: Object.keys(input) }
  });

  response.json({ video });
}));

studentTrainingRouter.post("/admin/student-training/videos/:id/move", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = moveSchema.parse(request.body);
  const db = requireDatabase();
  const id = String(request.params.id);

  const [current] = await db.select().from(studentTrainingVideos).where(eq(studentTrainingVideos.id, id)).limit(1);
  if (!current) throw new HttpError(404, "Student Training video not found.");

  const neighbor = input.direction === "UP"
    ? await db.select().from(studentTrainingVideos)
        .where(lt(studentTrainingVideos.position, current.position))
        .orderBy(desc(studentTrainingVideos.position))
        .limit(1)
    : await db.select().from(studentTrainingVideos)
        .where(gt(studentTrainingVideos.position, current.position))
        .orderBy(asc(studentTrainingVideos.position))
        .limit(1);

  const other = neighbor[0];
  if (!other) {
    response.json({ moved: false });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(studentTrainingVideos)
      .set({ position: other.position, updatedAt: new Date() })
      .where(eq(studentTrainingVideos.id, current.id));

    await tx.update(studentTrainingVideos)
      .set({ position: current.position, updatedAt: new Date() })
      .where(eq(studentTrainingVideos.id, other.id));
  });

  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "STUDENT_TRAINING_VIDEO_MOVED",
    entityType: "STUDENT_TRAINING_VIDEO",
    entityId: current.id,
    metadata: { direction: input.direction }
  });

  response.json({ moved: true });
}));

studentTrainingRouter.delete("/admin/student-training/videos/:id", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const id = String(request.params.id);

  const [existing] = await db.select().from(studentTrainingVideos).where(eq(studentTrainingVideos.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "Student Training video not found.");

  await db.delete(studentTrainingVideos).where(eq(studentTrainingVideos.id, id));

  const remaining = await db.select({ id: studentTrainingVideos.id }).from(studentTrainingVideos)
    .orderBy(asc(studentTrainingVideos.position), asc(studentTrainingVideos.createdAt));

  for (let index = 0; index < remaining.length; index += 1) {
    await db.update(studentTrainingVideos)
      .set({ position: index + 1, updatedAt: new Date() })
      .where(eq(studentTrainingVideos.id, remaining[index].id));
  }

  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "STUDENT_TRAINING_VIDEO_DELETED",
    entityType: "STUDENT_TRAINING_VIDEO",
    entityId: existing.id,
    metadata: { title: existing.title }
  });

  response.status(204).end();
}));

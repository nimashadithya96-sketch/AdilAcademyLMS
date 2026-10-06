import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  auditLogs,
  courses,
  revisionSeries,
  revisionVideos,
  revisionZoomSessions
} from "../../../db/schema";
import { HttpError, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const revisionRouter = Router();

type RevisionLevel = "BASIC" | "ADVANCED";

const levelSchema = z.enum(["BASIC", "ADVANCED"]);
const courseQuerySchema = z.object({
  courseId: z.string().uuid()
});
const videoCreateSchema = z.object({
  courseId: z.string().uuid(),
  level: levelSchema,
  title: z.string().trim().min(2).max(180),
  videoProvider: z.enum(["youtube", "vimeo"]).default("youtube"),
  videoId: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().max(30000).nullable().optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).default(0),
  isPublished: z.boolean().default(false)
});
const videoUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  videoProvider: z.enum(["youtube", "vimeo"]).optional(),
  videoId: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().max(30000).nullable().optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  isPublished: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");
const moveSchema = z.object({ direction: z.enum(["UP", "DOWN"]) });
const seriesStatusSchema = z.object({ isComplete: z.boolean() });

// ADIL_ADVANCE_REVISION_ZOOM_V56
const zoomUrlSchema = z.string().trim().url().max(1500).refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "zoom.us" || host.endsWith(".zoom.us"));
  } catch {
    return false;
  }
}, "Enter a valid https:// Zoom meeting link.");
const zoomSessionCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  zoomUrl: zoomUrlSchema,
  description: z.string().trim().max(5000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).default(120), // ADIL_ADVANCE_REVISION_ZOOM_V56_1
  isPublished: z.boolean().default(false)
});
const zoomSessionUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  zoomUrl: zoomUrlSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(), // ADIL_ADVANCE_REVISION_ZOOM_V56_1
  isPublished: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");

async function ensureSeries(
  db: ReturnType<typeof requireDatabase>,
  courseId: string
) {
  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) throw new HttpError(404, "Course not found.");

  await db
    .insert(revisionSeries)
    .values([
      { courseId, level: "BASIC" },
      { courseId, level: "ADVANCED" }
    ])
    .onConflictDoNothing();

  const items = await db
    .select()
    .from(revisionSeries)
    .where(eq(revisionSeries.courseId, courseId));

  return { course, items };
}

async function getSeriesByLevel(
  db: ReturnType<typeof requireDatabase>,
  courseId: string,
  level: RevisionLevel
) {
  await ensureSeries(db, courseId);
  const [series] = await db
    .select()
    .from(revisionSeries)
    .where(and(eq(revisionSeries.courseId, courseId), eq(revisionSeries.level, level)))
    .limit(1);
  if (!series) throw new HttpError(500, "Revision series could not be initialized.");
  return series;
}

async function requireEditableSeries(
  db: ReturnType<typeof requireDatabase>,
  seriesId: string
) {
  const [series] = await db
    .select()
    .from(revisionSeries)
    .where(eq(revisionSeries.id, seriesId))
    .limit(1);
  if (!series) throw new HttpError(404, "Revision series not found.");
  if (series.isComplete) {
    throw new HttpError(409, "This revision series is marked Complete. Reopen the series before editing videos.");
  }
  return series;
}

revisionRouter.get(
  "/admin/revision/courses",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const items = await db
      .select({
        id: courses.id,
        title: courses.title,
        isPublished: courses.isPublished,
        thumbnailUrl: courses.thumbnailUrl
      })
      .from(courses)
      .orderBy(asc(courses.createdAt));
    response.json({ courses: items });
  })
);

revisionRouter.get(
  "/admin/revision",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const input = courseQuerySchema.parse({ courseId: request.query.courseId });
    const db = requireDatabase();
    const { course, items } = await ensureSeries(db, input.courseId);

    const orderedSeries = (["BASIC", "ADVANCED"] as RevisionLevel[]).map((level) => {
      const series = items.find((item) => item.level === level);
      if (!series) throw new HttpError(500, "Revision series initialization failed.");
      return series;
    });

    const result = await Promise.all(orderedSeries.map(async (series) => {
      const videos = await db
        .select()
        .from(revisionVideos)
        .where(eq(revisionVideos.seriesId, series.id))
        .orderBy(asc(revisionVideos.position), asc(revisionVideos.createdAt));
      return {
        ...series,
        videoCount: videos.length,
        publishedCount: videos.filter((video) => video.isPublished).length,
        videos
      };
    }));

    response.json({ course, series: result });
  })
);

revisionRouter.post(
  "/admin/revision/videos",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = videoCreateSchema.parse(request.body);
    const db = requireDatabase();
    const series = await getSeriesByLevel(db, input.courseId, input.level);
    await requireEditableSeries(db, series.id);

    const existing = await db
      .select({ position: revisionVideos.position })
      .from(revisionVideos)
      .where(eq(revisionVideos.seriesId, series.id))
      .orderBy(asc(revisionVideos.position));
    const position = existing.reduce((max, item) => Math.max(max, item.position), 0) + 1;

    const [created] = await db
      .insert(revisionVideos)
      .values({
        seriesId: series.id,
        title: input.title,
        videoProvider: input.videoProvider,
        videoId: input.videoId || null,
        content: input.content || null,
        durationSeconds: input.durationSeconds,
        position,
        isPublished: input.isPublished
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "REVISION_VIDEO_CREATED",
      entityType: "REVISION_VIDEO",
      entityId: created.id,
      metadata: { courseId: input.courseId, level: input.level, position }
    });

    response.status(201).json({ video: created });
  })
);

revisionRouter.patch(
  "/admin/revision/videos/:id",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = videoUpdateSchema.parse(request.body);
    const db = requireDatabase();
    const videoId = String(request.params.id);
    const [existing] = await db
      .select()
      .from(revisionVideos)
      .where(eq(revisionVideos.id, videoId))
      .limit(1);
    if (!existing) throw new HttpError(404, "Revision video not found.");
    await requireEditableSeries(db, existing.seriesId);

    const [updated] = await db
      .update(revisionVideos)
      .set({
        ...input,
        ...(input.videoId !== undefined ? { videoId: input.videoId || null } : {}),
        ...(input.content !== undefined ? { content: input.content || null } : {}),
        updatedAt: new Date()
      })
      .where(eq(revisionVideos.id, videoId))
      .returning();

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "REVISION_VIDEO_UPDATED",
      entityType: "REVISION_VIDEO",
      entityId: videoId,
      metadata: input
    });

    response.json({ video: updated });
  })
);

revisionRouter.post(
  "/admin/revision/videos/:id/move",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = moveSchema.parse(request.body);
    const db = requireDatabase();
    const videoId = String(request.params.id);
    const [existing] = await db
      .select()
      .from(revisionVideos)
      .where(eq(revisionVideos.id, videoId))
      .limit(1);
    if (!existing) throw new HttpError(404, "Revision video not found.");
    await requireEditableSeries(db, existing.seriesId);

    const ordered = await db
      .select()
      .from(revisionVideos)
      .where(eq(revisionVideos.seriesId, existing.seriesId))
      .orderBy(asc(revisionVideos.position), asc(revisionVideos.createdAt));
    const index = ordered.findIndex((item) => item.id === existing.id);
    const targetIndex = input.direction === "UP" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      response.json({ moved: false });
      return;
    }
    const target = ordered[targetIndex];
    await db.transaction(async (tx) => {
      await tx.update(revisionVideos).set({ position: target.position, updatedAt: new Date() }).where(eq(revisionVideos.id, existing.id));
      await tx.update(revisionVideos).set({ position: existing.position, updatedAt: new Date() }).where(eq(revisionVideos.id, target.id));
    });

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "REVISION_VIDEO_REORDERED",
      entityType: "REVISION_VIDEO",
      entityId: videoId,
      metadata: { direction: input.direction }
    });
    response.json({ moved: true });
  })
);

revisionRouter.delete(
  "/admin/revision/videos/:id",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const videoId = String(request.params.id);
    const [existing] = await db
      .select()
      .from(revisionVideos)
      .where(eq(revisionVideos.id, videoId))
      .limit(1);
    if (!existing) throw new HttpError(404, "Revision video not found.");
    await requireEditableSeries(db, existing.seriesId);

    await db.delete(revisionVideos).where(eq(revisionVideos.id, videoId));
    const remaining = await db
      .select()
      .from(revisionVideos)
      .where(eq(revisionVideos.seriesId, existing.seriesId))
      .orderBy(asc(revisionVideos.position), asc(revisionVideos.createdAt));
    for (let index = 0; index < remaining.length; index += 1) {
      const desired = index + 1;
      if (remaining[index].position !== desired) {
        await db.update(revisionVideos).set({ position: desired, updatedAt: new Date() }).where(eq(revisionVideos.id, remaining[index].id));
      }
    }

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "REVISION_VIDEO_DELETED",
      entityType: "REVISION_VIDEO",
      entityId: videoId,
      metadata: { seriesId: existing.seriesId, title: existing.title }
    });
    response.json({ success: true, message: "Revision video permanently deleted." });
  })
);

revisionRouter.patch(
  "/admin/revision/series/:id",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = seriesStatusSchema.parse(request.body);
    const db = requireDatabase();
    const seriesId = String(request.params.id);
    const [series] = await db
      .select()
      .from(revisionSeries)
      .where(eq(revisionSeries.id, seriesId))
      .limit(1);
    if (!series) throw new HttpError(404, "Revision series not found.");

    if (input.isComplete) {
      const videos = await db
        .select()
        .from(revisionVideos)
        .where(eq(revisionVideos.seriesId, seriesId))
        .orderBy(asc(revisionVideos.position));
      if (!videos.length) {
        throw new HttpError(400, "Add at least one revision video before marking this series Complete.");
      }
      if (videos.some((video) => !video.isPublished)) {
        throw new HttpError(400, "Publish every revision video before marking this series Complete.");
      }
      if (videos.some((video) => !video.videoId?.trim())) {
        throw new HttpError(400, "Every published revision video needs a valid Video URL or Video ID before the series can be completed.");
      }
    }

    const [updated] = await db
      .update(revisionSeries)
      .set({
        isComplete: input.isComplete,
        completedAt: input.isComplete ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(revisionSeries.id, seriesId))
      .returning();

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: input.isComplete ? "REVISION_SERIES_COMPLETED" : "REVISION_SERIES_REOPENED",
      entityType: "REVISION_SERIES",
      entityId: seriesId,
      metadata: { courseId: series.courseId, level: series.level }
    });

    response.json({ series: updated });
  })
);


// ADIL_ADVANCE_REVISION_ZOOM_V56: Admin manages direct Zoom live links for Advanced Revision.
revisionRouter.get(
  "/admin/revision/zoom-sessions",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const input = courseQuerySchema.parse({ courseId: request.query.courseId });
    const db = requireDatabase();
    const sessions = await db
      .select()
      .from(revisionZoomSessions)
      .where(eq(revisionZoomSessions.courseId, input.courseId))
      .orderBy(asc(revisionZoomSessions.scheduledAt), asc(revisionZoomSessions.createdAt));
    response.json({ sessions });
  })
);

revisionRouter.post(
  "/admin/revision/zoom-sessions",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = zoomSessionCreateSchema.parse(request.body);
    const db = requireDatabase();
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
    if (!course) throw new HttpError(404, "Course not found.");

    const [created] = await db.insert(revisionZoomSessions).values({
      courseId: input.courseId,
      title: input.title,
      zoomUrl: input.zoomUrl,
      description: input.description || null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      durationMinutes: input.durationMinutes, // ADIL_ADVANCE_REVISION_ZOOM_V56_1
      isPublished: input.isPublished
    }).returning();

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "ADVANCE_REVISION_ZOOM_CREATED",
      entityType: "REVISION_ZOOM_SESSION",
      entityId: created.id,
      metadata: { courseId: input.courseId, title: input.title, isPublished: input.isPublished }
    });
    response.status(201).json({ session: created });
  })
);

revisionRouter.patch(
  "/admin/revision/zoom-sessions/:id",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = zoomSessionUpdateSchema.parse(request.body);
    const db = requireDatabase();
    const sessionId = String(request.params.id);
    const [existing] = await db.select().from(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId)).limit(1);
    if (!existing) throw new HttpError(404, "Zoom live class not found.");

    const updateValues = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.zoomUrl !== undefined ? { zoomUrl: input.zoomUrl } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}), // ADIL_ADVANCE_REVISION_ZOOM_V56_1
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      updatedAt: new Date()
    };
    const [updated] = await db.update(revisionZoomSessions).set(updateValues).where(eq(revisionZoomSessions.id, sessionId)).returning();

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "ADVANCE_REVISION_ZOOM_UPDATED",
      entityType: "REVISION_ZOOM_SESSION",
      entityId: sessionId,
      metadata: { changed: Object.keys(input) }
    });
    response.json({ session: updated });
  })
);

revisionRouter.delete(
  "/admin/revision/zoom-sessions/:id",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const sessionId = String(request.params.id);
    const [existing] = await db.select().from(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId)).limit(1);
    if (!existing) throw new HttpError(404, "Zoom live class not found.");
    await db.delete(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId));
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "ADVANCE_REVISION_ZOOM_DELETED",
      entityType: "REVISION_ZOOM_SESSION",
      entityId: sessionId,
      metadata: { courseId: existing.courseId, title: existing.title }
    });
    response.json({ success: true });
  })
);

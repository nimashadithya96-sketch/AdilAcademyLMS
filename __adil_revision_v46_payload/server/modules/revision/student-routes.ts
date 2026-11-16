import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  courses,
  revisionSeries,
  revisionStudentAccess,
  revisionStudentLevelState,
  revisionVideoProgress,
  revisionVideos
} from "../../../db/schema";
import { HttpError, requireAuthenticatedUser } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";
import {
  buildRevisionLevelView,
  captureRevisionMidnightRollover,
  ensureRevisionEligibilityState,
  getRevisionStudentOverview,
  maybeUnlockAdvancedRevision,
  type RevisionLevel
} from "./student-service";

export const revisionStudentRouter = Router();

const progressInput = z.object({
  revisionVideoId: z.string().uuid(),
  elapsedSeconds: z.coerce.number().int().min(1).max(15),
  durationSeconds: z.coerce.number().int().min(10).max(86400)
});

const resumeInput = z.object({
  revisionVideoId: z.string().uuid(),
  currentTimeSeconds: z.coerce.number().min(0).max(86400),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional()
});

async function loadVideoRecord(db: ReturnType<typeof requireDatabase>, videoId: string) {
  const [record] = await db
    .select({
      videoId: revisionVideos.id,
      title: revisionVideos.title,
      videoProvider: revisionVideos.videoProvider,
      videoIdValue: revisionVideos.videoId,
      content: revisionVideos.content,
      durationSeconds: revisionVideos.durationSeconds,
      position: revisionVideos.position,
      isPublished: revisionVideos.isPublished,
      seriesId: revisionSeries.id,
      level: revisionSeries.level,
      courseId: revisionSeries.courseId,
      courseTitle: courses.title
    })
    .from(revisionVideos)
    .innerJoin(revisionSeries, eq(revisionVideos.seriesId, revisionSeries.id))
    .innerJoin(courses, eq(revisionSeries.courseId, courses.id))
    .where(eq(revisionVideos.id, videoId))
    .limit(1);
  return record ?? null;
}

async function requireStudentVideoAccess(
  db: ReturnType<typeof requireDatabase>,
  userId: string,
  revisionVideoId: string
) {
  const unlock = await ensureRevisionEligibilityState(db, userId);
  if (!unlock.enrollment || !unlock.access?.revisionUnlockedAt) {
    throw new HttpError(
      403,
      "Revision is locked. Complete every My Course lesson and pass every Q&A assessment first."
    );
  }

  await maybeUnlockAdvancedRevision(db, userId, unlock.enrollment.courseId);

  const record = await loadVideoRecord(db, revisionVideoId);
  if (!record || !record.isPublished || record.courseId !== unlock.enrollment.courseId) {
    throw new HttpError(404, "Revision video not found.");
  }
  const level = record.level as RevisionLevel;

  const [access] = await db
    .select()
    .from(revisionStudentAccess)
    .where(
      and(
        eq(revisionStudentAccess.userId, userId),
        eq(revisionStudentAccess.courseId, record.courseId)
      )
    )
    .limit(1);
  const levelUnlockedAt = level === "BASIC" ? access?.revisionUnlockedAt : access?.advancedUnlockedAt;
  const levelView = await buildRevisionLevelView(
    db,
    userId,
    record.courseId,
    level,
    levelUnlockedAt ?? null
  );
  const videoView = levelView.videos.find((item) => item.id === revisionVideoId);
  if (!videoView) throw new HttpError(404, "Revision video not found.");
  if (videoView.locked) {
    throw new HttpError(403, videoView.lockMessage ?? "This revision video is locked.");
  }

  return { record, level, levelView, videoView };
}

revisionStudentRouter.get(
  "/student/revision",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const overview = await getRevisionStudentOverview(db, user.id);

    let courseTitle: string | null = null;
    if (overview.courseId) {
      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, overview.courseId))
        .limit(1);
      courseTitle = course?.title ?? null;
    }

    response.json({
      ...overview,
      courseTitle,
      serverNow: new Date().toISOString()
    });
  })
);

revisionStudentRouter.get(
  "/student/revision/videos/:id",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const { record, videoView } = await requireStudentVideoAccess(
      db,
      user.id,
      String(request.params.id)
    );
    const [progress] = await db
      .select()
      .from(revisionVideoProgress)
      .where(
        and(
          eq(revisionVideoProgress.userId, user.id),
          eq(revisionVideoProgress.videoId, record.videoId)
        )
      )
      .limit(1);

    response.json({
      video: {
        id: record.videoId,
        title: record.title,
        level: record.level,
        courseTitle: record.courseTitle,
        videoProvider: record.videoProvider,
        videoId: record.videoIdValue,
        content: record.content,
        durationSeconds: record.durationSeconds || progress?.detectedDurationSeconds || 0,
        progressPercent: progress?.progressPercent ?? videoView.progressPercent ?? 0,
        watchedSeconds: progress?.watchedSeconds ?? 0,
        resumeSeconds: progress?.resumeSeconds ?? 0
      }
    });
  })
);

revisionStudentRouter.post(
  "/student/revision/progress",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const input = progressInput.parse(request.body);
    const db = requireDatabase();
    const { record, level } = await requireStudentVideoAccess(db, user.id, input.revisionVideoId);

    let effectiveDurationSeconds = record.durationSeconds > 0
      ? record.durationSeconds
      : input.durationSeconds;
    if (record.durationSeconds <= 0) {
      const [updatedVideo] = await db
        .update(revisionVideos)
        .set({ durationSeconds: input.durationSeconds, updatedAt: new Date() })
        .where(eq(revisionVideos.id, record.videoId))
        .returning({ durationSeconds: revisionVideos.durationSeconds });
      effectiveDurationSeconds = updatedVideo?.durationSeconds ?? input.durationSeconds;
    }

    const [current] = await db
      .select()
      .from(revisionVideoProgress)
      .where(
        and(
          eq(revisionVideoProgress.userId, user.id),
          eq(revisionVideoProgress.videoId, record.videoId)
        )
      )
      .limit(1);

    const now = new Date();
    await captureRevisionMidnightRollover(
      db,
      user.id,
      record.courseId,
      level,
      record.videoId,
      current?.lastHeartbeatAt,
      now
    );

    const elapsedWallSeconds = current?.lastHeartbeatAt
      ? Math.max(0, Math.floor((now.getTime() - current.lastHeartbeatAt.getTime()) / 1000))
      : input.elapsedSeconds;
    const acceptedSeconds = current?.progressPercent === 100
      ? 0
      : Math.min(input.elapsedSeconds, Math.max(0, elapsedWallSeconds + 2));
    const restoredWatchedSeconds = current
      ? Math.max(
          current.watchedSeconds,
          Math.floor((current.progressPercent / 100) * effectiveDurationSeconds)
        )
      : 0;
    const watchedSeconds = Math.min(
      effectiveDurationSeconds,
      restoredWatchedSeconds + acceptedSeconds
    );
    const completed = current?.progressPercent === 100 ||
      watchedSeconds >= Math.max(1, effectiveDurationSeconds - 2);
    const progressPercent = completed
      ? 100
      : Math.max(
          current?.progressPercent ?? 0,
          Math.min(99, Math.floor((watchedSeconds / effectiveDurationSeconds) * 100))
        );
    const reachedEightyAt = current?.reachedEightyAt ??
      (progressPercent >= 80 ? now : null);
    const completedAt = completed ? current?.completedAt ?? now : null;

    const [saved] = await db
      .insert(revisionVideoProgress)
      .values({
        userId: user.id,
        videoId: record.videoId,
        progressPercent,
        watchedSeconds,
        detectedDurationSeconds: effectiveDurationSeconds,
        reachedEightyAt,
        lastHeartbeatAt: now,
        completedAt,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [revisionVideoProgress.userId, revisionVideoProgress.videoId],
        set: {
          progressPercent,
          watchedSeconds,
          detectedDurationSeconds: effectiveDurationSeconds,
          reachedEightyAt,
          lastHeartbeatAt: now,
          completedAt,
          updatedAt: now
        }
      })
      .returning();

    const advanced = level === "BASIC"
      ? await maybeUnlockAdvancedRevision(db, user.id, record.courseId)
      : { newlyUnlocked: false };
    const overview = await getRevisionStudentOverview(db, user.id);

    response.json({
      progress: saved,
      acceptedSeconds,
      durationSeconds: effectiveDurationSeconds,
      newlyAdvancedUnlocked: advanced.newlyUnlocked,
      overview: {
        ...overview,
        courseTitle: record.courseTitle,
        serverNow: now.toISOString()
      }
    });
  })
);

revisionStudentRouter.post(
  "/student/revision/resume-position",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const input = resumeInput.parse(request.body);
    const db = requireDatabase();
    const { record } = await requireStudentVideoAccess(db, user.id, input.revisionVideoId);
    const duration = Math.max(0, record.durationSeconds || input.durationSeconds || 0);
    const resumeSeconds = duration > 0
      ? Math.min(Math.max(0, Math.floor(input.currentTimeSeconds)), Math.max(0, duration - 1))
      : Math.max(0, Math.floor(input.currentTimeSeconds));
    const now = new Date();

    const [saved] = await db
      .insert(revisionVideoProgress)
      .values({
        userId: user.id,
        videoId: record.videoId,
        resumeSeconds,
        detectedDurationSeconds: duration,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [revisionVideoProgress.userId, revisionVideoProgress.videoId],
        set: { resumeSeconds, detectedDurationSeconds: duration, updatedAt: now }
      })
      .returning({ resumeSeconds: revisionVideoProgress.resumeSeconds });

    response.json({ resumeSeconds: saved?.resumeSeconds ?? resumeSeconds });
  })
);

revisionStudentRouter.post(
  "/student/revision/welcome-seen",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const unlock = await ensureRevisionEligibilityState(db, user.id);
    if (!unlock.access?.revisionUnlockedAt) throw new HttpError(403, "Revision is not unlocked yet.");
    const now = new Date();
    const [saved] = await db
      .update(revisionStudentAccess)
      .set({ welcomeSeenAt: unlock.access.welcomeSeenAt ?? now, updatedAt: now })
      .where(eq(revisionStudentAccess.id, unlock.access.id))
      .returning();
    response.json({ access: saved });
  })
);

revisionStudentRouter.post(
  "/student/revision/advanced-congratulations-seen",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const unlock = await ensureRevisionEligibilityState(db, user.id);
    if (!unlock.enrollment) throw new HttpError(403, "Course enrollment required.");
    const advanced = await maybeUnlockAdvancedRevision(db, user.id, unlock.enrollment.courseId);
    if (!advanced.access?.advancedUnlockedAt) throw new HttpError(403, "Advanced Revision is not unlocked yet.");
    const now = new Date();
    const [saved] = await db
      .update(revisionStudentAccess)
      .set({
        advancedCongratulationsSeenAt: advanced.access.advancedCongratulationsSeenAt ?? now,
        updatedAt: now
      })
      .where(eq(revisionStudentAccess.id, advanced.access.id))
      .returning();
    response.json({ access: saved });
  })
);

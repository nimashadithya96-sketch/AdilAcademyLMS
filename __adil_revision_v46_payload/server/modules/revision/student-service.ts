import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireDatabase } from "../../../db/client";
import {
  courseSections,
  enrollments,
  lessonProgress,
  lessonQuizAttempts,
  lessonQuizQuestions,
  lessons,
  revisionSeries,
  revisionStudentAccess,
  revisionStudentLevelState,
  revisionVideoProgress,
  revisionVideos
} from "../../../db/schema";

export const REVISION_PASS_PERCENT = 75;
export const REVISION_SEQUENTIAL_PERCENT = 80;
export const REVISION_DAILY_VIDEO_LIMIT = 3;

export type RevisionLevel = "BASIC" | "ADVANCED";
type Db = ReturnType<typeof requireDatabase>;

const COLOMBO_OFFSET_MS = 330 * 60 * 1000;

function nextColomboMidnightAfter(value: Date) {
  const local = new Date(value.getTime() + COLOMBO_OFFSET_MS);
  const nextLocalMidnightAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return new Date(nextLocalMidnightAsUtc - COLOMBO_OFFSET_MS);
}

function sixAmAfter(midnight: Date) {
  return new Date(midnight.getTime() + 6 * 60 * 60 * 1000);
}

function dayAfter(midnight: Date) {
  return new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
}

function sameInstant(a: Date | null | undefined, b: Date) {
  return Boolean(a && Math.abs(a.getTime() - b.getTime()) < 1000);
}

export function revisionUnlockMessage(unlockAt: Date | null) {
  if (!unlockAt) return "Complete the current revision videos to continue.";
  const local = new Date(unlockAt.getTime() + COLOMBO_OFFSET_MS);
  const hour = local.getUTCHours();
  if (hour === 6) {
    return "Daily Revision Limit Reached. Your next revision video will unlock at 6:00 AM.";
  }
  return "Daily Revision Limit Reached. Your next three revision videos will unlock tomorrow at 12:00 AM.";
}

export async function getPrimaryStudentEnrollment(db: Db, userId: string) {
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      courseId: enrollments.courseId,
      status: enrollments.status
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        inArray(enrollments.status, ["ACTIVE", "COMPLETED"])
      )
    )
    .orderBy(asc(enrollments.enrolledAt))
    .limit(1);
  return enrollment ?? null;
}

export async function evaluateMainCourseRevisionEligibility(
  db: Db,
  userId: string,
  enrollment: { id: string; courseId: string } | null
) {
  if (!enrollment) {
    return {
      eligible: false,
      totalLessons: 0,
      completedLessons: 0,
      qaRequiredLessons: 0,
      qaPassedLessons: 0,
      missingVideoCompletions: 0,
      missingQaPasses: 0
    };
  }

  const sections = await db
    .select({ id: courseSections.id, position: courseSections.position })
    .from(courseSections)
    .where(eq(courseSections.courseId, enrollment.courseId))
    .orderBy(asc(courseSections.position));
  const sectionIds = sections.map((item) => item.id);
  const courseLessons = sectionIds.length
    ? await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(inArray(lessons.sectionId, sectionIds))
    : [];
  const lessonIds = courseLessons.map((item) => item.id);

  const progress = lessonIds.length
    ? await db
        .select({ lessonId: lessonProgress.lessonId, progressPercent: lessonProgress.progressPercent })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollment.id),
            inArray(lessonProgress.lessonId, lessonIds)
          )
        )
    : [];
  const completedIds = new Set(
    progress.filter((item) => item.progressPercent >= 100).map((item) => item.lessonId)
  );

  const questions = lessonIds.length
    ? await db
        .select({ lessonId: lessonQuizQuestions.lessonId })
        .from(lessonQuizQuestions)
        .where(
          and(
            inArray(lessonQuizQuestions.lessonId, lessonIds),
            eq(lessonQuizQuestions.isPublished, true)
          )
        )
    : [];
  const qaRequiredIds = new Set(questions.map((item) => item.lessonId));

  const attempts = lessonIds.length
    ? await db
        .select({
          lessonId: lessonQuizAttempts.lessonId,
          scorePercent: lessonQuizAttempts.scorePercent,
          completedAt: lessonQuizAttempts.completedAt
        })
        .from(lessonQuizAttempts)
        .where(
          and(
            eq(lessonQuizAttempts.userId, userId),
            inArray(lessonQuizAttempts.lessonId, lessonIds)
          )
        )
    : [];
  const passedIds = new Set(
    attempts
      .filter(
        (item) => Boolean(item.completedAt) && (item.scorePercent ?? 0) >= REVISION_PASS_PERCENT
      )
      .map((item) => item.lessonId)
  );

  const totalLessons = lessonIds.length;
  const completedLessons = lessonIds.filter((id) => completedIds.has(id)).length;
  const qaRequiredLessons = lessonIds.filter((id) => qaRequiredIds.has(id)).length;
  const qaPassedLessons = lessonIds.filter(
    (id) => qaRequiredIds.has(id) && passedIds.has(id)
  ).length;
  const everyLessonHasQa = totalLessons > 0 && qaRequiredLessons === totalLessons;
  const allVideosComplete = totalLessons > 0 && completedLessons === totalLessons;
  const allQaPassed = everyLessonHasQa && qaPassedLessons === totalLessons;

  return {
    eligible: allVideosComplete && allQaPassed,
    totalLessons,
    completedLessons,
    qaRequiredLessons,
    qaPassedLessons,
    missingVideoCompletions: Math.max(0, totalLessons - completedLessons),
    missingQaPasses: Math.max(0, totalLessons - qaPassedLessons)
  };
}

export async function ensureRevisionEligibilityState(db: Db, userId: string) {
  const enrollment = await getPrimaryStudentEnrollment(db, userId);
  const eligibility = await evaluateMainCourseRevisionEligibility(db, userId, enrollment);
  if (!enrollment) {
    return { enrollment: null, eligibility, access: null, newlyUnlocked: false };
  }

  let [access] = await db
    .select()
    .from(revisionStudentAccess)
    .where(
      and(
        eq(revisionStudentAccess.userId, userId),
        eq(revisionStudentAccess.courseId, enrollment.courseId)
      )
    )
    .limit(1);

  let newlyUnlocked = false;
  if (!access && eligibility.eligible) {
    const now = new Date();
    const inserted = await db
      .insert(revisionStudentAccess)
      .values({
        userId,
        courseId: enrollment.courseId,
        revisionUnlockedAt: now,
        updatedAt: now
      })
      .onConflictDoNothing()
      .returning();
    newlyUnlocked = inserted.length > 0;
    [access] = inserted.length
      ? inserted
      : await db
          .select()
          .from(revisionStudentAccess)
          .where(
            and(
              eq(revisionStudentAccess.userId, userId),
              eq(revisionStudentAccess.courseId, enrollment.courseId)
            )
          )
          .limit(1);
  }

  return {
    enrollment,
    eligibility,
    access: access ?? null,
    newlyUnlocked
  };
}

async function getSeries(db: Db, courseId: string, level: RevisionLevel) {
  const [series] = await db
    .select()
    .from(revisionSeries)
    .where(and(eq(revisionSeries.courseId, courseId), eq(revisionSeries.level, level)))
    .limit(1);
  return series ?? null;
}

export async function maybeUnlockAdvancedRevision(db: Db, userId: string, courseId: string) {
  const [access] = await db
    .select()
    .from(revisionStudentAccess)
    .where(
      and(
        eq(revisionStudentAccess.userId, userId),
        eq(revisionStudentAccess.courseId, courseId)
      )
    )
    .limit(1);
  if (!access?.revisionUnlockedAt) return { access: access ?? null, newlyUnlocked: false };
  if (access.advancedUnlockedAt) return { access, newlyUnlocked: false };

  const basic = await getSeries(db, courseId, "BASIC");
  if (!basic?.isComplete) return { access, newlyUnlocked: false };

  const videos = await db
    .select({ id: revisionVideos.id })
    .from(revisionVideos)
    .where(and(eq(revisionVideos.seriesId, basic.id), eq(revisionVideos.isPublished, true)))
    .orderBy(asc(revisionVideos.position));
  if (!videos.length) return { access, newlyUnlocked: false };

  const videoIds = videos.map((item) => item.id);
  const progress = await db
    .select({ videoId: revisionVideoProgress.videoId, progressPercent: revisionVideoProgress.progressPercent })
    .from(revisionVideoProgress)
    .where(
      and(
        eq(revisionVideoProgress.userId, userId),
        inArray(revisionVideoProgress.videoId, videoIds)
      )
    );
  const progressById = new Map(progress.map((item) => [item.videoId, item.progressPercent]));
  if (!videos.every((video) => (progressById.get(video.id) ?? 0) >= 100)) {
    return { access, newlyUnlocked: false };
  }

  const now = new Date();
  const [updated] = await db
    .update(revisionStudentAccess)
    .set({ advancedUnlockedAt: now, updatedAt: now })
    .where(eq(revisionStudentAccess.id, access.id))
    .returning();
  return { access: updated ?? access, newlyUnlocked: Boolean(updated?.advancedUnlockedAt) };
}

async function ensureLevelState(
  db: Db,
  userId: string,
  courseId: string,
  level: RevisionLevel,
  unlockedAt: Date
) {
  await db
    .insert(revisionStudentLevelState)
    .values({
      userId,
      courseId,
      level,
      batchStartPosition: 1,
      batchUnlockedAt: unlockedAt,
      updatedAt: new Date()
    })
    .onConflictDoNothing();

  const [state] = await db
    .select()
    .from(revisionStudentLevelState)
    .where(
      and(
        eq(revisionStudentLevelState.userId, userId),
        eq(revisionStudentLevelState.courseId, courseId),
        eq(revisionStudentLevelState.level, level)
      )
    )
    .limit(1);
  return state ?? null;
}

function provisionalNextUnlockAt(
  state: NonNullable<Awaited<ReturnType<typeof ensureLevelState>>>,
  thirdProgress: { reachedEightyAt: Date | null } | undefined,
  now: Date
) {
  if (state.nextBatchUnlockAt) return state.nextBatchUnlockAt;
  const midnight = nextColomboMidnightAfter(state.batchUnlockedAt);

  if (state.rolloverMidnight && sameInstant(state.rolloverMidnight, midnight) && state.midnightActiveSlot) {
    if (state.midnightActiveSlot === 3) return midnight;
    if (state.midnightActiveSlot === 2) return sixAmAfter(midnight);
    return dayAfter(midnight);
  }

  if (thirdProgress?.reachedEightyAt && thirdProgress.reachedEightyAt.getTime() <= midnight.getTime()) {
    return midnight;
  }

  if (now.getTime() < midnight.getTime()) return midnight;
  return dayAfter(midnight);
}

async function loadPublishedVideos(db: Db, seriesId: string) {
  return db
    .select()
    .from(revisionVideos)
    .where(and(eq(revisionVideos.seriesId, seriesId), eq(revisionVideos.isPublished, true)))
    .orderBy(asc(revisionVideos.position));
}

async function loadProgressMap(db: Db, userId: string, videoIds: string[]) {
  if (!videoIds.length) return new Map<string, typeof revisionVideoProgress.$inferSelect>();
  const items = await db
    .select()
    .from(revisionVideoProgress)
    .where(
      and(
        eq(revisionVideoProgress.userId, userId),
        inArray(revisionVideoProgress.videoId, videoIds)
      )
    );
  return new Map(items.map((item) => [item.videoId, item]));
}

async function normalizeBatchState(
  db: Db,
  state: NonNullable<Awaited<ReturnType<typeof ensureLevelState>>>,
  videos: Awaited<ReturnType<typeof loadPublishedVideos>>,
  progressById: Map<string, typeof revisionVideoProgress.$inferSelect>,
  now: Date
) {
  const startIndex = Math.max(0, state.batchStartPosition - 1);
  const nextBatchFirstIndex = startIndex + REVISION_DAILY_VIDEO_LIMIT;
  if (nextBatchFirstIndex >= videos.length) return state;

  const third = videos[startIndex + REVISION_DAILY_VIDEO_LIMIT - 1];
  if (!third) return state;
  const thirdProgress = progressById.get(third.id);
  const unlockAt = provisionalNextUnlockAt(state, thirdProgress, now);

  if ((thirdProgress?.progressPercent ?? 0) < REVISION_SEQUENTIAL_PERCENT) return state;
  if (now.getTime() < unlockAt.getTime()) return state;

  const [updated] = await db
    .update(revisionStudentLevelState)
    .set({
      batchStartPosition: state.batchStartPosition + REVISION_DAILY_VIDEO_LIMIT,
      batchUnlockedAt: unlockAt,
      rolloverMidnight: null,
      midnightActiveSlot: null,
      nextBatchUnlockAt: null,
      updatedAt: now
    })
    .where(eq(revisionStudentLevelState.id, state.id))
    .returning();
  return updated ?? state;
}

export async function captureRevisionMidnightRollover(
  db: Db,
  userId: string,
  courseId: string,
  level: RevisionLevel,
  revisionVideoId: string,
  previousHeartbeatAt: Date | null | undefined,
  now: Date
) {
  if (!previousHeartbeatAt) return;

  const [access] = await db
    .select()
    .from(revisionStudentAccess)
    .where(
      and(
        eq(revisionStudentAccess.userId, userId),
        eq(revisionStudentAccess.courseId, courseId)
      )
    )
    .limit(1);
  const levelUnlockedAt = level === "BASIC" ? access?.revisionUnlockedAt : access?.advancedUnlockedAt;
  if (!levelUnlockedAt) return;

  const state = await ensureLevelState(db, userId, courseId, level, levelUnlockedAt);
  const series = await getSeries(db, courseId, level);
  if (!state || !series) return;
  const videos = await loadPublishedVideos(db, series.id);
  const videoIndex = videos.findIndex((item) => item.id === revisionVideoId);
  const startIndex = Math.max(0, state.batchStartPosition - 1);
  const slot = videoIndex - startIndex + 1;
  if (slot < 1 || slot > REVISION_DAILY_VIDEO_LIMIT) return;

  const midnight = nextColomboMidnightAfter(state.batchUnlockedAt);
  if (
    previousHeartbeatAt.getTime() < midnight.getTime() &&
    now.getTime() >= midnight.getTime()
  ) {
    const nextUnlockAt = slot === 3
      ? midnight
      : slot === 2
        ? sixAmAfter(midnight)
        : dayAfter(midnight);
    await db
      .update(revisionStudentLevelState)
      .set({
        rolloverMidnight: midnight,
        midnightActiveSlot: slot,
        nextBatchUnlockAt: nextUnlockAt,
        updatedAt: now
      })
      .where(eq(revisionStudentLevelState.id, state.id));
  }
}

export async function buildRevisionLevelView(
  db: Db,
  userId: string,
  courseId: string,
  level: RevisionLevel,
  unlockedAt: Date | null,
  now = new Date()
) {
  const series = await getSeries(db, courseId, level);
  const videos = series ? await loadPublishedVideos(db, series.id) : [];
  const progressById = await loadProgressMap(db, userId, videos.map((item) => item.id));

  if (!unlockedAt) {
    return {
      level,
      unlocked: false,
      seriesComplete: series?.isComplete ?? false,
      completedVideos: videos.filter((video) => (progressById.get(video.id)?.progressPercent ?? 0) >= 100).length,
      totalVideos: videos.length,
      nextUnlockAt: null as Date | null,
      limitMessage: level === "ADVANCED"
        ? "Complete every Basic Revision video before Advanced Revision unlocks."
        : "Complete every My Course lesson and pass every Q&A assessment to unlock Revision.",
      videos: videos.map((video) => ({
        id: video.id,
        title: video.title,
        position: video.position,
        durationSeconds: video.durationSeconds,
        progressPercent: progressById.get(video.id)?.progressPercent ?? 0,
        watchedSeconds: progressById.get(video.id)?.watchedSeconds ?? 0,
        resumeSeconds: progressById.get(video.id)?.resumeSeconds ?? 0,
        locked: true,
        lockReason: level === "ADVANCED" ? "ADVANCED_LOCKED" : "REVISION_LOCKED",
        lockMessage: level === "ADVANCED"
          ? "Complete every Basic Revision video before Advanced Revision unlocks."
          : "Complete every My Course lesson and pass every Q&A assessment to unlock Revision."
      }))
    };
  }

  let state = await ensureLevelState(db, userId, courseId, level, unlockedAt);
  if (!state) throw new Error("Revision level state could not be initialized.");
  state = await normalizeBatchState(db, state, videos, progressById, now);

  const startIndex = Math.max(0, state.batchStartPosition - 1);
  const third = videos[startIndex + REVISION_DAILY_VIDEO_LIMIT - 1];
  const thirdProgress = third ? progressById.get(third.id) : undefined;
  const nextBatchFirstIndex = startIndex + REVISION_DAILY_VIDEO_LIMIT;
  const hasNextBatchVideo = nextBatchFirstIndex < videos.length;
  const nextUnlockAt = hasNextBatchVideo
    ? provisionalNextUnlockAt(state, thirdProgress, now)
    : null;
  const limitMessage = nextUnlockAt ? revisionUnlockMessage(nextUnlockAt) : null;

  const views = videos.map((video, index) => {
    const progress = progressById.get(video.id);
    let locked = false;
    let lockReason: string | null = null;
    let lockMessage: string | null = null;

    if (index < startIndex) {
      locked = false;
    } else if (index === startIndex) {
      locked = false;
    } else if (index <= startIndex + REVISION_DAILY_VIDEO_LIMIT - 1) {
      const previous = videos[index - 1];
      const previousProgress = previous ? progressById.get(previous.id) : undefined;
      locked = (previousProgress?.progressPercent ?? 0) < REVISION_SEQUENTIAL_PERCENT;
      if (locked) {
        lockReason = "PREVIOUS_80";
        lockMessage = `Watch at least 80% of the previous revision video to unlock this video.`;
      }
    } else {
      locked = true;
      const currentThird = videos[startIndex + REVISION_DAILY_VIDEO_LIMIT - 1];
      const currentThirdProgress = currentThird ? progressById.get(currentThird.id) : undefined;
      if ((currentThirdProgress?.progressPercent ?? 0) < REVISION_SEQUENTIAL_PERCENT) {
        lockReason = "PREVIOUS_80";
        lockMessage = "Complete at least 80% of the third video in your current revision set first.";
      } else {
        lockReason = "DAILY_LIMIT";
        lockMessage = limitMessage ?? "Your next revision set is not available yet.";
      }
    }

    return {
      id: video.id,
      title: video.title,
      position: video.position,
      durationSeconds: video.durationSeconds,
      progressPercent: progress?.progressPercent ?? 0,
      watchedSeconds: progress?.watchedSeconds ?? 0,
      resumeSeconds: progress?.resumeSeconds ?? 0,
      locked,
      lockReason,
      lockMessage
    };
  });

  return {
    level,
    unlocked: true,
    seriesComplete: series?.isComplete ?? false,
    completedVideos: views.filter((video) => video.progressPercent >= 100).length,
    totalVideos: views.length,
    currentBatchStartPosition: state.batchStartPosition,
    currentBatchEndPosition: Math.min(
      views.length,
      state.batchStartPosition + REVISION_DAILY_VIDEO_LIMIT - 1
    ),
    nextUnlockAt,
    limitMessage,
    videos: views
  };
}

export async function getRevisionStudentOverview(db: Db, userId: string) {
  const unlock = await ensureRevisionEligibilityState(db, userId);
  if (!unlock.enrollment) {
    return {
      courseId: null,
      revisionUnlocked: false,
      welcomePending: false,
      advancedUnlocked: false,
      advancedCongratulationsPending: false,
      eligibility: unlock.eligibility,
      basic: await Promise.resolve(null),
      advanced: await Promise.resolve(null)
    };
  }

  const advancedCheck = await maybeUnlockAdvancedRevision(db, userId, unlock.enrollment.courseId);
  const access = advancedCheck.access ?? unlock.access;
  const revisionUnlockedAt = access?.revisionUnlockedAt ?? null;
  const advancedUnlockedAt = access?.advancedUnlockedAt ?? null;

  const [basic, advanced] = await Promise.all([
    buildRevisionLevelView(db, userId, unlock.enrollment.courseId, "BASIC", revisionUnlockedAt),
    buildRevisionLevelView(db, userId, unlock.enrollment.courseId, "ADVANCED", advancedUnlockedAt)
  ]);

  return {
    courseId: unlock.enrollment.courseId,
    revisionUnlocked: Boolean(revisionUnlockedAt),
    welcomePending: Boolean(revisionUnlockedAt && !access?.welcomeSeenAt),
    advancedUnlocked: Boolean(advancedUnlockedAt),
    advancedCongratulationsPending: Boolean(
      advancedUnlockedAt && !access?.advancedCongratulationsSeenAt
    ),
    newlyRevisionUnlocked: unlock.newlyUnlocked,
    newlyAdvancedUnlocked: advancedCheck.newlyUnlocked,
    eligibility: unlock.eligibility,
    basic,
    advanced
  };
}

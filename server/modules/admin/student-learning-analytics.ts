import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Router } from "express";
import { requireDatabase } from "../../../db/client";
import {
  courseSections,
  courses,
  enrollments,
  lessonProgress,
  lessonQuizAttempts,
  lessonQuizQuestions,
  lessons,
  networkAccounts,
  revisionSeries,
  revisionStudentAccess,
  revisionVideoProgress,
  revisionVideos,
  users
} from "../../../db/schema";
import { requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const adminStudentLearningAnalyticsRouter = Router();

const QA_PASS_PERCENT = 75;

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function percent(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function latestDate(values: Array<Date | null | undefined>) {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

function activityStatus(
  learningProgress: number,
  knowledgeCheck: number | null,
  lastActiveAt: Date | null
) {
  const inactiveForMs = lastActiveAt ? Date.now() - lastActiveAt.getTime() : Number.POSITIVE_INFINITY;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (inactiveForMs > sevenDays) {
    return {
      label: "Inactive",
      tone: "danger",
      reason: lastActiveAt
        ? "No recorded learning activity during the last 7 days."
        : "No learning activity has been recorded yet."
    };
  }

  if (knowledgeCheck !== null && knowledgeCheck < QA_PASS_PERCENT) {
    return {
      label: "Needs Attention",
      tone: "warning",
      reason: `Knowledge Check is below the ${QA_PASS_PERCENT}% course pass level.`
    };
  }

  if (learningProgress >= 80 && (knowledgeCheck === null || knowledgeCheck >= QA_PASS_PERCENT)) {
    return {
      label: "Excellent Progress",
      tone: "success",
      reason: "Strong learning completion with satisfactory Q&A performance."
    };
  }

  return {
    label: "On Track",
    tone: "info",
    reason: "Learning activity is progressing without a current warning."
  };
}

adminStudentLearningAnalyticsRouter.get(
  "/admin/student-learning-analytics/search",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const q = normalize(request.query.q);

    const rows = await db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        accountPrefix: networkAccounts.prefix,
        accountNumericPart: networkAccounts.numericPart,
        accountStatus: networkAccounts.status
      })
      .from(users)
      .leftJoin(
        networkAccounts,
        and(
          eq(networkAccounts.ownerUserId, users.id),
          eq(networkAccounts.isMainAccount, true)
        )
      )
      .where(
        and(
          inArray(users.role, ["student", "consultant"]),
          isNull(users.removedAt)
        )
      );

    const results = rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        isActive: row.isActive,
        accountNumber:
          row.accountPrefix && row.accountNumericPart !== null
            ? `${row.accountPrefix}${row.accountNumericPart}`
            : null,
        accountStatus: row.accountStatus
      }))
      .filter((row) => {
        if (!q) return true;
        return [
          row.accountNumber,
          row.name,
          row.email,
          row.phone
        ].some((value) => normalize(value).includes(q));
      })
      .sort((a, b) => {
        const aExact = normalize(a.accountNumber) === q ? 0 : 1;
        const bExact = normalize(b.accountNumber) === q ? 0 : 1;
        return aExact - bExact || a.name.localeCompare(b.name);
      })
      .slice(0, 25);

    response.json({ students: results });
  })
);

adminStudentLearningAnalyticsRouter.get(
  "/admin/student-learning-analytics/:userId",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const userId = String(request.params.userId);

    const [student] = await db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        accountPrefix: networkAccounts.prefix,
        accountNumericPart: networkAccounts.numericPart,
        accountStatus: networkAccounts.status
      })
      .from(users)
      .leftJoin(
        networkAccounts,
        and(
          eq(networkAccounts.ownerUserId, users.id),
          eq(networkAccounts.isMainAccount, true)
        )
      )
      .where(
        and(
          eq(users.id, userId),
          inArray(users.role, ["student", "consultant"]),
          isNull(users.removedAt)
        )
      )
      .limit(1);

    if (!student) {
      response.status(404).json({ message: "Student account was not found." });
      return;
    }

    const studentEnrollments = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        courseTitle: courses.title,
        coursePublished: courses.isPublished
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.userId, userId))
      .orderBy(asc(enrollments.enrolledAt));

    const courseAnalytics = [];

    for (const enrollment of studentEnrollments) {
      const sections = await db
        .select({
          id: courseSections.id,
          position: courseSections.position
        })
        .from(courseSections)
        .where(eq(courseSections.courseId, enrollment.courseId))
        .orderBy(asc(courseSections.position));

      const sectionIds = sections.map((item) => item.id);

      const courseLessons = sectionIds.length
        ? await db
            .select({
              id: lessons.id,
              title: lessons.title,
              videoId: lessons.videoId,
              position: lessons.position,
              sectionId: lessons.sectionId
            })
            .from(lessons)
            .where(inArray(lessons.sectionId, sectionIds))
        : [];

      // Normal course lessons currently count as videos only when a video is attached.
      // This keeps totals live when Admin adds/removes lesson videos.
      const theoryVideos = courseLessons.filter(
        (lesson) => Boolean(lesson.videoId && lesson.videoId.trim())
      );
      const theoryIds = theoryVideos.map((item) => item.id);

      const theoryProgress = theoryIds.length
        ? await db
            .select({
              lessonId: lessonProgress.lessonId,
              progressPercent: lessonProgress.progressPercent,
              watchedSeconds: lessonProgress.watchedSeconds,
              lastHeartbeatAt: lessonProgress.lastHeartbeatAt,
              completedAt: lessonProgress.completedAt,
              updatedAt: lessonProgress.updatedAt
            })
            .from(lessonProgress)
            .where(
              and(
                eq(lessonProgress.enrollmentId, enrollment.id),
                inArray(lessonProgress.lessonId, theoryIds)
              )
            )
        : [];

      const theoryProgressMap = new Map(
        theoryProgress.map((item) => [item.lessonId, item])
      );

      const theoryWatched = theoryVideos.filter(
        (video) =>
          (theoryProgressMap.get(video.id)?.progressPercent ?? 0) > 0 ||
          (theoryProgressMap.get(video.id)?.watchedSeconds ?? 0) > 0
      ).length;

      const theoryCompleted = theoryVideos.filter(
        (video) => (theoryProgressMap.get(video.id)?.progressPercent ?? 0) >= 100
      ).length;

      const publishedQuestions = theoryIds.length
        ? await db
            .select({
              lessonId: lessonQuizQuestions.lessonId
            })
            .from(lessonQuizQuestions)
            .where(
              and(
                inArray(lessonQuizQuestions.lessonId, theoryIds),
                eq(lessonQuizQuestions.isPublished, true)
              )
            )
        : [];

      const qaLessonIds = [...new Set(publishedQuestions.map((item) => item.lessonId))];

      const qaAttempts = qaLessonIds.length
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
                inArray(lessonQuizAttempts.lessonId, qaLessonIds)
              )
            )
        : [];

      const bestScoreByLesson = new Map<string, number>();
      for (const attempt of qaAttempts) {
        if (!attempt.completedAt || attempt.scorePercent === null) continue;
        const previous = bestScoreByLesson.get(attempt.lessonId) ?? -1;
        if (attempt.scorePercent > previous) {
          bestScoreByLesson.set(attempt.lessonId, attempt.scorePercent);
        }
      }

      const qaScores = qaLessonIds
        .map((id) => bestScoreByLesson.get(id))
        .filter((score): score is number => typeof score === "number");

      const knowledgeCheck = qaScores.length
        ? Math.round(qaScores.reduce((sum, score) => sum + score, 0) / qaScores.length)
        : null;

      const qaPassed = qaLessonIds.filter(
        (id) => (bestScoreByLesson.get(id) ?? 0) >= QA_PASS_PERCENT
      ).length;

      const series = await db
        .select({
          id: revisionSeries.id,
          level: revisionSeries.level,
          isComplete: revisionSeries.isComplete
        })
        .from(revisionSeries)
        .where(eq(revisionSeries.courseId, enrollment.courseId));

      const basicSeries = series.find((item) => item.level === "BASIC") ?? null;
      const advancedSeries = series.find((item) => item.level === "ADVANCED") ?? null;

      const [basicVideos, advancedVideos, access] = await Promise.all([
        basicSeries
          ? db
              .select({
                id: revisionVideos.id,
                title: revisionVideos.title,
                position: revisionVideos.position
              })
              .from(revisionVideos)
              .where(
                and(
                  eq(revisionVideos.seriesId, basicSeries.id),
                  eq(revisionVideos.isPublished, true)
                )
              )
              .orderBy(asc(revisionVideos.position))
          : Promise.resolve([]),
        advancedSeries
          ? db
              .select({
                id: revisionVideos.id,
                title: revisionVideos.title,
                position: revisionVideos.position
              })
              .from(revisionVideos)
              .where(
                and(
                  eq(revisionVideos.seriesId, advancedSeries.id),
                  eq(revisionVideos.isPublished, true)
                )
              )
              .orderBy(asc(revisionVideos.position))
          : Promise.resolve([]),
        db
          .select({
            revisionUnlockedAt: revisionStudentAccess.revisionUnlockedAt,
            advancedUnlockedAt: revisionStudentAccess.advancedUnlockedAt
          })
          .from(revisionStudentAccess)
          .where(
            and(
              eq(revisionStudentAccess.userId, userId),
              eq(revisionStudentAccess.courseId, enrollment.courseId)
            )
          )
          .limit(1)
          .then((items) => items[0] ?? null)
      ]);

      const revisionIds = [
        ...basicVideos.map((item) => item.id),
        ...advancedVideos.map((item) => item.id)
      ];

      const revisionProgress = revisionIds.length
        ? await db
            .select({
              videoId: revisionVideoProgress.videoId,
              progressPercent: revisionVideoProgress.progressPercent,
              watchedSeconds: revisionVideoProgress.watchedSeconds,
              lastHeartbeatAt: revisionVideoProgress.lastHeartbeatAt,
              completedAt: revisionVideoProgress.completedAt,
              updatedAt: revisionVideoProgress.updatedAt
            })
            .from(revisionVideoProgress)
            .where(
              and(
                eq(revisionVideoProgress.userId, userId),
                inArray(revisionVideoProgress.videoId, revisionIds)
              )
            )
        : [];

      const revisionProgressMap = new Map(
        revisionProgress.map((item) => [item.videoId, item])
      );

      function revisionStats(videos: Array<{ id: string; title: string; position: number }>) {
        const watched = videos.filter(
          (video) =>
            (revisionProgressMap.get(video.id)?.progressPercent ?? 0) > 0 ||
            (revisionProgressMap.get(video.id)?.watchedSeconds ?? 0) > 0
        ).length;
        const completed = videos.filter(
          (video) => (revisionProgressMap.get(video.id)?.progressPercent ?? 0) >= 100
        ).length;
        return {
          total: videos.length,
          watched,
          completed,
          percent: percent(completed, videos.length)
        };
      }

      const basic = revisionStats(basicVideos);
      const advanced = revisionStats(advancedVideos);

      const totalPublishedVideos =
        theoryVideos.length + basicVideos.length + advancedVideos.length;
      const totalWatchedVideos = theoryWatched + basic.watched + advanced.watched;
      const totalCompletedVideos = theoryCompleted + basic.completed + advanced.completed;
      const learningProgress = percent(totalCompletedVideos, totalPublishedVideos);

      const lastActiveAt = latestDate([
        ...theoryProgress.flatMap((item) => [
          item.lastHeartbeatAt,
          item.updatedAt,
          item.completedAt
        ]),
        ...revisionProgress.flatMap((item) => [
          item.lastHeartbeatAt,
          item.updatedAt,
          item.completedAt
        ])
      ]);

      let currentStage = "Basic Theory";
      if (access?.advancedUnlockedAt) {
        currentStage = "Advanced Revision";
      } else if (access?.revisionUnlockedAt) {
        currentStage = "Basic Revision";
      } else if (theoryVideos.length > 0 && theoryCompleted === theoryVideos.length) {
        currentStage = "Waiting for Revision Unlock";
      }

      type RecentVideoActivity = {
        type: string;
        title: string;
        at: Date;
      };

      const theoryLast: RecentVideoActivity[] = theoryVideos.flatMap((video) => {
        const progress = theoryProgressMap.get(video.id);
        if (!progress) return [];
        const at = latestDate([
          progress.lastHeartbeatAt,
          progress.updatedAt,
          progress.completedAt
        ]);
        return at ? [{ type: "Basic Theory", title: video.title, at }] : [];
      });

      const revisionTitles = new Map<string, { type: string; title: string }>();
      for (const video of basicVideos) {
        revisionTitles.set(video.id, {
          type: "Basic Revision",
          title: video.title
        });
      }
      for (const video of advancedVideos) {
        revisionTitles.set(video.id, {
          type: "Advanced Revision",
          title: video.title
        });
      }

      const revisionLast: RecentVideoActivity[] = revisionProgress.flatMap(
        (progress) => {
          const meta = revisionTitles.get(progress.videoId);
          if (!meta) return [];
          const at = latestDate([
            progress.lastHeartbeatAt,
            progress.updatedAt,
            progress.completedAt
          ]);
          return at ? [{ ...meta, at }] : [];
        }
      );

      const lastVideo =
        [...theoryLast, ...revisionLast].sort(
          (a, b) => b.at.getTime() - a.at.getTime()
        )[0] ?? null;

      const status = activityStatus(
        learningProgress,
        knowledgeCheck,
        lastActiveAt
      );

      courseAnalytics.push({
        enrollmentId: enrollment.id,
        courseId: enrollment.courseId,
        courseTitle: enrollment.courseTitle,
        coursePublished: enrollment.coursePublished,
        enrollmentStatus: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        currentStage,
        totals: {
          publishedVideos: totalPublishedVideos,
          watchedVideos: totalWatchedVideos,
          completedVideos: totalCompletedVideos,
          learningProgress
        },
        theory: {
          total: theoryVideos.length,
          watched: theoryWatched,
          completed: theoryCompleted,
          percent: percent(theoryCompleted, theoryVideos.length)
        },
        basicRevision: {
          ...basic,
          unlocked: Boolean(access?.revisionUnlockedAt),
          seriesComplete: Boolean(basicSeries?.isComplete)
        },
        advancedRevision: {
          ...advanced,
          unlocked: Boolean(access?.advancedUnlockedAt),
          seriesComplete: Boolean(advancedSeries?.isComplete)
        },
        knowledge: {
          checkPercent: knowledgeCheck,
          qaRequired: qaLessonIds.length,
          qaAttempted: qaScores.length,
          qaPassed,
          passPercent: QA_PASS_PERCENT
        },
        lastActiveAt,
        lastVideo: lastVideo
          ? {
              type: lastVideo.type,
              title: lastVideo.title,
              at: lastVideo.at
            }
          : null,
        status
      });
    }

    const allCourseTotals = courseAnalytics.reduce(
      (acc, item) => {
        acc.published += item.totals.publishedVideos;
        acc.watched += item.totals.watchedVideos;
        acc.completed += item.totals.completedVideos;
        return acc;
      },
      { published: 0, watched: 0, completed: 0 }
    );

    const allKnowledge = courseAnalytics
      .map((item) => item.knowledge.checkPercent)
      .filter((value): value is number => typeof value === "number");

    const globalKnowledge = allKnowledge.length
      ? Math.round(
          allKnowledge.reduce((sum, score) => sum + score, 0) /
            allKnowledge.length
        )
      : null;

    const globalLastActive = latestDate(
      courseAnalytics.map((item) => item.lastActiveAt)
    );

    response.json({
      refreshedAt: new Date(),
      refreshSeconds: 15,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        role: student.role,
        isActive: student.isActive,
        joinedAt: student.createdAt,
        accountNumber:
          student.accountPrefix && student.accountNumericPart !== null
            ? `${student.accountPrefix}${student.accountNumericPart}`
            : null,
        accountStatus: student.accountStatus
      },
      summary: {
        totalCourses: courseAnalytics.length,
        publishedVideos: allCourseTotals.published,
        watchedVideos: allCourseTotals.watched,
        completedVideos: allCourseTotals.completed,
        learningProgress: percent(
          allCourseTotals.completed,
          allCourseTotals.published
        ),
        knowledgeCheck: globalKnowledge,
        lastActiveAt: globalLastActive
      },
      courses: courseAnalytics
    });
  })
);

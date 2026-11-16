import { and, desc, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { requireDatabase } from "../../../db/client";
import {
  balancePaymentRequests,
  courseSections,
  courses,
  enrollments,
  lessonProgress,
  lessonQuizAttempts,
  lessonQuizQuestions,
  lessons,
  networkAccounts,
  paymentRequests,
  users,
  videoAccessOverrides
} from "../../../db/schema";
import { HttpError, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const halfPaymentAdminRouter = Router();

function publicPayment<T extends { proofObjectKey?: unknown; proofMimeType?: unknown }>(item: T) {
  const { proofObjectKey: _proofObjectKey, proofMimeType: _proofMimeType, ...safe } = item;
  return safe;
}

halfPaymentAdminRouter.get(
  "/admin/half-payment-students",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();

    const rows = await db
      .select({
        payment: paymentRequests,
        student: {
          id: users.id,
          name: users.displayName,
          email: users.email,
          phone: users.phone,
          nicOrPassport: users.nicOrPassport,
          address: users.address,
          dateOfBirth: users.dateOfBirth,
          isActive: users.isActive,
          emailVerifiedAt: users.emailVerifiedAt,
          passwordSetAt: users.passwordSetAt,
          createdAt: users.createdAt
        },
        course: {
          id: courses.id,
          title: courses.title,
          price: courses.price,
          halfPaymentLessonLimit: courses.halfPaymentLessonLimit
        }
      })
      .from(paymentRequests)
      .innerJoin(users, eq(users.id, paymentRequests.userId))
      .innerJoin(courses, eq(courses.id, paymentRequests.courseId))
      .where(
        and(
          eq(paymentRequests.status, "PARTIAL"),
          eq(users.role, "student"),
          isNull(users.removedAt)
        )
      )
      .orderBy(desc(paymentRequests.createdAt));

    const seen = new Set<string>();
    const students = [];

    for (const row of rows) {
      const key = `${row.student.id}:${row.course.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const [[account], [enrollment], [latestBalance]] = await Promise.all([
        db
          .select({
            prefix: networkAccounts.prefix,
            numericPart: networkAccounts.numericPart,
            status: networkAccounts.status
          })
          .from(networkAccounts)
          .where(
            and(
              eq(networkAccounts.ownerUserId, row.student.id),
              eq(networkAccounts.isMainAccount, true)
            )
          )
          .limit(1),
        db
          .select({
            status: enrollments.status,
            enrolledAt: enrollments.enrolledAt
          })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.userId, row.student.id),
              eq(enrollments.courseId, row.course.id)
            )
          )
          .limit(1),
        db
          .select({
            id: balancePaymentRequests.id,
            amount: balancePaymentRequests.amount,
            transactionReference: balancePaymentRequests.transactionReference,
            status: balancePaymentRequests.status,
            createdAt: balancePaymentRequests.createdAt,
            reviewedAt: balancePaymentRequests.reviewedAt
          })
          .from(balancePaymentRequests)
          .where(eq(balancePaymentRequests.originalPaymentId, row.payment.id))
          .orderBy(desc(balancePaymentRequests.createdAt))
          .limit(1)
      ]);

      students.push({
        ...row.student,
        account: account
          ? {
              number: `${account.prefix}${account.numericPart}`,
              status: account.status
            }
          : null,
        enrollment: enrollment ?? null,
        course: row.course,
        payment: {
          id: row.payment.id,
          paymentCode: row.payment.paymentCode,
          method: row.payment.method,
          status: row.payment.status,
          paidAmount: row.payment.paidAmount,
          totalAmount: row.payment.totalAmount,
          outstandingAmount: Math.max(
            0,
            Number(row.payment.totalAmount) - Number(row.payment.paidAmount)
          ),
          transactionReference: row.payment.transactionReference,
          createdAt: row.payment.createdAt,
          reviewedAt: row.payment.reviewedAt
        },
        latestBalanceRequest: latestBalance ?? null
      });
    }

    response.json({ students });
  })
);

halfPaymentAdminRouter.get(
  "/admin/half-payment-students/:userId",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const userId = String(request.params.userId);

    const [current] = await db
      .select({
        payment: paymentRequests,
        student: {
          id: users.id,
          name: users.displayName,
          email: users.email,
          phone: users.phone,
          nicOrPassport: users.nicOrPassport,
          address: users.address,
          dateOfBirth: users.dateOfBirth,
          isActive: users.isActive,
          emailVerifiedAt: users.emailVerifiedAt,
          passwordSetAt: users.passwordSetAt,
          createdAt: users.createdAt
        },
        course: courses
      })
      .from(paymentRequests)
      .innerJoin(users, eq(users.id, paymentRequests.userId))
      .innerJoin(courses, eq(courses.id, paymentRequests.courseId))
      .where(
        and(
          eq(paymentRequests.userId, userId),
          eq(paymentRequests.status, "PARTIAL"),
          eq(users.role, "student"),
          isNull(users.removedAt)
        )
      )
      .orderBy(desc(paymentRequests.createdAt))
      .limit(1);

    if (!current) {
      throw new HttpError(
        404,
        "This student is no longer in the current Half Payment Students list."
      );
    }

    const [[account], [enrollment], [accessOverride], paymentHistory, balanceHistory, courseLessons] =
      await Promise.all([
        db
          .select({
            prefix: networkAccounts.prefix,
            numericPart: networkAccounts.numericPart,
            status: networkAccounts.status,
            isMainAccount: networkAccounts.isMainAccount,
            activatedAt: networkAccounts.activatedAt
          })
          .from(networkAccounts)
          .where(
            and(
              eq(networkAccounts.ownerUserId, userId),
              eq(networkAccounts.isMainAccount, true)
            )
          )
          .limit(1),
        db
          .select({
            id: enrollments.id,
            status: enrollments.status,
            enrolledAt: enrollments.enrolledAt,
            completedAt: enrollments.completedAt
          })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.userId, userId),
              eq(enrollments.courseId, current.course.id)
            )
          )
          .limit(1),
        db
          .select({
            unlockAllVideos: videoAccessOverrides.unlockAllVideos,
            createdAt: videoAccessOverrides.createdAt,
            updatedAt: videoAccessOverrides.updatedAt
          })
          .from(videoAccessOverrides)
          .where(
            and(
              eq(videoAccessOverrides.userId, userId),
              eq(videoAccessOverrides.courseId, current.course.id)
            )
          )
          .limit(1),
        db
          .select()
          .from(paymentRequests)
          .where(eq(paymentRequests.userId, userId))
          .orderBy(desc(paymentRequests.createdAt)),
        db
          .select()
          .from(balancePaymentRequests)
          .where(eq(balancePaymentRequests.userId, userId))
          .orderBy(desc(balancePaymentRequests.createdAt)),
        db
          .select({
            id: lessons.id,
            title: lessons.title,
            lessonPosition: lessons.position,
            sectionPosition: courseSections.position
          })
          .from(lessons)
          .innerJoin(courseSections, eq(courseSections.id, lessons.sectionId))
          .where(eq(courseSections.courseId, current.course.id))
      ]);

    let progressRows: Array<{
      lessonId: string;
      progressPercent: number;
      watchedSeconds: number;
      completedAt: Date | null;
      updatedAt: Date;
    }> = [];

    if (enrollment) {
      progressRows = await db
        .select({
          lessonId: lessonProgress.lessonId,
          progressPercent: lessonProgress.progressPercent,
          watchedSeconds: lessonProgress.watchedSeconds,
          completedAt: lessonProgress.completedAt,
          updatedAt: lessonProgress.updatedAt
        })
        .from(lessonProgress)
        .where(eq(lessonProgress.enrollmentId, enrollment.id));
    }

    const allQuizQuestions = await db
      .select({
        lessonId: lessonQuizQuestions.lessonId,
        isPublished: lessonQuizQuestions.isPublished
      })
      .from(lessonQuizQuestions);

    const lessonIdSet = new Set(courseLessons.map((item) => item.id));
    const quizLessonIds = new Set(
      allQuizQuestions
        .filter((item) => item.isPublished && lessonIdSet.has(item.lessonId))
        .map((item) => item.lessonId)
    );

    const allAttempts = await db
      .select({
        lessonId: lessonQuizAttempts.lessonId,
        scorePercent: lessonQuizAttempts.scorePercent,
        completedAt: lessonQuizAttempts.completedAt
      })
      .from(lessonQuizAttempts)
      .where(eq(lessonQuizAttempts.userId, userId));

    const passedQuizLessonIds = new Set(
      allAttempts
        .filter(
          (item) =>
            lessonIdSet.has(item.lessonId) &&
            item.completedAt &&
            Number(item.scorePercent ?? 0) >= 75
        )
        .map((item) => item.lessonId)
    );

    const progressMap = new Map(progressRows.map((item) => [item.lessonId, item]));
    const totalLessons = courseLessons.length;
    const completedLessons = courseLessons.filter(
      (item) => (progressMap.get(item.id)?.progressPercent ?? 0) >= 100
    ).length;
    const inProgressLessons = courseLessons.filter((item) => {
      const percent = progressMap.get(item.id)?.progressPercent ?? 0;
      return percent > 0 && percent < 100;
    }).length;
    const progressSum = courseLessons.reduce(
      (sum, item) => sum + (progressMap.get(item.id)?.progressPercent ?? 0),
      0
    );
    const averageProgress = totalLessons
      ? Math.round(progressSum / totalLessons)
      : 0;

    const accessibleLessons = Math.min(
      totalLessons,
      Math.max(0, current.course.halfPaymentLessonLimit)
    );

    response.json({
      student: current.student,
      account: account
        ? {
            number: `${account.prefix}${account.numericPart}`,
            status: account.status,
            isMainAccount: account.isMainAccount,
            activatedAt: account.activatedAt
          }
        : null,
      enrollment: enrollment ?? null,
      course: {
        id: current.course.id,
        title: current.course.title,
        price: current.course.price,
        currency: current.course.currency,
        halfPaymentLessonLimit: current.course.halfPaymentLessonLimit
      },
      currentPayment: {
        ...publicPayment(current.payment),
        outstandingAmount: Math.max(
          0,
          Number(current.payment.totalAmount) - Number(current.payment.paidAmount)
        )
      },
      access: {
        paymentAccess: "HALF",
        totalLessons,
        accessibleLessons,
        lockedByPayment: Math.max(0, totalLessons - accessibleLessons),
        unlockAllOverride: accessOverride?.unlockAllVideos ?? false
      },
      learning: {
        completedLessons,
        inProgressLessons,
        untouchedLessons: Math.max(0, totalLessons - completedLessons - inProgressLessons),
        averageProgress,
        totalQuizLessons: quizLessonIds.size,
        passedQuizLessons: [...passedQuizLessonIds].filter((id) =>
          quizLessonIds.has(id)
        ).length
      },
      paymentHistory: paymentHistory.map((item) => publicPayment(item)),
      balanceHistory: balanceHistory.map((item) => publicPayment(item))
    });
  })
);

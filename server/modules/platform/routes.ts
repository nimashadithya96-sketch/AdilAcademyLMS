import crypto from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  auditLogs,
  accountNumberSequence,
  certificates,
  commissionEntries,
  commissionCycles,
  consultantApplications,
  consultantBankDetails,
  consultantStudentRegistrations,
  coupons,
  courseSections,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  networkAccounts,
  networkPlacements,
  notifications,
  paymentReferenceIds,
  paymentRequests,
  payoutRequests,
  quizAttempts,
  quizzes,
  sessions,
  supportTickets,
  systemSettings,
  users,
  walletLedger,
  wallets
} from "../../../db/schema";
import {
  HttpError,
  requireAuthenticatedUser,
  requireRole
} from "../../lib/auth";
import { asyncRoute } from "../../lib/http";
import { ACCOUNT_BLOCK_SIZE, nextStudentAccountNumber } from "../../domain/business-rules";
import { decryptBankAccount } from "../../services/bank-details";
import { sendPayId } from "../../services/email";

export const platformRouter = Router();

platformRouter.post(
  "/admin/accounts/repair",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const assigned = await db.transaction(async (tx) => {
      await tx.insert(accountNumberSequence).values({ id: 1, nextNumber: 527694 }).onConflictDoNothing();
      const existing = await tx.select({ numericPart: networkAccounts.numericPart }).from(networkAccounts).orderBy(desc(networkAccounts.numericPart)).limit(1);
      const nextBlock = nextStudentAccountNumber(existing[0]?.numericPart);
      await tx.update(accountNumberSequence).set({
        nextNumber: sql`GREATEST(${accountNumberSequence.nextNumber}, ${nextBlock})`,
        updatedAt: new Date()
      }).where(eq(accountNumberSequence.id, 1));
      const studentRows = await tx.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.role, "student"));
      let countAssigned = 0;
      for (const student of studentRows) {
        const [main] = await tx.select({ id: networkAccounts.id }).from(networkAccounts)
          .where(and(eq(networkAccounts.ownerUserId, student.id), eq(networkAccounts.isMainAccount, true))).limit(1);
        if (main) continue;
        const [sequence] = await tx.update(accountNumberSequence).set({
          nextNumber: sql`${accountNumberSequence.nextNumber} + ${ACCOUNT_BLOCK_SIZE}`,
          updatedAt: new Date()
        })
          .where(eq(accountNumberSequence.id, 1)).returning({ nextNumber: accountNumberSequence.nextNumber });
        await tx.insert(networkAccounts).values({
          ownerUserId: student.id, prefix: "SR", numericPart: sequence.nextNumber - ACCOUNT_BLOCK_SIZE,
          status: student.isActive ? "ACTIVE" : "RESERVED", isMainAccount: true,
          activatedAt: student.isActive ? new Date() : null
        });
        countAssigned += 1;
      }
      if (countAssigned) await tx.insert(auditLogs).values({
        actorUserId: admin.id, action: "MISSING_SR_ACCOUNTS_REPAIRED",
        entityType: "network_account", metadata: { assigned: countAssigned }
      });
      return countAssigned;
    });
    response.json({ assigned });
  })
);

const couponInput = z.object({
  code: z.string().trim().min(2).max(50),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  courseId: z.string().uuid().optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  maxUses: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().default(true)
});

const supportInput = z.object({
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL")
});

platformRouter.get(
  "/notifications",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    response.json({ notifications: items });
  })
);

platformRouter.delete(
  "/notifications",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    await db.delete(notifications).where(eq(notifications.userId, user.id));
    response.status(204).end();
  })
);

platformRouter.post(
  "/support-tickets",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const input = supportInput.parse(request.body);
    const db = requireDatabase();
    const [ticket] = await db
      .insert(supportTickets)
      .values({ userId: user.id, ...input })
      .returning();
    response.status(201).json({ ticket });
  })
);

platformRouter.get(
  "/support-tickets/me",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, user.id))
      .orderBy(desc(supportTickets.createdAt));
    response.json({ tickets });
  })
);

platformRouter.get(
  "/admin/support-tickets",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const tickets = await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
    response.json({ tickets });
  })
);

platformRouter.post(
  "/admin/support-tickets/:id/resolve",
  asyncRoute(async (request, response) => {
    const staff = await requireRole(request, ["staff", "admin"]);
    const input = z
      .object({ resolution: z.string().trim().min(3).max(5000) })
      .parse(request.body);
    const db = requireDatabase();
    const [ticket] = await db
      .update(supportTickets)
      .set({
        status: "RESOLVED",
        resolution: input.resolution,
        assignedTo: staff.id,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, String(request.params.id)))
      .returning();
    if (!ticket) throw new HttpError(404, "Support ticket not found.");
    await db.insert(notifications).values({
      userId: ticket.userId,
      type: "SUPPORT_TICKET_RESOLVED",
      title: "Support ticket resolved",
      message: input.resolution
    });
    response.json({ ticket });
  })
);

platformRouter.get(
  "/admin/coupons",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const items = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    response.json({ coupons: items });
  })
);

platformRouter.post(
  "/admin/coupons",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = couponInput.parse(request.body);
    if (
      input.discountType === "PERCENT" &&
      input.discountValue > 100
    ) {
      throw new HttpError(400, "Percentage discount cannot exceed 100.");
    }
    if (
      input.startsAt &&
      input.expiresAt &&
      input.expiresAt <= input.startsAt
    ) {
      throw new HttpError(400, "Coupon date range is invalid.");
    }
    const db = requireDatabase();
    const [coupon] = await db
      .insert(coupons)
      .values({
        ...input,
        code: input.code.toUpperCase(),
        discountValue: input.discountValue.toFixed(2)
      })
      .returning();
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "COUPON_CREATED",
      entityType: "coupon",
      entityId: coupon.id,
      metadata: { code: coupon.code }
    });
    response.status(201).json({ coupon });
  })
);

platformRouter.get(
  "/admin/settings",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const settings = await db.select().from(systemSettings);
    response.json({ settings });
  })
);

platformRouter.put(
  "/admin/settings/:key",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = z.object({ value: z.unknown() }).parse(request.body);
    const key = z
      .string()
      .regex(/^[A-Z0-9_]+$/)
      .max(80)
      .parse(String(request.params.key).toUpperCase());
    const db = requireDatabase();
    const [setting] = await db
      .insert(systemSettings)
      .values({
        key,
        value: input.value,
        updatedBy: admin.id,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: input.value,
          updatedBy: admin.id,
          updatedAt: new Date()
        }
      })
      .returning();
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "SYSTEM_SETTING_UPDATED",
      entityType: "system_setting",
      entityId: key
    });
    response.json({ setting });
  })
);

platformRouter.post(
  "/notifications/:id/read",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, String(request.params.id)),
          eq(notifications.userId, user.id)
        )
      )
      .returning();
    if (!updated) throw new HttpError(404, "Notification not found.");
    response.json({ notification: updated });
  })
);

platformRouter.get(
  "/student/certificates",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const items = await db
      .select({
        certificate: certificates,
        courseTitle: courses.title
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, user.id))
      .orderBy(desc(certificates.issuedAt));
    response.json({ certificates: items });
  })
);

platformRouter.post(
  "/student/certificates/issue",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const input = z
      .object({ courseId: z.string().uuid() })
      .parse(request.body);
    const db = requireDatabase();
    const [existing] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, user.id),
          eq(certificates.courseId, input.courseId)
        )
      )
      .limit(1);
    if (existing) {
      response.json({ certificate: existing });
      return;
    }
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, input.courseId),
          eq(enrollments.status, "ACTIVE")
        )
      )
      .limit(1);
    if (!enrollment) throw new HttpError(403, "Active enrollment required.");

    const sections = await db
      .select({ id: courseSections.id })
      .from(courseSections)
      .where(eq(courseSections.courseId, input.courseId));
    const sectionIds = sections.map((section) => section.id);
    const [{ totalLessons }] = sectionIds.length
      ? await db
          .select({ totalLessons: count() })
          .from(lessons)
          .where(inArray(lessons.sectionId, sectionIds))
      : [{ totalLessons: 0 }];
    const [{ completedLessons }] = await db
      .select({ completedLessons: count() })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.enrollmentId, enrollment.id),
          eq(lessonProgress.progressPercent, 100)
        )
      );
    if (totalLessons < 1 || completedLessons < totalLessons) {
      throw new HttpError(409, "All course lessons must be completed.");
    }

    const publishedQuizzes = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(
        and(
          eq(quizzes.courseId, input.courseId),
          eq(quizzes.isPublished, true)
        )
      );
    if (publishedQuizzes.length) {
      const passed = await db
        .select({ quizId: quizAttempts.quizId })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, user.id),
            eq(quizAttempts.passed, true),
            inArray(
              quizAttempts.quizId,
              publishedQuizzes.map((quiz) => quiz.id)
            )
          )
        );
      const passedIds = new Set(passed.map((attempt) => attempt.quizId));
      if (passedIds.size < publishedQuizzes.length) {
        throw new HttpError(409, "All required quizzes must be passed.");
      }
    }

    const code =
      "ADIL-" +
      new Date().getUTCFullYear() +
      "-" +
      crypto.randomBytes(5).toString("hex").toUpperCase();
    const [created] = await db
      .insert(certificates)
      .values({
        certificateCode: code,
        userId: user.id,
        courseId: input.courseId
      })
      .returning();
    await db
      .update(enrollments)
      .set({ completedAt: new Date(), status: "COMPLETED" })
      .where(eq(enrollments.id, enrollment.id));
    response.status(201).json({ certificate: created });
  })
);

platformRouter.get(
  "/certificates/:code/verify",
  asyncRoute(async (request, response) => {
    const db = requireDatabase();
    const [item] = await db
      .select({
        code: certificates.certificateCode,
        issuedAt: certificates.issuedAt,
        revokedAt: certificates.revokedAt,
        studentName: users.displayName,
        courseTitle: courses.title
      })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(
        eq(
          certificates.certificateCode,
          String(request.params.code).toUpperCase()
        )
      )
      .limit(1);
    if (!item) throw new HttpError(404, "Certificate not found.");
    response.json({ certificate: item, valid: !item.revokedAt });
  })
);

platformRouter.get(
  "/admin/overview",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const [
      [{ students }],
      [{ consultants }],
      [{ pendingPayments }],
      [{ pendingApplications }],
      [{ activeAccounts }],
      [{ commissionCycleCount }]
    ] = await Promise.all([
      db.select({ students: count() }).from(users).where(eq(users.role, "student")),
      db
        .select({ consultants: count() })
        .from(users)
        .where(eq(users.role, "consultant")),
      db
        .select({ pendingPayments: count() })
        .from(paymentRequests)
        .where(
          inArray(paymentRequests.status, [
            "PENDING",
            "UNDER_REVIEW",
            "PARTIAL"
          ])
        ),
      db
        .select({ pendingApplications: count() })
        .from(consultantApplications)
        .where(
          inArray(consultantApplications.status, ["PENDING", "INTERVIEW"])
        ),
      db
        .select({ activeAccounts: count() })
        .from(networkAccounts)
        .where(eq(networkAccounts.status, "ACTIVE")),
      db.select({ commissionCycleCount: count() }).from(commissionCycles)
    ]);
    response.json({
      students,
      consultants,
      pendingPayments,
      pendingApplications,
      activeAccounts,
      commissionCycleCount
    });
  })
);

platformRouter.get(
  "/admin/students",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const studentRows = await db.select({
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
    }).from(users).where(and(eq(users.role, "student"), isNull(users.removedAt))).orderBy(desc(users.createdAt));

    const students = await Promise.all(studentRows.map(async (student) => {
      const [[enrollment], [account], [payment]] = await Promise.all([
        db.select({ status: enrollments.status, courseTitle: courses.title })
          .from(enrollments).innerJoin(courses, eq(enrollments.courseId, courses.id))
          .where(eq(enrollments.userId, student.id)).limit(1),
        db.select({ prefix: networkAccounts.prefix, numericPart: networkAccounts.numericPart, status: networkAccounts.status })
          .from(networkAccounts).where(and(eq(networkAccounts.ownerUserId, student.id), eq(networkAccounts.isMainAccount, true))).limit(1),
        db.select({ status: paymentRequests.status, paidAmount: paymentRequests.paidAmount, totalAmount: paymentRequests.totalAmount, paymentCode: paymentRequests.paymentCode })
          .from(paymentRequests).where(eq(paymentRequests.userId, student.id)).orderBy(desc(paymentRequests.createdAt)).limit(1)
      ]);
      return {
        ...student,
        enrollment: enrollment ?? null,
        account: account ? { number: `${account.prefix}${account.numericPart}`, status: account.status } : null,
        latestPayment: payment ?? null
      };
    }));
    response.json({ students });
  })
);

const adminStudentRegistrationInput = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(), "Date of birth අනාගත දිනයක් විය නොහැක."),
  nicOrPassport: z.string().trim().max(50).optional(),
  withoutNic: z.boolean().default(false),
  addressLine1: z.string().trim().min(3).max(250),
  addressLine2: z.string().trim().max(250).optional(),
  province: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  courseId: z.string().uuid(),
  paymentPlan: z.enum(["FULL", "HALF"]),
  assignmentType: z.enum(["DIRECT", "CONSULTANT"]),
  parentAccountId: z.string().uuid().optional(),
  side: z.enum(["LEFT", "RIGHT"]).optional()
}).superRefine((value, context) => {
  if (!value.withoutNic && (!value.nicOrPassport || value.nicOrPassport.length < 5)) {
    context.addIssue({ code: "custom", path: ["nicOrPassport"], message: "NIC / Passport එක අවශ්‍යයි." });
  }
  if (value.assignmentType === "CONSULTANT" && (!value.parentAccountId || !value.side)) {
    context.addIssue({ code: "custom", path: ["parentAccountId"], message: "Consultant CN account සහ LEFT/RIGHT side තෝරන්න." });
  }
});

platformRouter.get(
  "/admin/student-registration-options",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const [courseRows, accountRows] = await Promise.all([
      db.select({ id: courses.id, title: courses.title, price: courses.price, currency: courses.currency })
        .from(courses).where(eq(courses.isPublished, true)).orderBy(courses.title),
      db.select({
        id: networkAccounts.id,
        numericPart: networkAccounts.numericPart,
        ownerId: users.id,
        ownerName: users.displayName,
        ownerEmail: users.email
      }).from(networkAccounts)
        .innerJoin(users, eq(networkAccounts.ownerUserId, users.id))
        .where(and(
          eq(networkAccounts.prefix, "CN"),
          eq(networkAccounts.status, "ACTIVE"),
          eq(users.role, "consultant"),
          eq(users.isActive, true),
          isNull(users.removedAt)
        )).orderBy(networkAccounts.numericPart)
    ]);
    response.json({
      courses: courseRows,
      accounts: accountRows.map((account) => ({ ...account, number: `CN${account.numericPart}` }))
    });
  })
);

platformRouter.post(
  "/admin/student-registrations",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = adminStudentRegistrationInput.parse(request.body);
    const db = requireDatabase();
    const email = input.email.toLowerCase();
    const [[course], [existingUser], [recentPayId]] = await Promise.all([
      db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.isPublished, true))).limit(1),
      db.select({ id: users.id }).from(users).where(and(eq(users.email, email), isNull(users.removedAt))).limit(1),
      db.select({ id: paymentReferenceIds.id }).from(paymentReferenceIds)
        .where(and(eq(paymentReferenceIds.email, email), gt(paymentReferenceIds.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000))))
        .orderBy(desc(paymentReferenceIds.createdAt)).limit(1)
    ]);
    if (!course) throw new HttpError(404, "Course එක හමු නොවීය.");
    if (existingUser) throw new HttpError(409, "මෙම email එකට active account එකක් දැනටමත් ඇත.");
    if (recentPayId) throw new HttpError(429, "මෙම email එකට පැය 48 ඇතුළත Pay ID එකක් නිකුත් කර ඇත.");

    const fullAmount = Number(course.price);
    const expectedPaymentAmount = input.paymentPlan === "HALF" ? 10000 : fullAmount;
    if (input.paymentPlan === "HALF" && fullAmount !== 15000) {
      throw new HttpError(400, "Half payment option එක මෙම course එකට ලබා දී නොමැත.");
    }

    let consultantUserId: string | null = null;
    let parentAccountId: string | null = null;
    let side: "LEFT" | "RIGHT" | null = null;
    if (input.assignmentType === "CONSULTANT") {
      const [account] = await db.select({ id: networkAccounts.id, ownerUserId: networkAccounts.ownerUserId })
        .from(networkAccounts).innerJoin(users, eq(networkAccounts.ownerUserId, users.id))
        .where(and(
          eq(networkAccounts.id, input.parentAccountId!), eq(networkAccounts.prefix, "CN"),
          eq(networkAccounts.status, "ACTIVE"), eq(users.role, "consultant"), eq(users.isActive, true), isNull(users.removedAt)
        )).limit(1);
      if (!account) throw new HttpError(400, "Active consultant CN account එකක් තෝරන්න.");
      const [occupied] = await db.select({ id: networkPlacements.id }).from(networkPlacements)
        .where(and(eq(networkPlacements.parentAccountId, account.id), eq(networkPlacements.side, input.side!), eq(networkPlacements.placementKind, "STUDENT"))).limit(1);
      if (occupied) throw new HttpError(409, `${input.side} placement එක දැනටමත් භාවිත කර ඇත.`);
      const [pendingPlacement] = await db.select({ id: consultantStudentRegistrations.id })
        .from(consultantStudentRegistrations)
        .where(and(
          eq(consultantStudentRegistrations.parentAccountId, account.id),
          eq(consultantStudentRegistrations.side, input.side!),
          inArray(consultantStudentRegistrations.status, ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED"])
        )).limit(1);
      if (pendingPlacement) throw new HttpError(409, `${input.side} placement එක සඳහා තවත් admission එකක් දැනට process වෙමින් පවතී.`);
      consultantUserId = account.ownerUserId;
      parentAccountId = account.id;
      side = input.side!;
    }

    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const code = `ADIL-PAY-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const result = await db.transaction(async (tx) => {
      const [payId] = await tx.insert(paymentReferenceIds).values({ code, email, expiresAt }).returning();
      const [registration] = await tx.insert(consultantStudentRegistrations).values({
        consultantUserId, parentAccountId, side, payIdId: payId.id, courseId: course.id,
        registrationSource: input.assignmentType === "DIRECT" ? "ADMIN_DIRECT" : "ADMIN_ASSIGNED",
        paymentPlan: input.paymentPlan, expectedPaymentAmount: expectedPaymentAmount.toFixed(2),
        firstName: input.firstName, lastName: input.lastName, email, phone: input.phone,
        dateOfBirth: input.dateOfBirth, nicOrPassport: input.withoutNic ? null : input.nicOrPassport,
        addressLine1: input.addressLine1, addressLine2: input.addressLine2,
        province: input.province, district: input.district, city: input.city
      }).returning();
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "ADMIN_STUDENT_REGISTRATION_CREATED",
        entityType: "consultant_student_registration",
        entityId: registration.id,
        metadata: { source: registration.registrationSource, email, payId: code, parentAccountId, side }
      });
      return { registration, payId };
    });
    try {
      await sendPayId(email, code, expiresAt);
    } catch {
      await db.delete(consultantStudentRegistrations).where(eq(consultantStudentRegistrations.id, result.registration.id));
      await db.delete(paymentReferenceIds).where(eq(paymentReferenceIds.id, result.payId.id));
      throw new HttpError(503, "Pay ID email එක යැවීමට නොහැකි විය.");
    }
    response.status(201).json({
      registration: { id: result.registration.id, status: result.registration.status, source: result.registration.registrationSource },
      payId: code,
      payIdSent: true,
      expiresAt
    });
  })
);

platformRouter.get(
  "/admin/consultants",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const rows = await db.select({
      id: users.id, name: users.displayName, email: users.email,
      phone: users.phone, isActive: users.isActive, createdAt: users.createdAt
    }).from(users).where(eq(users.role, "consultant")).orderBy(desc(users.createdAt));
    const consultants = await Promise.all(rows.map(async (consultant) => {
      const accounts = await db.select({ prefix: networkAccounts.prefix, numericPart: networkAccounts.numericPart, status: networkAccounts.status })
        .from(networkAccounts).where(eq(networkAccounts.ownerUserId, consultant.id));
      return { ...consultant, accounts: accounts.map((account) => ({ ...account, number: `${account.prefix}${account.numericPart}` })) };
    }));
    response.json({ consultants });
  })
);

platformRouter.get("/admin/consultants/:id/financial-profile", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const consultantId = String(request.params.id);
  const [consultant] = await db.select({ id: users.id, name: users.displayName, email: users.email, phone: users.phone, nicOrPassport: users.nicOrPassport, address: users.address, dateOfBirth: users.dateOfBirth, isActive: users.isActive, createdAt: users.createdAt })
    .from(users).where(and(eq(users.id, consultantId), eq(users.role, "consultant"))).limit(1);
  if (!consultant) throw new HttpError(404, "Consultant not found.");
  const accounts = await db.select().from(networkAccounts).where(eq(networkAccounts.ownerUserId, consultant.id));
  const accountIds = accounts.map((account) => account.id);
  const [[wallet], [bank], entries] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, consultant.id)).limit(1),
    db.select().from(consultantBankDetails).where(eq(consultantBankDetails.userId, consultant.id)).limit(1),
    accountIds.length ? db.select().from(commissionEntries).where(inArray(commissionEntries.accountId, accountIds)) : Promise.resolve([])
  ]);
  const payouts = wallet ? await db.select().from(payoutRequests).where(eq(payoutRequests.walletId, wallet.id)).orderBy(desc(payoutRequests.createdAt)) : [];
  const directEntries = wallet ? await db.select({ amount: walletLedger.amount }).from(walletLedger).where(and(eq(walletLedger.walletId, wallet.id), eq(walletLedger.entryType, "DIRECT_ADMISSION_INCOME"))) : [];
  const directIncome = directEntries.reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingRequests = payouts.filter((item) => ["PENDING", "APPROVED"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);
  let bankDetails = null;
  if (bank) {
    try { bankDetails = { bankName: bank.bankName, branchName: bank.branchName, accountHolderName: bank.accountHolderName, accountNumber: decryptBankAccount(bank.accountNumberEncrypted), accountNumberLast4: bank.accountNumberLast4, updatedAt: bank.updatedAt }; }
    catch { bankDetails = { bankName: bank.bankName, branchName: bank.branchName, accountHolderName: bank.accountHolderName, accountNumber: `••••${bank.accountNumberLast4}`, accountNumberLast4: bank.accountNumberLast4, updatedAt: bank.updatedAt }; }
  }
  response.json({
    consultant,
    accounts: accounts.map((account) => ({ id: account.id, number: `${account.prefix}${account.numericPart}`, status: account.status, isMainAccount: account.isMainAccount })),
    financials: {
      totalIncome: entries.reduce((sum, entry) => sum + Number(entry.amount), 0) + directIncome,
      directIncome,
      pendingIncome: Number(wallet?.pendingBalance ?? 0),
      availableBalance: Number(wallet?.availableBalance ?? 0),
      weeklyPayable: Number(wallet?.pendingBalance ?? 0),
      requestedPayouts: pendingRequests,
      totalPaid: payouts.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.amount), 0)
    },
    bankDetails,
    recentPayouts: payouts.slice(0, 10)
  });
}));

platformRouter.get(
  "/admin/accounts",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const accounts = await db.select({
      id: networkAccounts.id, prefix: networkAccounts.prefix,
      numericPart: networkAccounts.numericPart, status: networkAccounts.status,
      isMainAccount: networkAccounts.isMainAccount, activatedAt: networkAccounts.activatedAt,
      ownerId: users.id, ownerName: users.displayName, ownerEmail: users.email, ownerPhone: users.phone,
      ownerRole: users.role
      , learningPortalEnabled: users.learningPortalEnabled
    }).from(networkAccounts).innerJoin(users, eq(networkAccounts.ownerUserId, users.id))
      .orderBy(desc(networkAccounts.createdAt));
    response.json({ accounts: accounts.map((account) => ({ ...account, number: `${account.prefix}${account.numericPart}` })) });
  })
);

platformRouter.patch("/admin/users/:id/learning-portal", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const db = requireDatabase();
  const input = z.object({ enabled: z.boolean() }).parse(request.body); const userId = String(request.params.id);
  const [updated] = await db.update(users).set({ learningPortalEnabled: input.enabled, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!updated) throw new HttpError(404, "User not found.");
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: input.enabled ? "LEARNING_PORTAL_ENABLED" : "LEARNING_PORTAL_DISABLED", entityType: "user", entityId: userId, metadata: {} });
  response.json({ message: `Learning Portal ${input.enabled ? "enabled" : "disabled"}.` });
}));

platformRouter.post(
  "/admin/accounts/:id/enable-cco",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const accountId = String(request.params.id);

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select({
        account: networkAccounts,
        ownerRole: users.role,
        ownerName: users.displayName
      }).from(networkAccounts)
        .innerJoin(users, eq(networkAccounts.ownerUserId, users.id))
        .where(eq(networkAccounts.id, accountId))
        .limit(1);

      if (!record) throw new HttpError(404, "Account not found.");
      const { account } = record;
      if (!account.isMainAccount) throw new HttpError(409, "CCO can only be enabled on the student's main account.");
      if (account.status !== "ACTIVE") throw new HttpError(409, "Activate the paid SR account before enabling CCO.");

      if (account.prefix === "CN" && record.ownerRole === "consultant") {
        return { account, alreadyEnabled: true, ownerName: record.ownerName };
      }
      if (account.prefix !== "SR" || record.ownerRole !== "student") {
        throw new HttpError(409, "Only an active student SR account can be converted to CCO.");
      }

      const [conflict] = await tx.select({ id: networkAccounts.id })
        .from(networkAccounts)
        .where(and(
          eq(networkAccounts.prefix, "CN"),
          eq(networkAccounts.numericPart, account.numericPart)
        ))
        .limit(1);
      if (conflict) throw new HttpError(409, `CN${account.numericPart} is already assigned. Contact system support.`);

      const [updatedAccount] = await tx.update(networkAccounts)
        .set({ prefix: "CN" })
        .where(eq(networkAccounts.id, account.id))
        .returning();
      await tx.update(users)
        .set({ role: "consultant", updatedAt: new Date() })
        .where(eq(users.id, account.ownerUserId));
      await tx.insert(wallets).values({ userId: account.ownerUserId })
        .onConflictDoNothing({ target: wallets.userId });
      await tx.insert(notifications).values({
        userId: account.ownerUserId,
        type: "CCO_ENABLED",
        title: "CCO account enabled",
        message: `Your account is now CN${account.numericPart}. Refresh or sign in again to open the CCO panel.`
      });
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "CCO_ENABLED",
        entityType: "network_account",
        entityId: account.id,
        metadata: {
          ownerUserId: account.ownerUserId,
          previousNumber: `SR${account.numericPart}`,
          newNumber: `CN${account.numericPart}`
        }
      });
      return { account: updatedAccount, alreadyEnabled: false, ownerName: record.ownerName };
    });

    response.json({
      ...result,
      number: `CN${result.account.numericPart}`,
      message: result.alreadyEnabled
        ? "CCO is already enabled for this account."
        : "CCO enabled successfully. The student must refresh or sign in again."
    });
  })
);

platformRouter.post(
  "/admin/accounts/:id/disable-cco",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const accountId = String(request.params.id);

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select({ account: networkAccounts, ownerRole: users.role })
        .from(networkAccounts)
        .innerJoin(users, eq(networkAccounts.ownerUserId, users.id))
        .where(eq(networkAccounts.id, accountId))
        .limit(1);
      if (!record) throw new HttpError(404, "Account not found.");
      const { account } = record;
      if (!account.isMainAccount || account.prefix !== "CN" || record.ownerRole !== "consultant") {
        throw new HttpError(409, "This account does not have an active CCO conversion.");
      }

      const [conflict] = await tx.select({ id: networkAccounts.id })
        .from(networkAccounts)
        .where(and(eq(networkAccounts.prefix, "SR"), eq(networkAccounts.numericPart, account.numericPart)))
        .limit(1);
      if (conflict) throw new HttpError(409, `SR${account.numericPart} is already assigned. Contact system support.`);

      const [updatedAccount] = await tx.update(networkAccounts)
        .set({ prefix: "SR" })
        .where(eq(networkAccounts.id, account.id))
        .returning();
      await tx.update(users)
        .set({ role: "student", updatedAt: new Date() })
        .where(eq(users.id, account.ownerUserId));
      await tx.insert(notifications).values({
        userId: account.ownerUserId,
        type: "CCO_DISABLED",
        title: "CCO account disabled",
        message: `Your consultant access was disabled. Your main account is now SR${account.numericPart}.`
      });
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "CCO_DISABLED",
        entityType: "network_account",
        entityId: account.id,
        metadata: {
          ownerUserId: account.ownerUserId,
          previousNumber: `CN${account.numericPart}`,
          newNumber: `SR${account.numericPart}`
        }
      });
      return updatedAccount;
    });

    response.json({
      account: result,
      number: `SR${result.numericPart}`,
      message: "CCO disabled successfully. The user must refresh or sign in again."
    });
  })
);

platformRouter.patch(
  "/admin/students/:id/status",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = z.object({ isActive: z.boolean() }).parse(request.body);
    const db = requireDatabase();
    const studentId = String(request.params.id);
    if (input.isActive) {
      const [candidate] = await db.select({ verified: users.emailVerifiedAt, passwordSet: users.passwordSetAt }).from(users).where(eq(users.id, studentId)).limit(1);
      if (!candidate?.verified || !candidate.passwordSet) throw new HttpError(409, "Student must verify the email and set a password first.");
    }
    const [student] = await db.update(users).set({
      isActive: input.isActive,
      updatedAt: new Date()
    }).where(and(eq(users.id, studentId), eq(users.role, "student"))).returning({
      id: users.id,
      name: users.displayName,
      isActive: users.isActive
    });
    if (!student) throw new HttpError(404, "Student not found.");
    if (!input.isActive) await db.delete(sessions).where(eq(sessions.userId, student.id));
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: input.isActive ? "STUDENT_ACTIVATED" : "STUDENT_SUSPENDED",
      entityType: "user",
      entityId: student.id
    });
    response.json({ student });
  })
);

platformRouter.post(
  "/admin/students/:id/remove",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = z.object({
      confirmationEmail: z.string().trim().email(),
      reason: z.string().trim().max(250).optional()
    }).parse(request.body);
    const db = requireDatabase();
    const studentId = String(request.params.id);

    const result = await db.transaction(async (tx) => {
      const [student] = await tx.select({
        id: users.id,
        email: users.email,
        role: users.role,
        removedAt: users.removedAt
      }).from(users).where(eq(users.id, studentId)).limit(1);
      if (!student || student.role !== "student" || student.removedAt) {
        throw new HttpError(404, "Active student record not found.");
      }
      if (student.email.toLowerCase() !== input.confirmationEmail.toLowerCase()) {
        throw new HttpError(409, "Confirmation email does not match this student.");
      }

      const [mainAccount] = await tx.select({
        prefix: networkAccounts.prefix,
        numericPart: networkAccounts.numericPart
      }).from(networkAccounts).where(and(
        eq(networkAccounts.ownerUserId, student.id),
        eq(networkAccounts.isMainAccount, true)
      )).limit(1);
      const accountNumber = mainAccount ? `${mainAccount.prefix}${mainAccount.numericPart}` : "NO-ACCOUNT";
      const removedEmail = `removed-${student.id}@deleted.adil-academy.local`;
      const removedName = `Removed Student ${accountNumber}`;
      const now = new Date();

      // Learning and login data is genuinely removed. Financial/network rows stay
      // attached to an anonymous tombstone so historical totals never change.
      await tx.delete(sessions).where(eq(sessions.userId, student.id));
      await tx.delete(notifications).where(eq(notifications.userId, student.id));
      await tx.delete(quizAttempts).where(eq(quizAttempts.userId, student.id));
      await tx.delete(certificates).where(eq(certificates.userId, student.id));
      await tx.delete(enrollments).where(eq(enrollments.userId, student.id));
      await tx.execute(sql`DELETE FROM email_verification_codes WHERE user_id = ${student.id}`);
      await tx.execute(sql`DELETE FROM support_tickets WHERE user_id = ${student.id}`);
      await tx.execute(sql`DELETE FROM support_agent_presence WHERE user_id = ${student.id}`);
      await tx.execute(sql`UPDATE support_conversations SET visitor_user_id = NULL, visitor_name = ${removedName}, visitor_email = NULL WHERE visitor_user_id = ${student.id}`);
      await tx.execute(sql`UPDATE consultant_student_registrations SET first_name = 'Removed', last_name = 'Student', email = ${removedEmail}, phone = 'REMOVED', date_of_birth = 'REMOVED', nic_or_passport = NULL, address_line_1 = 'REMOVED', address_line_2 = NULL, province = 'REMOVED', district = 'REMOVED', city = 'REMOVED', updated_at = ${now} WHERE lower(email) = lower(${student.email})`);
      await tx.execute(sql`UPDATE payment_reference_ids SET email = ${removedEmail} WHERE lower(email) = lower(${student.email})`);
      await tx.update(networkAccounts).set({ status: "SUSPENDED" }).where(eq(networkAccounts.ownerUserId, student.id));
      await tx.update(users).set({
        email: removedEmail,
        displayName: removedName,
        phone: null,
        nicOrPassport: null,
        address: null,
        dateOfBirth: null,
        isActive: false,
        learningPortalEnabled: false,
        emailVerifiedAt: null,
        passwordSetAt: null,
        profilePhotoObjectKey: null,
        profilePhotoMimeType: null,
        removedAt: now,
        removalReason: input.reason || "Removed by administrator",
        updatedAt: now
      }).where(eq(users.id, student.id));
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "STUDENT_SAFELY_REMOVED",
        entityType: "user",
        entityId: student.id,
        metadata: { accountNumber, financialHistoryRetained: true }
      });
      return { accountNumber };
    });

    response.json({
      message: `${result.accountNumber} removed. The original email can now register again.`,
      accountNumber: result.accountNumber
    });
  })
);

platformRouter.get(
  "/admin/audit-logs",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(250);
    response.json({ logs });
  })
);

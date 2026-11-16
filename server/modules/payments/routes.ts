import crypto from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import express, { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  accountNumberSequence,
  accountPointBalances,
  auditLogs,
  balancePaymentRequests,
  coupons,
  couponUses,
  courses,
  enrollments,
  networkAccounts,
  networkPlacements,
  notifications,
  paymentReferenceIds,
  paymentRequests,
  pointEvents,
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
import { ACCOUNT_BLOCK_SIZE, DIRECT_ADMISSION_INCOME, nextStudentAccountNumber, qualifiesForDirectAdmissionIncome } from "../../domain/business-rules";
import {
  downloadPrivateFile,
  uploadPrivateFile
} from "../../services/storage";
import { createAndSendVerificationCode } from "../auth/service";

export const paymentRouter = Router();

const createPaymentInput = z.object({
  courseId: z.string().uuid(),
  method: z.enum(["BANK_TRANSFER", "BINANCE_PAY", "USDT"]),
  paidAmount: z.coerce.number().positive(),
  transactionReference: z.string().trim().min(2).max(200),
  receivingAccountId: z.string().uuid().optional(),
  requestedParentAccountId: z.string().uuid().optional(),
  requestedSide: z.enum(["LEFT", "RIGHT"]).optional(),
  couponCode: z.string().trim().min(2).max(50).optional()
});

const reviewInput = z.object({
  status: z.enum(["APPROVED", "PARTIAL", "REJECTED"]),
  note: z.string().trim().max(1000).optional()
});

const balancePaymentInput = z.object({
  transactionReference: z.string().trim().min(2).max(200)
});

async function awardAdmissionPoints(tx: any, payment: typeof paymentRequests.$inferSelect) {
  if (!payment.requestedParentAccountId || !payment.requestedSide) return;
  let beneficiaryAccountId: string | null = payment.requestedParentAccountId;
  let side: "LEFT" | "RIGHT" = payment.requestedSide;
  let depth = 0;
  while (beneficiaryAccountId && depth < 100) {
    const inserted = await tx.insert(pointEvents).values({
      idempotencyKey: `payment:${payment.id}:account:${beneficiaryAccountId}`,
      sourcePaymentId: payment.id,
      beneficiaryAccountId,
      side,
      points: 1,
      eventType: "FULL_ADMISSION"
    }).onConflictDoNothing({ target: pointEvents.idempotencyKey }).returning({ id: pointEvents.id });
    if (inserted.length) {
      const left = side === "LEFT" ? 1 : 0;
      const right = side === "RIGHT" ? 1 : 0;
      await tx.insert(accountPointBalances).values({
        accountId: beneficiaryAccountId,
        leftAvailable: left,
        rightAvailable: right,
        lifetimeLeft: left,
        lifetimeRight: right,
        lastQualifiedActivityAt: new Date()
      }).onConflictDoUpdate({
        target: accountPointBalances.accountId,
        set: {
          leftAvailable: sql.raw(`"account_point_balances"."left_available" + ${left}`),
          rightAvailable: sql.raw(`"account_point_balances"."right_available" + ${right}`),
          lifetimeLeft: sql.raw(`"account_point_balances"."lifetime_left" + ${left}`),
          lifetimeRight: sql.raw(`"account_point_balances"."lifetime_right" + ${right}`),
          lastQualifiedActivityAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    const [parent]: Array<{ parentAccountId: string; side: "LEFT" | "RIGHT" }> = await tx.select({ parentAccountId: networkPlacements.parentAccountId, side: networkPlacements.side })
      .from(networkPlacements).where(eq(networkPlacements.accountId, beneficiaryAccountId)).limit(1);
    beneficiaryAccountId = parent?.parentAccountId ?? null;
    if (parent) side = parent.side;
    depth += 1;
  }
}

const proofMimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

function paymentCode() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return "PAY-" + day + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

paymentRouter.post(
  "/payments",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const input = createPaymentInput.parse(request.body);
    if (
      Boolean(input.requestedParentAccountId) !== Boolean(input.requestedSide)
    ) {
      throw new HttpError(
        400,
        "Parent account and LEFT/RIGHT side must be selected together."
      );
    }

    const db = requireDatabase();
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(eq(courses.id, input.courseId), eq(courses.isPublished, true))
      )
      .limit(1);
    if (!course) throw new HttpError(404, "Course not found.");

    let coupon: typeof coupons.$inferSelect | undefined;
    let totalAmount = Number(course.price);
    if (input.couponCode) {
      [coupon] = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.code, input.couponCode.toUpperCase()),
            eq(coupons.isActive, true)
          )
        )
        .limit(1);
      const now = new Date();
      if (
        !coupon ||
        (coupon.courseId && coupon.courseId !== course.id) ||
        (coupon.startsAt && coupon.startsAt > now) ||
        (coupon.expiresAt && coupon.expiresAt < now)
      ) {
        throw new HttpError(400, "Coupon is invalid or expired.");
      }
      if (coupon.maxUses) {
        const [{ uses }] = await db
          .select({ uses: count() })
          .from(couponUses)
          .where(eq(couponUses.couponId, coupon.id));
        if (uses >= coupon.maxUses) {
          throw new HttpError(400, "Coupon usage limit has been reached.");
        }
      }
      const value = Number(coupon.discountValue);
      totalAmount =
        coupon.discountType === "PERCENT"
          ? totalAmount * (1 - Math.min(value, 100) / 100)
          : Math.max(0, totalAmount - value);
    }

    if (input.receivingAccountId) {
      const [receiving] = await db
        .select({ id: networkAccounts.id })
        .from(networkAccounts)
        .where(
          and(
            eq(networkAccounts.id, input.receivingAccountId),
            eq(networkAccounts.status, "ACTIVE")
          )
        )
        .limit(1);
      if (!receiving) {
        throw new HttpError(400, "Receiving account is not active.");
      }
    }

    const [created] = await db
      .insert(paymentRequests)
      .values({
        paymentCode: paymentCode(),
        userId: user.id,
        courseId: course.id,
        method: input.method,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: input.paidAmount.toFixed(2),
        transactionReference: input.transactionReference,
        couponId: coupon?.id,
        receivingAccountId: input.receivingAccountId,
        requestedParentAccountId: input.requestedParentAccountId,
        requestedSide: input.requestedSide
      })
      .returning();
    response.status(201).json({ payment: created });
  })
);

paymentRouter.put(
  "/payments/:id/proof",
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    limit: "8mb"
  }),
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const paymentId = String(request.params.id);
    const [payment] = await db
      .select()
      .from(paymentRequests)
      .where(
        and(
          eq(paymentRequests.id, paymentId),
          eq(paymentRequests.userId, user.id)
        )
      )
      .limit(1);
    if (!payment) throw new HttpError(404, "Payment request not found.");
    if (!["PENDING", "UNDER_REVIEW", "PARTIAL"].includes(payment.status)) {
      throw new HttpError(409, "Payment proof is locked.");
    }

    const mimeType = String(request.headers["content-type"] ?? "").split(";")[0];
    const extension = proofMimeExtensions[mimeType];
    if (!extension || !Buffer.isBuffer(request.body) || request.body.length < 1) {
      throw new HttpError(400, "Upload a JPG, PNG, WebP, or PDF proof file.");
    }

    const objectKey =
      "payment-proofs/" +
      user.id +
      "/" +
      payment.id +
      "-" +
      crypto.randomBytes(6).toString("hex") +
      "." +
      extension;
    await uploadPrivateFile(objectKey, request.body);
    const [updated] = await db
      .update(paymentRequests)
      .set({
        proofObjectKey: objectKey,
        proofMimeType: mimeType,
        status: "UNDER_REVIEW"
      })
      .where(eq(paymentRequests.id, payment.id))
      .returning();
    response.json({ payment: updated });
  })
);

paymentRouter.get(
  "/student/payments",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const items = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.userId, user.id))
      .orderBy(desc(paymentRequests.createdAt));
    const payments = await Promise.all(items.map(async ({ proofObjectKey: proof, ...payment }) => {
      const [[student], [account]] = await Promise.all([
        db.select({ name: users.displayName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, payment.userId)).limit(1),
        db.select({ prefix: networkAccounts.prefix, numericPart: networkAccounts.numericPart }).from(networkAccounts).where(and(eq(networkAccounts.ownerUserId, payment.userId), eq(networkAccounts.isMainAccount, true))).limit(1)
      ]);
      return { ...payment, hasProof: Boolean(proof), student: student ?? null, accountNumber: account ? `${account.prefix}${account.numericPart}` : null };
    }));
    response.json({ payments });
  })
);

paymentRouter.get("/student/balance-payment", asyncRoute(async (request, response) => {
  const user = await requireAuthenticatedUser(request);
  const db = requireDatabase();
  const [original] = await db.select({ payment: paymentRequests, course: courses })
    .from(paymentRequests).innerJoin(courses, eq(courses.id, paymentRequests.courseId))
    .where(and(eq(paymentRequests.userId, user.id), eq(paymentRequests.status, "PARTIAL")))
    .orderBy(desc(paymentRequests.createdAt)).limit(1);
  if (!original) {
    response.json({ eligible: false, outstandingAmount: 0, request: null });
    return;
  }
  const [latest] = await db.select().from(balancePaymentRequests)
    .where(eq(balancePaymentRequests.originalPaymentId, original.payment.id))
    .orderBy(desc(balancePaymentRequests.createdAt)).limit(1);
  response.json({
    eligible: true,
    originalPaymentId: original.payment.id,
    courseId: original.course.id,
    courseTitle: original.course.title,
    halfPaymentLessonLimit: original.course.halfPaymentLessonLimit,
    outstandingAmount: Math.max(0, Number(original.payment.totalAmount) - Number(original.payment.paidAmount)),
    request: latest ? { ...latest, proofObjectKey: undefined, hasProof: Boolean(latest.proofObjectKey) } : null
  });
}));

paymentRouter.post("/student/balance-payments", asyncRoute(async (request, response) => {
  const user = await requireAuthenticatedUser(request);
  const input = balancePaymentInput.parse(request.body);
  const db = requireDatabase();
  const created = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(paymentRequests)
      .where(and(eq(paymentRequests.userId, user.id), eq(paymentRequests.status, "PARTIAL")))
      .orderBy(desc(paymentRequests.createdAt)).limit(1);
    if (!original?.courseId) throw new HttpError(409, "No half-payment course balance is available.");
    const [open] = await tx.select().from(balancePaymentRequests)
      .where(and(eq(balancePaymentRequests.originalPaymentId, original.id), inArray(balancePaymentRequests.status, ["PENDING", "UNDER_REVIEW", "APPROVED"])))
      .limit(1);
    if (open) throw new HttpError(409, open.status === "APPROVED" ? "Balance payment is already approved." : "A balance payment request is already pending.");
    const amount = Number(original.totalAmount) - Number(original.paidAmount);
    if (amount <= 0) throw new HttpError(409, "No outstanding balance remains.");
    const [item] = await tx.insert(balancePaymentRequests).values({
      originalPaymentId: original.id,
      userId: user.id,
      courseId: original.courseId,
      amount: amount.toFixed(2),
      transactionReference: input.transactionReference
    }).returning();
    return item;
  });
  response.status(201).json({ request: created });
}));

paymentRouter.put("/student/balance-payments/:id/proof", express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "application/pdf"], limit: "8mb"
}), asyncRoute(async (request, response) => {
  const user = await requireAuthenticatedUser(request);
  const db = requireDatabase();
  const [item] = await db.select().from(balancePaymentRequests).where(and(
    eq(balancePaymentRequests.id, String(request.params.id)), eq(balancePaymentRequests.userId, user.id)
  )).limit(1);
  if (!item) throw new HttpError(404, "Balance payment request not found.");
  if (item.status !== "PENDING") throw new HttpError(409, "This balance payment proof is locked.");
  const mimeType = String(request.headers["content-type"] ?? "").split(";")[0];
  const extension = proofMimeExtensions[mimeType];
  if (!extension || !Buffer.isBuffer(request.body) || request.body.length < 1) throw new HttpError(400, "Upload a JPG, PNG, WebP, or PDF proof file.");
  const objectKey = `balance-payment-proofs/${user.id}/${item.id}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  await uploadPrivateFile(objectKey, request.body);
  const [updated] = await db.update(balancePaymentRequests).set({ proofObjectKey: objectKey, proofMimeType: mimeType, status: "UNDER_REVIEW", updatedAt: new Date() })
    .where(eq(balancePaymentRequests.id, item.id)).returning();
  response.json({ request: updated });
}));

paymentRouter.get("/admin/balance-payments", asyncRoute(async (request, response) => {
  await requireRole(request, ["staff", "admin"]);
  const db = requireDatabase();
  const rows = await db.select({ request: balancePaymentRequests, student: users, course: courses, original: paymentRequests })
    .from(balancePaymentRequests)
    .innerJoin(users, eq(users.id, balancePaymentRequests.userId))
    .innerJoin(courses, eq(courses.id, balancePaymentRequests.courseId))
    .innerJoin(paymentRequests, eq(paymentRequests.id, balancePaymentRequests.originalPaymentId))
    .orderBy(desc(balancePaymentRequests.createdAt));
  response.json({ requests: rows.map(({ request: item, student, course, original }) => ({
    ...item, proofObjectKey: undefined, hasProof: Boolean(item.proofObjectKey),
    student: { name: student.displayName, email: student.email, phone: student.phone },
    course: { id: course.id, title: course.title }, originalPaymentCode: original.paymentCode
  })) });
}));

paymentRouter.get("/admin/balance-payments/:id/proof", asyncRoute(async (request, response) => {
  await requireRole(request, ["staff", "admin"]);
  const db = requireDatabase();
  const [item] = await db.select().from(balancePaymentRequests).where(eq(balancePaymentRequests.id, String(request.params.id))).limit(1);
  if (!item?.proofObjectKey) throw new HttpError(404, "Balance payment proof not found.");
  response.type(item.proofMimeType ?? "application/octet-stream").send(await downloadPrivateFile(item.proofObjectKey));
}));

paymentRouter.post("/admin/balance-payments/:id/review", asyncRoute(async (request, response) => {
  const reviewer = await requireRole(request, ["staff", "admin"]);
  const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(1000).optional() }).parse(request.body);
  const db = requireDatabase();
  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(balancePaymentRequests).where(eq(balancePaymentRequests.id, String(request.params.id))).limit(1);
    if (!item) throw new HttpError(404, "Balance payment request not found.");
    if (!["PENDING", "UNDER_REVIEW"].includes(item.status)) throw new HttpError(409, "Balance payment request is already finalized.");
    if (input.status === "APPROVED" && !item.proofObjectKey) throw new HttpError(400, "Payment proof is required.");
    const [original] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, item.originalPaymentId)).limit(1);
    if (!original) throw new HttpError(404, "Original payment not found.");
    const [updated] = await tx.update(balancePaymentRequests).set({ status: input.status, reviewNote: input.note, reviewedBy: reviewer.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(balancePaymentRequests.id, item.id)).returning();
    if (input.status === "REJECTED") {
      await tx.insert(notifications).values({ userId: item.userId, type: "BALANCE_PAYMENT_REJECTED", title: "Balance payment rejected", message: "Please check the payment details and submit a new proof." });
      return updated;
    }
    if (original.status !== "PARTIAL") throw new HttpError(409, "Original payment is no longer awaiting a balance.");
    await tx.update(paymentRequests).set({ status: "APPROVED", paidAmount: original.totalAmount, reviewedBy: reviewer.id, reviewedAt: new Date(), reviewNote: "Balance payment approved" })
      .where(eq(paymentRequests.id, original.id));
    await tx.insert(enrollments).values({ userId: original.userId, courseId: item.courseId, status: "ACTIVE" })
      .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set: { status: "ACTIVE" } });
    await awardAdmissionPoints(tx, original);
    await tx.insert(notifications).values({ userId: item.userId, type: "BALANCE_PAYMENT_APPROVED", title: "Course fully unlocked", message: "Your balance payment was approved. All lessons are now available." });
    await tx.insert(auditLogs).values({ actorUserId: reviewer.id, action: "BALANCE_PAYMENT_APPROVED", entityType: "balance_payment_request", entityId: item.id, metadata: { originalPaymentId: original.id, pointsProtectedBy: "pointEvents.idempotencyKey" } });
    return updated;
  });
  response.json({ request: result });
}));

paymentRouter.get(
  "/admin/payments",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const status = z
      .enum([
        "PENDING",
        "UNDER_REVIEW",
        "PARTIAL",
        "APPROVED",
        "REJECTED",
        "REFUNDED"
      ])
      .optional()
      .parse(request.query.status);
    const items = status
      ? await db
          .select()
          .from(paymentRequests)
          .where(eq(paymentRequests.status, status))
          .orderBy(desc(paymentRequests.createdAt))
      : await db
          .select()
          .from(paymentRequests)
          .orderBy(desc(paymentRequests.createdAt));
    const payments = await Promise.all(items.map(async ({ proofObjectKey: proof, ...payment }) => {
      const [[student], [account], [placementConsultant]] = await Promise.all([
        db.select({ name: users.displayName, email: users.email, phone: users.phone })
          .from(users).where(eq(users.id, payment.userId)).limit(1),
        db.select({ prefix: networkAccounts.prefix, numericPart: networkAccounts.numericPart })
          .from(networkAccounts)
          .where(and(eq(networkAccounts.ownerUserId, payment.userId), eq(networkAccounts.isMainAccount, true)))
          .limit(1),
        payment.requestedParentAccountId
          ? db.select({
              id: users.id,
              name: users.displayName,
              email: users.email,
              phone: users.phone,
              prefix: networkAccounts.prefix,
              numericPart: networkAccounts.numericPart
            })
              .from(networkAccounts)
              .innerJoin(users, eq(users.id, networkAccounts.ownerUserId))
              .where(eq(networkAccounts.id, payment.requestedParentAccountId))
              .limit(1)
          : Promise.resolve([])
      ]);
      return {
        ...payment,
        hasProof: Boolean(proof),
        student: student ?? null,
        accountNumber: account ? `${account.prefix}${account.numericPart}` : null,
        placementConsultant: placementConsultant ? {
          id: placementConsultant.id,
          name: placementConsultant.name,
          email: placementConsultant.email,
          phone: placementConsultant.phone,
          accountNumber: `${placementConsultant.prefix}${placementConsultant.numericPart}`,
          side: payment.requestedSide
        } : null
      };
    }));
    response.json({ payments });
  })
);

paymentRouter.get(
  "/admin/payments/:id/proof",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const [payment] = await db
      .select({
        proofObjectKey: paymentRequests.proofObjectKey,
        proofMimeType: paymentRequests.proofMimeType
      })
      .from(paymentRequests)
      .where(eq(paymentRequests.id, String(request.params.id)))
      .limit(1);
    if (!payment?.proofObjectKey) {
      throw new HttpError(404, "Payment proof not found.");
    }
    const bytes = await downloadPrivateFile(payment.proofObjectKey);
    response.type(payment.proofMimeType ?? "application/octet-stream");
    response.send(bytes);
  })
);

paymentRouter.post(
  "/admin/payments/:id/undo-rejection",
  asyncRoute(async (request, response) => {
    const reviewer = await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const paymentId = String(request.params.id);
    const result = await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, paymentId)).limit(1);
      if (!payment) throw new HttpError(404, "Payment request not found.");
      if (payment.status !== "REJECTED") throw new HttpError(409, "Rejected payment එකක් පමණක් undo කළ හැක.");
      const [updated] = await tx.update(paymentRequests).set({
        status: "UNDER_REVIEW",
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null
      }).where(eq(paymentRequests.id, payment.id)).returning();
      await tx.insert(auditLogs).values({
        actorUserId: reviewer.id,
        action: "PAYMENT_REJECTION_UNDONE",
        entityType: "payment_request",
        entityId: payment.id,
        metadata: { previousStatus: "REJECTED", newStatus: "UNDER_REVIEW" }
      });
      return updated;
    });
    response.json({ payment: result, message: "Rejection undo කළා. Payment එක නැවත review කරන්න පුළුවන්." });
  })
);

paymentRouter.post(
  "/admin/payments/:id/review",
  asyncRoute(async (request, response) => {
    const reviewer = await requireRole(request, ["staff", "admin"]);
    const input = reviewInput.parse(request.body);
    const db = requireDatabase();
    const paymentId = String(request.params.id);

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, paymentId))
        .limit(1);
      if (!payment) throw new HttpError(404, "Payment request not found.");
      if (["APPROVED", "REJECTED", "REFUNDED"].includes(payment.status)) {
        throw new HttpError(409, "Payment request is already finalized.");
      }
      if (input.status === "APPROVED") {
        if (!payment.proofObjectKey) {
          throw new HttpError(400, "Payment proof is required.");
        }
        if (Number(payment.paidAmount) < Number(payment.totalAmount)) {
          throw new HttpError(400, "Full payment is required for approval.");
        }
        if (!payment.payIdId) {
          throw new HttpError(400, "A valid Pay ID is required for approval.");
        }
        const [payId] = await tx.select().from(paymentReferenceIds).where(eq(paymentReferenceIds.id, payment.payIdId)).limit(1);
        if (!payId?.usedAt || payId.code !== payment.transactionReference) {
          throw new HttpError(400, "Bank reference must exactly match the verified Pay ID.");
        }
      }

      const [updatedPayment] = await tx
        .update(paymentRequests)
        .set({
          status: input.status,
          reviewNote: input.note,
          reviewedBy: reviewer.id,
          reviewedAt: new Date()
        })
        .where(eq(paymentRequests.id, payment.id))
        .returning();

      if (qualifiesForDirectAdmissionIncome(input.status)) {
        const beneficiaryId = payment.requestedParentAccountId ?? payment.receivingAccountId;
        if (beneficiaryId) {
          const [beneficiary] = await tx.select({ ownerUserId: networkAccounts.ownerUserId, prefix: networkAccounts.prefix, ownerRole: users.role })
            .from(networkAccounts).innerJoin(users, eq(users.id, networkAccounts.ownerUserId))
            .where(and(eq(networkAccounts.id, beneficiaryId), eq(networkAccounts.status, "ACTIVE"))).limit(1);
          if (beneficiary?.prefix === "CN" && beneficiary.ownerRole === "consultant") {
            await tx.insert(wallets).values({ userId: beneficiary.ownerUserId }).onConflictDoNothing({ target: wallets.userId });
            const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, beneficiary.ownerUserId)).limit(1);
            const inserted = await tx.insert(walletLedger).values({
              walletId: wallet.id,
              idempotencyKey: `direct-admission:${payment.id}`,
              entryType: "DIRECT_ADMISSION_INCOME",
              amount: DIRECT_ADMISSION_INCOME.toFixed(2),
              referenceType: "payment_request",
              referenceId: payment.id,
              note: `${updatedPayment.status} direct admission • ${payment.paymentCode}`
            }).onConflictDoNothing({ target: walletLedger.idempotencyKey }).returning({ id: walletLedger.id });
            if (inserted.length) {
              await tx.update(wallets).set({ pendingBalance: sql`${wallets.pendingBalance} + ${DIRECT_ADMISSION_INCOME}`, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
              await tx.insert(notifications).values({ userId: beneficiary.ownerUserId, type: "DIRECT_ADMISSION_INCOME", title: "Rs. 3,000 direct admission income", message: `${payment.paymentCode} සඳහා direct admission income එක pending wallet එකට එකතු විය.` });
            }
          }
        }
      }

      if (input.status === "PARTIAL" && payment.courseId) {
        await tx.insert(enrollments).values({ userId: payment.userId, courseId: payment.courseId, status: "ACTIVE" })
          .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set: { status: "ACTIVE" } });
        await tx.insert(notifications).values({
          userId: payment.userId,
          type: "HALF_PAYMENT_APPROVED",
          title: "Half payment approved",
          message: "Your first course lessons are unlocked. Complete the balance payment to unlock all lessons."
        });
      }

      if (input.status !== "APPROVED" || !payment.courseId) {
        await tx.insert(auditLogs).values({
          actorUserId: reviewer.id,
          action: "PAYMENT_" + input.status,
          entityType: "payment_request",
          entityId: payment.id,
          metadata: { note: input.note ?? null }
        });
        return { payment: updatedPayment, account: null };
      }

      await tx
        .insert(enrollments)
        .values({
          userId: payment.userId,
          courseId: payment.courseId,
          status: "ACTIVE"
        })
        .onConflictDoNothing({
          target: [enrollments.userId, enrollments.courseId]
        });

      let [account] = await tx
        .select()
        .from(networkAccounts)
        .where(
          and(
            eq(networkAccounts.ownerUserId, payment.userId),
            eq(networkAccounts.isMainAccount, true)
          )
        )
        .limit(1);

      if (!account) {
        await tx
          .insert(accountNumberSequence)
          .values({ id: 1, nextNumber: 527694 })
          .onConflictDoNothing();
        const [highest] = await tx.select({ numericPart: networkAccounts.numericPart })
          .from(networkAccounts).orderBy(desc(networkAccounts.numericPart)).limit(1);
        const nextBlock = nextStudentAccountNumber(highest?.numericPart);
        const [sequence] = await tx
          .update(accountNumberSequence)
          .set({
            nextNumber: sql`GREATEST(${accountNumberSequence.nextNumber}, ${nextBlock}) + ${ACCOUNT_BLOCK_SIZE}`,
            updatedAt: new Date()
          })
          .where(eq(accountNumberSequence.id, 1))
          .returning({ nextNumber: accountNumberSequence.nextNumber });
        const allocatedNumber = sequence.nextNumber - ACCOUNT_BLOCK_SIZE;
        [account] = await tx
          .insert(networkAccounts)
          .values({
            ownerUserId: payment.userId,
            prefix: "SR",
            numericPart: allocatedNumber,
            status: "ACTIVE",
            isMainAccount: true,
            activatedAt: new Date()
          })
          .returning();

        if (payment.requestedParentAccountId && payment.requestedSide) {
          await tx.insert(networkPlacements).values({
            accountId: account.id,
            parentAccountId: payment.requestedParentAccountId,
            side: payment.requestedSide,
            placedByUserId: reviewer.id
          });
        }
      } else if (account.status !== "ACTIVE") {
        [account] = await tx.update(networkAccounts).set({
          status: "ACTIVE",
          activatedAt: new Date()
        }).where(eq(networkAccounts.id, account.id)).returning();
      }

      if (payment.requestedParentAccountId && payment.requestedSide) {
        const [existingPlacement] = await tx.select({ id: networkPlacements.id }).from(networkPlacements)
          .where(eq(networkPlacements.accountId, account.id)).limit(1);
        if (!existingPlacement) await tx.insert(networkPlacements).values({
          accountId: account.id,
          parentAccountId: payment.requestedParentAccountId,
          side: payment.requestedSide,
          placedByUserId: reviewer.id
        });
      }

      if (
        payment.requestedParentAccountId &&
        payment.requestedSide
      ) {
        let beneficiaryAccountId: string | null =
          payment.requestedParentAccountId;
        let side: "LEFT" | "RIGHT" = payment.requestedSide;
        let depth = 0;

        while (beneficiaryAccountId && depth < 100) {
          const idempotencyKey =
            "payment:" +
            payment.id +
            ":account:" +
            beneficiaryAccountId;
          const insertedPoint = await tx
            .insert(pointEvents)
            .values({
              idempotencyKey,
              sourcePaymentId: payment.id,
              beneficiaryAccountId,
              side,
              points: 1,
              eventType: "FULL_ADMISSION"
            })
            .onConflictDoNothing({
              target: pointEvents.idempotencyKey
            })
            .returning({ id: pointEvents.id });

          if (insertedPoint.length) {
            const leftPoints = side === "LEFT" ? 1 : 0;
            const rightPoints = side === "RIGHT" ? 1 : 0;
            await tx
            .insert(accountPointBalances)
            .values({
              accountId: beneficiaryAccountId,
              leftAvailable: leftPoints,
              rightAvailable: rightPoints,
              lifetimeLeft: leftPoints,
              lifetimeRight: rightPoints,
              lastQualifiedActivityAt: new Date()
            })
            .onConflictDoUpdate({
              target: accountPointBalances.accountId,
              set: {
                leftAvailable: sql.raw(
                  '"account_point_balances"."left_available" + ' + String(leftPoints)
                ),
                rightAvailable: sql.raw(
                  '"account_point_balances"."right_available" + ' + String(rightPoints)
                ),
                lifetimeLeft: sql.raw(
                  '"account_point_balances"."lifetime_left" + ' + String(leftPoints)
                ),
                lifetimeRight: sql.raw(
                  '"account_point_balances"."lifetime_right" + ' + String(rightPoints)
                ),
                lastQualifiedActivityAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          const [parentPlacement] = await tx
            .select({
              parentAccountId: networkPlacements.parentAccountId,
              side: networkPlacements.side
            })
            .from(networkPlacements)
            .where(eq(networkPlacements.accountId, beneficiaryAccountId))
            .limit(1);
          beneficiaryAccountId = parentPlacement?.parentAccountId ?? null;
          if (parentPlacement) side = parentPlacement.side;
          depth += 1;
        }
      }

      await tx.insert(notifications).values({
        userId: payment.userId,
        type: "PAYMENT_APPROVED",
        title: "Payment approved",
        message: "Your course access and student account are now active."
      });
      if (payment.couponId) {
        await tx
          .insert(couponUses)
          .values({
            couponId: payment.couponId,
            userId: payment.userId,
            paymentRequestId: payment.id
          })
          .onConflictDoNothing({ target: couponUses.paymentRequestId });
      }
      await tx.insert(auditLogs).values({
        actorUserId: reviewer.id,
        action: "PAYMENT_APPROVED",
        entityType: "payment_request",
        entityId: payment.id,
        metadata: {
          enrollmentCourseId: payment.courseId,
          accountId: account.id
        }
      });
      return { payment: updatedPayment, account };
    });

    let otpEmailSent = false;
    if (["APPROVED", "PARTIAL"].includes(result.payment.status)) {
      try {
        await createAndSendVerificationCode(result.payment.userId);
        otpEmailSent = true;
      } catch (error) {
        console.error("Payment approved but OTP email failed", error);
      }
    }
    response.json({ ...result, otpEmailSent });
  })
);

paymentRouter.post("/admin/payments/:id/repair-point", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const paymentId = z.string().uuid().parse(request.params.id);
  const db = requireDatabase();
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, paymentId)).limit(1);
    if (!payment) throw new HttpError(404, "Payment එක හමු නොවීය.");
    if (payment.status !== "APPROVED" || Number(payment.paidAmount) < Number(payment.totalAmount)) throw new HttpError(409, "Full approved payment එකකට පමණක් point add කළ හැක.");
    if (!payment.requestedParentAccountId || !payment.requestedSide) throw new HttpError(409, "මෙම payment එකට consultant CN placement side එකක් සම්බන්ධ වී නැහැ.");
    let beneficiaryAccountId: string | null = payment.requestedParentAccountId;
    let side: "LEFT" | "RIGHT" = payment.requestedSide;
    let added = 0;
    let depth = 0;
    while (beneficiaryAccountId && depth < 100) {
      const inserted = await tx.insert(pointEvents).values({
        idempotencyKey: `payment:${payment.id}:account:${beneficiaryAccountId}`,
        sourcePaymentId: payment.id,
        beneficiaryAccountId,
        side,
        points: 1,
        eventType: "FULL_ADMISSION"
      }).onConflictDoNothing({ target: pointEvents.idempotencyKey }).returning({ id: pointEvents.id });
      if (inserted.length) {
        const leftPoints = side === "LEFT" ? 1 : 0;
        const rightPoints = side === "RIGHT" ? 1 : 0;
        await tx.insert(accountPointBalances).values({ accountId: beneficiaryAccountId, leftAvailable: leftPoints, rightAvailable: rightPoints, lifetimeLeft: leftPoints, lifetimeRight: rightPoints, lastQualifiedActivityAt: new Date() })
          .onConflictDoUpdate({ target: accountPointBalances.accountId, set: { leftAvailable: sql.raw(`"account_point_balances"."left_available" + ${leftPoints}`), rightAvailable: sql.raw(`"account_point_balances"."right_available" + ${rightPoints}`), lifetimeLeft: sql.raw(`"account_point_balances"."lifetime_left" + ${leftPoints}`), lifetimeRight: sql.raw(`"account_point_balances"."lifetime_right" + ${rightPoints}`), lastQualifiedActivityAt: new Date(), updatedAt: new Date() } });
        added += 1;
      }
      const [parent] = await tx.select({ parentAccountId: networkPlacements.parentAccountId, side: networkPlacements.side }).from(networkPlacements).where(eq(networkPlacements.accountId, beneficiaryAccountId)).limit(1);
      beneficiaryAccountId = parent?.parentAccountId ?? null;
      if (parent) side = parent.side;
      depth += 1;
    }
    await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "FULL_ADMISSION_POINT_REPAIRED", entityType: "payment_request", entityId: payment.id, metadata: { added } });
    return { added, message: added ? `Missing admission point ${added} account(s) සඳහා add විය.` : "Point එක කලින්ම add වී ඇත; duplicate point එකක් add කළේ නැහැ." };
  });
  response.json(result);
}));

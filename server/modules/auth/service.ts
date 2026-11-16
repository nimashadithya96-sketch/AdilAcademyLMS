import crypto from "node:crypto";
import argon2 from "argon2";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { requireDatabase } from "../../../db/client";
import { accountNumberSequence, consultantStudentRegistrations, courses, emailVerificationCodes, networkAccounts, paymentReferenceIds, paymentRequests, sessions, users } from "../../../db/schema";
import type { DemoUser } from "../../../shared/platform";
import { ACCOUNT_BLOCK_SIZE, nextStudentAccountNumber } from "../../domain/business-rules";
import { sendVerificationCode } from "../../services/email";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;

export type RegisterInput = {
  displayName: string;
  email: string;
  phone?: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AdmissionInput = {
  displayName: string;
  email: string;
  phone: string;
  nicOrPassport: string;
  courseId: string;
  transactionReference: string;
  payId: string;
};

function publicUser(user: typeof users.$inferSelect): DemoUser {
  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    role: user.role,
    learningPortalEnabled: user.learningPortalEnabled
  };
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashVerificationCode(userId: string, code: string) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "local-development")
    .update(`${userId}:${code}`)
    .digest("hex");
}

function registrationTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function matchesRegistrationToken(token: string, hash: string | null) {
  return Boolean(hash) && registrationTokenHash(token) === hash;
}

export async function createAdmissionApplication(input: AdmissionInput) {
  const db = requireDatabase();
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("EMAIL_ALREADY_EXISTS");
  const [course] = await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.isPublished, true))).limit(1);
  if (!course) throw new Error("COURSE_NOT_FOUND");
  const normalizedPayId = input.payId.trim().toUpperCase();
  const [payId] = await db.select().from(paymentReferenceIds).where(and(
    eq(paymentReferenceIds.code, normalizedPayId),
    eq(paymentReferenceIds.email, email),
    isNull(paymentReferenceIds.usedAt),
    gt(paymentReferenceIds.expiresAt, new Date())
  )).limit(1);
  if (!payId || input.transactionReference.trim().toUpperCase() !== normalizedPayId) {
    throw new Error("INVALID_PAY_ID");
  }
  const [consultantRegistration] = await db.select().from(consultantStudentRegistrations)
    .where(eq(consultantStudentRegistrations.payIdId, payId.id)).limit(1);

  const registrationToken = crypto.randomBytes(32).toString("base64url");
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email,
      passwordHash: await argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id }),
      displayName: consultantRegistration ? `${consultantRegistration.firstName} ${consultantRegistration.lastName}` : input.displayName.trim(),
      phone: consultantRegistration?.phone ?? input.phone.trim(),
      nicOrPassport: consultantRegistration?.nicOrPassport ?? input.nicOrPassport.trim(),
      address: consultantRegistration ? [consultantRegistration.addressLine1, consultantRegistration.addressLine2, consultantRegistration.city, consultantRegistration.district, consultantRegistration.province].filter(Boolean).join(", ") : null,
      dateOfBirth: consultantRegistration?.dateOfBirth ?? null,
      role: "student",
      isActive: false
    }).returning();
    await tx.insert(accountNumberSequence).values({ id: 1, nextNumber: 527694 }).onConflictDoNothing();
    const [highest] = await tx.select({ numericPart: networkAccounts.numericPart })
      .from(networkAccounts).orderBy(desc(networkAccounts.numericPart)).limit(1);
    const nextBlock = nextStudentAccountNumber(highest?.numericPart);
    const [sequence] = await tx.update(accountNumberSequence).set({
      nextNumber: sql`GREATEST(${accountNumberSequence.nextNumber}, ${nextBlock}) + ${ACCOUNT_BLOCK_SIZE}`,
      updatedAt: new Date()
    }).where(eq(accountNumberSequence.id, 1)).returning({ nextNumber: accountNumberSequence.nextNumber });
    const numericPart = sequence.nextNumber - ACCOUNT_BLOCK_SIZE;
    await tx.insert(networkAccounts).values({
      ownerUserId: user.id,
      prefix: "SR",
      numericPart,
      status: "RESERVED",
      isMainAccount: true
    });
    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const expectedAmount = consultantRegistration
      ? Number(consultantRegistration.expectedPaymentAmount)
      : Number(course.price);
    const [payment] = await tx.insert(paymentRequests).values({
      paymentCode: `PAY-${day}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      userId: user.id,
      courseId: course.id,
      method: "BANK_TRANSFER",
      totalAmount: course.price,
      paidAmount: expectedAmount.toFixed(2),
      transactionReference: normalizedPayId,
      payIdId: payId.id,
      requestedParentAccountId: consultantRegistration?.parentAccountId,
      requestedSide: consultantRegistration?.side,
      registrationTokenHash: registrationTokenHash(registrationToken)
    }).returning();
    if (consultantRegistration) await tx.update(consultantStudentRegistrations).set({ status: "PAYMENT_SUBMITTED", updatedAt: new Date() }).where(eq(consultantStudentRegistrations.id, consultantRegistration.id));
    return { user, payment };
  });
  return { applicationId: result.payment.id, paymentCode: result.payment.paymentCode, registrationToken };
}

export async function createAndSendVerificationCode(userId: string) {
  const db = requireDatabase();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("USER_NOT_FOUND");
  const code = String(crypto.randomInt(100000, 1000000));
  await db.insert(emailVerificationCodes).values({
    userId,
    codeHash: hashVerificationCode(userId, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
  await sendVerificationCode(user.email, code);
}

export async function verifyCodeAndSetPassword(input: {
  email: string;
  code: string;
  password: string;
}) {
  const db = requireDatabase();
  const email = input.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("INVALID_VERIFICATION");

  const [verification] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.userId, user.id),
        isNull(emailVerificationCodes.usedAt),
        gt(emailVerificationCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);
  if (!verification || verification.attempts >= 5) {
    throw new Error("INVALID_VERIFICATION");
  }
  if (verification.codeHash !== hashVerificationCode(user.id, input.code)) {
    await db.update(emailVerificationCodes).set({ attempts: verification.attempts + 1 }).where(eq(emailVerificationCodes.id, verification.id));
    throw new Error("INVALID_VERIFICATION");
  }

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const [activated] = await db.transaction(async (tx) => {
    await tx.update(emailVerificationCodes).set({ usedAt: new Date() }).where(eq(emailVerificationCodes.id, verification.id));
    return tx.update(users).set({
      passwordHash,
      emailVerifiedAt: new Date(),
      passwordSetAt: new Date(),
      isActive: true,
      updatedAt: new Date()
    }).where(eq(users.id, user.id)).returning();
  });
  return createPersistentSession(activated);
}

export async function registerStudent(input: RegisterInput) {
  const db = requireDatabase();
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id
  });

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName: input.displayName.trim(),
      phone: input.phone?.trim() || null,
      role: "student"
    })
    .returning();

  return createPersistentSession(created);
}

export async function loginUser(input: LoginInput) {
  const db = requireDatabase();
  const email = input.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  if (!user || !user.emailVerifiedAt || !user.passwordSetAt || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return createPersistentSession(user);
}

async function createPersistentSession(user: typeof users.$inferSelect) {
  const db = requireDatabase();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt
  });

  return {
    token,
    expiresAt,
    user: publicUser(user)
  };
}

export async function getUserForSession(token: string) {
  const db = requireDatabase();
  const [result] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  return result ? publicUser(result.user) : null;
}

export async function deletePersistentSession(token: string) {
  const db = requireDatabase();
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

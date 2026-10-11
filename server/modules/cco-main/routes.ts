import crypto from "node:crypto";
import argon2 from "argon2";
import express, { Router, type Request } from "express";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"; // ADIL_CCO_PAYID_REUSE_V59
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { accountNumberSequence, auditLogs, ccoMainApplications, ccoMainPayIds, networkAccounts, notifications, users } from "../../../db/schema";
import { ACCOUNT_BLOCK_SIZE, nextStudentAccountNumber } from "../../domain/business-rules";
import { HttpError, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";
import { createAndSendVerificationCode, matchesRegistrationToken } from "../auth/service";
import { sendCcoMainApplicationReceived, sendCcoMainPayId } from "../../services/email";
import { downloadPrivateFile, uploadPrivateFile } from "../../services/storage";

export const ccoMainRouter = Router();

const issueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  amount: z.coerce.number().min(1).max(1_000_000).default(5000)
});
const submitSchema = z.object({
  payId: z.string().trim().min(8).max(80), firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(1).max(80), email: z.string().trim().email(), phone: z.string().trim().min(7).max(30),
  dateOfBirth: z.string().trim().min(4).max(20), nicOrPassport: z.string().trim().min(4).max(40),
  addressLine1: z.string().trim().min(3).max(240), addressLine2: z.string().trim().max(240).optional().default(""),
  province: z.string().trim().min(2).max(80), district: z.string().trim().min(2).max(80), city: z.string().trim().min(2).max(80),
  transactionReference: z.string().trim().min(3).max(120)
});
const reviewSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(500).optional() });

function tokenHash(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }
function makePayId() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `CCO-${day}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// ADIL_CCO_PAYID_REUSE_V59: bind a CCO Pay ID to the first public IP that uses it.
// The raw IP is never stored; only a SHA-256 hash is persisted.
function payIdClientIpHash(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const realIp = request.headers["x-real-ip"];
  const raw = String(forwardedValue || realIp || request.socket.remoteAddress || request.ip || "unknown")
    .split(",")[0]
    .trim();
  return crypto.createHash("sha256").update(raw).digest("hex");
}

ccoMainRouter.post("/admin/cco-main/pay-ids", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const input = issueSchema.parse(request.body);
  const email = input.email.toLowerCase();
  const db = requireDatabase();
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) throw new HttpError(409, "මෙම email එකට දැනටමත් account එකක් තිබේ.");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [payId] = await db.insert(ccoMainPayIds).values({
    code: makePayId(), intendedName: input.name, intendedEmail: email, intendedPhone: input.phone,
    amount: String(input.amount), expiresAt, createdBy: admin.id
  }).returning();
  let emailSent = false;
  try { await sendCcoMainPayId(email, input.name, payId.code, input.amount, expiresAt); emailSent = true; }
  catch (error) { console.error("CCO main Pay ID email failed", error); }
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: "CCO_MAIN_PAY_ID_ISSUED", entityType: "cco_main_pay_id", entityId: payId.id, metadata: { email, amount: input.amount } });
  response.json({ payId: payId.code, expiresAt, emailSent });
}));

ccoMainRouter.post("/public/cco-main/validate", asyncRoute(async (request, response) => {
  const code = z.string().trim().min(8).parse(request.body?.payId).toUpperCase();
  const db = requireDatabase();
  const ipHash = payIdClientIpHash(request);
  // ADIL_CCO_PAYID_REUSE_V59: reusable for 48h, but only from the first-bound public IP.
  const [payId] = await db.update(ccoMainPayIds).set({
    boundIpHash: ipHash,
    claimedAt: sql`COALESCE(${ccoMainPayIds.claimedAt}, now())`
  }).where(and(
    eq(ccoMainPayIds.code, code),
    isNull(ccoMainPayIds.cancelledAt),
    gt(ccoMainPayIds.expiresAt, new Date()),
    or(isNull(ccoMainPayIds.boundIpHash), eq(ccoMainPayIds.boundIpHash, ipHash))
  )).returning();
  if (!payId) throw new HttpError(400, "Pay ID එක invalid/expired හෝ වෙනත් device/IP එකකට bind වී ඇත.");
  response.json({ valid: true, name: payId.intendedName, email: payId.intendedEmail, phone: payId.intendedPhone, amount: Number(payId.amount), expiresAt: payId.expiresAt });
}));

ccoMainRouter.post("/public/cco-main/applications", asyncRoute(async (request, response) => {
  const input = submitSchema.parse(request.body);
  const db = requireDatabase();
  const code = input.payId.toUpperCase();
  const email = input.email.toLowerCase();
  const registrationToken = crypto.randomBytes(32).toString("base64url");
  const result = await db.transaction(async (tx) => {
    const ipHash = payIdClientIpHash(request);
    const [payId] = await tx.update(ccoMainPayIds).set({
      boundIpHash: ipHash,
      claimedAt: sql`COALESCE(${ccoMainPayIds.claimedAt}, now())`
    }).where(and(
      eq(ccoMainPayIds.code, code), eq(ccoMainPayIds.intendedEmail, email),
      isNull(ccoMainPayIds.cancelledAt), gt(ccoMainPayIds.expiresAt, new Date()),
      or(isNull(ccoMainPayIds.boundIpHash), eq(ccoMainPayIds.boundIpHash, ipHash))
    )).returning();
    if (!payId) throw new HttpError(409, "Pay ID එක invalid/expired, වෙනත් email එකකට අදාළ, හෝ වෙනත් device/IP එකකට bind වී ඇත.");
    if (input.transactionReference.toUpperCase() !== code) throw new HttpError(400, "Bank reference එක special Pay ID එකට සමාන විය යුතුයි.");

    // ADIL_CCO_PAYID_REUSE_V59: if the first attempt created the application but proof upload failed,
    // issue a fresh upload token instead of consuming/rejecting the same Pay ID.
    const [retry] = await tx.select({ application: ccoMainApplications, account: networkAccounts })
      .from(ccoMainApplications)
      .innerJoin(networkAccounts, eq(networkAccounts.id, ccoMainApplications.accountId))
      .where(eq(ccoMainApplications.payIdId, payId.id))
      .limit(1);
    if (retry) {
      if (retry.application.status !== "AWAITING_PROOF") {
        throw new HttpError(409, "මෙම Pay ID එකෙන් application එක දැනටමත් submit කර ඇත. Admin review status එක බලන්න.");
      }
      await tx.update(ccoMainApplications).set({
        registrationTokenHash: tokenHash(registrationToken),
        updatedAt: new Date()
      }).where(eq(ccoMainApplications.id, retry.application.id));
      return { application: retry.application, account: retry.account, reused: true };
    }

    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new HttpError(409, "මෙම email එකට දැනටමත් account එකක් තිබේ.");
    const [user] = await tx.insert(users).values({
      email, displayName: `${input.firstName} ${input.lastName}`.trim(), phone: input.phone,
      nicOrPassport: input.nicOrPassport, dateOfBirth: input.dateOfBirth,
      address: [input.addressLine1, input.addressLine2, input.city, input.district, input.province].filter(Boolean).join(", "),
      passwordHash: await argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id }),
      role: "consultant", isActive: false, learningPortalEnabled: false
    }).returning();
    await tx.insert(accountNumberSequence).values({ id: 1, nextNumber: 527694 }).onConflictDoNothing();
    const [highest] = await tx.select({ numericPart: networkAccounts.numericPart }).from(networkAccounts).orderBy(desc(networkAccounts.numericPart)).limit(1);
    const nextBlock = nextStudentAccountNumber(highest?.numericPart);
    const [sequence] = await tx.update(accountNumberSequence).set({
      nextNumber: sql`GREATEST(${accountNumberSequence.nextNumber}, ${nextBlock}) + ${ACCOUNT_BLOCK_SIZE}`, updatedAt: new Date()
    }).where(eq(accountNumberSequence.id, 1)).returning({ nextNumber: accountNumberSequence.nextNumber });
    const [account] = await tx.insert(networkAccounts).values({
      ownerUserId: user.id, prefix: "CN", numericPart: sequence.nextNumber - ACCOUNT_BLOCK_SIZE,
      status: "RESERVED", isMainAccount: true
    }).returning();
    const [application] = await tx.insert(ccoMainApplications).values({
      payIdId: payId.id, userId: user.id, accountId: account.id, firstName: input.firstName, lastName: input.lastName,
      email, phone: input.phone, dateOfBirth: input.dateOfBirth, nicOrPassport: input.nicOrPassport,
      addressLine1: input.addressLine1, addressLine2: input.addressLine2 || null, province: input.province,
      district: input.district, city: input.city, transactionReference: code,
      registrationTokenHash: tokenHash(registrationToken)
    }).returning();
    return { application, account };
  });
  response.json({ applicationId: result.application.id, registrationToken, accountNumber: `CN${result.account.numericPart}`, reused: "reused" in result ? result.reused : false }); // ADIL_CCO_PAYID_REUSE_V59
}));

ccoMainRouter.put("/public/cco-main/applications/:id/proof", express.raw({ type: ["image/jpeg", "image/png", "image/webp", "application/pdf"], limit: "8mb" }), asyncRoute(async (request, response) => {
  const token = String(request.headers["x-registration-token"] || "");
  const db = requireDatabase();
  const [application] = await db.select().from(ccoMainApplications).where(eq(ccoMainApplications.id, z.string().uuid().parse(request.params.id))).limit(1);
  if (!application || !matchesRegistrationToken(token, application.registrationTokenHash)) throw new HttpError(403, "Application token invalid.");
  const mime = String(request.headers["content-type"] || "").split(";")[0];
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  if (!extensions[mime] || !Buffer.isBuffer(request.body) || request.body.length < 1) throw new HttpError(400, "JPG, PNG, WebP හෝ PDF slip එකක් upload කරන්න.");
  const objectKey = `cco-main-proofs/${application.userId}/${application.id}.${extensions[mime]}`;
  await uploadPrivateFile(objectKey, request.body);
  await db.update(ccoMainApplications).set({ proofObjectKey: objectKey, proofMimeType: mime, status: "UNDER_REVIEW", registrationTokenHash: null, updatedAt: new Date() }).where(eq(ccoMainApplications.id, application.id));
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (admins.length) await db.insert(notifications).values(admins.map((admin) => ({ userId: admin.id, type: "CCO_MAIN_APPLICATION", title: "New CCO Main application", message: `${application.firstName} ${application.lastName} • ${application.email}` })));
  let emailSent = false;
  try { await sendCcoMainApplicationReceived(application.email, `${application.firstName} ${application.lastName}`); emailSent = true; }
  catch (error) { console.error("CCO main confirmation email failed", error); }
  response.json({ message: "CCO Main application submitted successfully.", emailSent });
}));

ccoMainRouter.get("/admin/cco-main/applications", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]); const db = requireDatabase();
  const rows = await db.select({ application: ccoMainApplications, payId: ccoMainPayIds, account: networkAccounts }).from(ccoMainApplications)
    .innerJoin(ccoMainPayIds, eq(ccoMainPayIds.id, ccoMainApplications.payIdId))
    .innerJoin(networkAccounts, eq(networkAccounts.id, ccoMainApplications.accountId))
    .orderBy(desc(ccoMainApplications.createdAt));
  response.json({ applications: rows.map(({ application, payId, account }) => ({ ...application, payId: payId.code, amount: Number(payId.amount), accountNumber: `${account.prefix}${account.numericPart}` })) });
}));

ccoMainRouter.get("/admin/cco-main/applications/:id/proof", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]); const db = requireDatabase();
  const [application] = await db.select().from(ccoMainApplications).where(eq(ccoMainApplications.id, z.string().uuid().parse(request.params.id))).limit(1);
  if (!application?.proofObjectKey) throw new HttpError(404, "Payment proof එකක් නැහැ.");
  const file = await downloadPrivateFile(application.proofObjectKey); response.type(application.proofMimeType || "application/octet-stream").send(file);
}));

ccoMainRouter.post("/admin/cco-main/applications/:id/review", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const input = reviewSchema.parse(request.body); const db = requireDatabase();
  const result = await db.transaction(async (tx) => {
    const [application] = await tx.select().from(ccoMainApplications).where(eq(ccoMainApplications.id, z.string().uuid().parse(request.params.id))).limit(1);
    if (!application) throw new HttpError(404, "Application එක හමු නොවීය.");
    if (application.status !== "UNDER_REVIEW") throw new HttpError(409, "මෙම application එක review කිරීමට නොහැක.");
    await tx.update(ccoMainApplications).set({ status: input.status, reviewNote: input.note || null, reviewedBy: admin.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(ccoMainApplications.id, application.id));
    if (input.status === "APPROVED") {
      await tx.update(networkAccounts).set({ status: "ACTIVE", activatedAt: new Date() }).where(eq(networkAccounts.id, application.accountId));
      await tx.insert(notifications).values({ userId: application.userId, type: "CCO_MAIN_APPROVED", title: "CCO Main payment approved", message: "OTP එක email වෙත යවා ඇත. Verify OTP කර password එක සකස් කරන්න." });
    }
    await tx.insert(auditLogs).values({ actorUserId: admin.id, action: `CCO_MAIN_${input.status}`, entityType: "cco_main_application", entityId: application.id, metadata: { note: input.note || null } });
    return application;
  });
  let otpEmailSent = false;
  if (input.status === "APPROVED") { try { await createAndSendVerificationCode(result.userId); otpEmailSent = true; } catch (error) { console.error("CCO main OTP email failed", error); } }
  response.json({ message: input.status === "APPROVED" ? "CCO Main approved." : "CCO Main rejected.", otpEmailSent });
}));

ccoMainRouter.post("/admin/cco-main/applications/:id/undo", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const db = requireDatabase();
  const [updated] = await db.update(ccoMainApplications).set({ status: "UNDER_REVIEW", reviewNote: null, reviewedBy: null, reviewedAt: null, updatedAt: new Date() })
    .where(and(eq(ccoMainApplications.id, z.string().uuid().parse(request.params.id)), eq(ccoMainApplications.status, "REJECTED"))).returning();
  if (!updated) throw new HttpError(409, "Rejected application එකක් පමණක් undo කළ හැක.");
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: "CCO_MAIN_REJECTION_UNDONE", entityType: "cco_main_application", entityId: updated.id });
  response.json({ message: "Rejection undone. Application නැවත review කළ හැක." });
}));

import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import express, { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  accountPointBalances,
  auditLogs,
  ccoActivationRequests,
  commissionCycles,
  commissionEntries,
  consultantApplications,
  consultantAdmissionTargets,
  consultantBankDetails,
  consultantStudentRegistrations,
  courses,
  networkAccounts,
  networkPlacements,
  notifications,
  paymentRequests,
  pointEvents,
  payoutRequests,
  paymentReferenceIds,
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
import { sendPayId } from "../../services/email";
import { encryptBankAccount } from "../../services/bank-details";
import { downloadPrivateFile, uploadPrivateFile } from "../../services/storage";

export const consultantRouter = Router();

type EarningPeriod = "daily" | "weekly" | "monthly";
const COLOMBO_OFFSET_MS = 330 * 60 * 1000;

function colomboDate(date: Date) { return new Date(date.getTime() + COLOMBO_OFFSET_MS); }
function dateKey(date: Date) { return colomboDate(date).toISOString().slice(0, 10); }
function weekKey(date: Date) {
  const local = colomboDate(date);
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return local.toISOString().slice(0, 10);
}
function monthKey(date: Date) { return colomboDate(date).toISOString().slice(0, 7); }
function periodKey(date: Date, period: EarningPeriod) { return period === "daily" ? dateKey(date) : period === "weekly" ? weekKey(date) : monthKey(date); }
function earningTrend(rows: Array<{ amount: string; createdAt: Date }>, period: EarningPeriod) {
  const count = period === "daily" ? 14 : period === "weekly" ? 10 : 12;
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(periodKey(row.createdAt, period), (totals.get(periodKey(row.createdAt, period)) ?? 0) + Number(row.amount));
  const points: Array<{ key: string; label: string; amount: number }> = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset--) {
    const cursor = new Date(now);
    if (period === "daily") cursor.setUTCDate(cursor.getUTCDate() - offset);
    else if (period === "weekly") cursor.setUTCDate(cursor.getUTCDate() - offset * 7);
    else { cursor.setUTCDate(1); cursor.setUTCMonth(cursor.getUTCMonth() - offset); }
    const key = periodKey(cursor, period);
    const local = colomboDate(cursor);
    const label = period === "daily"
      ? local.toLocaleDateString("en-LK", { timeZone: "UTC", month: "short", day: "numeric" })
      : period === "weekly"
        ? `W ${new Date(`${key}T00:00:00Z`).toLocaleDateString("en-LK", { timeZone: "UTC", month: "short", day: "numeric" })}`
        : local.toLocaleDateString("en-LK", { timeZone: "UTC", month: "short", year: "2-digit" });
    points.push({ key, label, amount: totals.get(key) ?? 0 });
  }
  const current = points.at(-1)?.amount ?? 0;
  const previous = points.at(-2)?.amount ?? 0;
  const best = points.reduce((winner, point) => point.amount > winner.amount ? point : winner, points[0]);
  const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  return { points, current, previous, bestAmount: best?.amount ?? 0, bestLabel: best?.label ?? "—", changePercent };
}

const bankDetailsInput = z.object({
  bankName: z.string().trim().min(2).max(100),
  branchName: z.string().trim().min(2).max(100),
  accountHolderName: z.string().trim().min(2).max(150),
  accountNumber: z.string().trim().regex(/^[0-9A-Za-z-]{5,34}$/)
});

async function admissionSnapshot() {
  const db = requireDatabase();
  const rows = await db.select({
    ownerUserId: networkAccounts.ownerUserId,
    paidAmount: paymentRequests.paidAmount,
    totalAmount: paymentRequests.totalAmount,
    createdAt: paymentRequests.reviewedAt,
    fallbackCreatedAt: paymentRequests.createdAt
  }).from(paymentRequests)
    .innerJoin(networkAccounts, eq(networkAccounts.id, paymentRequests.requestedParentAccountId))
    .where(eq(paymentRequests.status, "APPROVED"));
  return rows.filter((row) => Number(row.paidAmount) >= Number(row.totalAmount)).map((row) => ({
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt ?? row.fallbackCreatedAt
  }));
}

consultantRouter.get("/consultant/admission-targets", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  const [target] = await db.select().from(consultantAdmissionTargets).where(eq(consultantAdmissionTargets.userId, consultant.id)).limit(1);
  const admissions = (await admissionSnapshot()).filter((item) => item.ownerUserId === consultant.id);
  const now = new Date(); const count = (period: EarningPeriod) => admissions.filter((item) => periodKey(item.createdAt, period) === periodKey(now, period)).length;
  const targets = { daily: target?.dailyTarget ?? 0, weekly: target?.weeklyTarget ?? 0, monthly: target?.monthlyTarget ?? 0 };
  const progress = { daily: count("daily"), weekly: count("weekly"), monthly: count("monthly") };
  response.json({ targets, progress, achieved: { daily: targets.daily > 0 && progress.daily >= targets.daily, weekly: targets.weekly > 0 && progress.weekly >= targets.weekly, monthly: targets.monthly > 0 && progress.monthly >= targets.monthly } });
}));

consultantRouter.put("/consultant/admission-targets", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  const input = z.object({ daily: z.number().int().min(0).max(10000), weekly: z.number().int().min(0).max(10000), monthly: z.number().int().min(0).max(10000) }).parse(request.body);
  await db.insert(consultantAdmissionTargets).values({ userId: consultant.id, dailyTarget: input.daily, weeklyTarget: input.weekly, monthlyTarget: input.monthly }).onConflictDoUpdate({ target: consultantAdmissionTargets.userId, set: { dailyTarget: input.daily, weeklyTarget: input.weekly, monthlyTarget: input.monthly, updatedAt: new Date() } });
  response.json({ message: "Admission targets saved." });
}));

consultantRouter.get("/consultant/profile", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  const [profile] = await db.select({ id: users.id, name: users.displayName, email: users.email, phone: users.phone, hasPhoto: users.profilePhotoObjectKey }).from(users).where(eq(users.id, consultant.id)).limit(1);
  response.json({ ...profile, photoUrl: profile?.hasPhoto ? `/api/consultant/profile-photo/${consultant.id}` : null });
}));

consultantRouter.put("/consultant/profile-photo", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); if (!Buffer.isBuffer(request.body) || request.body.length < 10) throw new HttpError(400, "Profile image එකක් තෝරන්න.");
  const mime = request.headers["content-type"] ?? "image/jpeg"; const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const key = `consultant-profile-photos/${consultant.id}-${crypto.randomBytes(6).toString("hex")}.${extension}`; await uploadPrivateFile(key, request.body); const db = requireDatabase();
  await db.update(users).set({ profilePhotoObjectKey: key, profilePhotoMimeType: mime, updatedAt: new Date() }).where(eq(users.id, consultant.id)); response.json({ photoUrl: `/api/consultant/profile-photo/${consultant.id}?v=${Date.now()}` });
}));

consultantRouter.delete("/consultant/profile-photo", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  await db.update(users).set({ profilePhotoObjectKey: null, profilePhotoMimeType: null, updatedAt: new Date() }).where(eq(users.id, consultant.id));
  response.json({ message: "Profile photo removed." });
}));

consultantRouter.get("/consultant/profile-photo/:userId", asyncRoute(async (request, response) => {
  await requireAuthenticatedUser(request); const db = requireDatabase(); const [profile] = await db.select({ key: users.profilePhotoObjectKey, mime: users.profilePhotoMimeType }).from(users).where(eq(users.id, String(request.params.userId))).limit(1);
  if (!profile?.key) throw new HttpError(404, "Profile photo not found."); response.type(profile.mime ?? "image/jpeg").set("Cache-Control", "private, max-age=300").send(await downloadPrivateFile(profile.key));
}));

consultantRouter.get("/consultant/admission-heroes", asyncRoute(async (request, response) => {
  await requireRole(request, ["consultant"]); const db = requireDatabase();
  const [consultants, targets, admissions] = await Promise.all([
    db.select({ id: users.id, name: users.displayName, accountNumericPart: networkAccounts.numericPart, hasPhoto: users.profilePhotoObjectKey }).from(users).leftJoin(networkAccounts, and(eq(networkAccounts.ownerUserId, users.id), eq(networkAccounts.prefix, "CN"), eq(networkAccounts.isMainAccount, true))).where(and(eq(users.role, "consultant"), eq(users.isActive, true))),
    db.select().from(consultantAdmissionTargets), admissionSnapshot()
  ]);
  const now = new Date(); const targetMap = new Map(targets.map((item) => [item.userId, item]));
  const heroes = consultants.map((person) => { const own = admissions.filter((item) => item.ownerUserId === person.id); const counts = { daily: own.filter((x) => dateKey(x.createdAt) === dateKey(now)).length, weekly: own.filter((x) => weekKey(x.createdAt) === weekKey(now)).length, monthly: own.filter((x) => monthKey(x.createdAt) === monthKey(now)).length }; const target = targetMap.get(person.id); const wins = (["daily", "weekly", "monthly"] as const).filter((period) => (target?.[`${period}Target`] ?? 0) > 0 && counts[period] >= (target?.[`${period}Target`] ?? 0)); return { ...person, accountNumber: person.accountNumericPart ? `CN${person.accountNumericPart}` : null, photoUrl: person.hasPhoto ? `/api/consultant/profile-photo/${person.id}` : null, counts, wins }; });
  const rank = (period: "weekly" | "monthly", limit: number) => heroes.filter((item) => item.counts[period] > 0).sort((a, b) => b.counts[period] - a.counts[period] || a.name.localeCompare(b.name)).slice(0, limit);
  response.json({ targetWinners: heroes.filter((item) => item.wins.length), weeklyChampions: rank("weekly", 5), monthlyChampions: rank("monthly", 10) });
}));

consultantRouter.get("/consultant/bank-details", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]);
  const db = requireDatabase();
  const [details] = await db.select({ bankName: consultantBankDetails.bankName, branchName: consultantBankDetails.branchName, accountHolderName: consultantBankDetails.accountHolderName, accountNumberLast4: consultantBankDetails.accountNumberLast4, updatedAt: consultantBankDetails.updatedAt })
    .from(consultantBankDetails).where(eq(consultantBankDetails.userId, consultant.id)).limit(1);
  response.json({ bankDetails: details ?? null });
}));

consultantRouter.put("/consultant/bank-details", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]);
  const input = bankDetailsInput.parse(request.body);
  const db = requireDatabase();
  const normalized = input.accountNumber.replaceAll(" ", "");
  const [saved] = await db.insert(consultantBankDetails).values({
    userId: consultant.id, bankName: input.bankName, branchName: input.branchName,
    accountHolderName: input.accountHolderName, accountNumberEncrypted: encryptBankAccount(normalized),
    accountNumberLast4: normalized.slice(-4)
  }).onConflictDoUpdate({ target: consultantBankDetails.userId, set: {
    bankName: input.bankName, branchName: input.branchName, accountHolderName: input.accountHolderName,
    accountNumberEncrypted: encryptBankAccount(normalized), accountNumberLast4: normalized.slice(-4), updatedAt: new Date()
  }}).returning({ bankName: consultantBankDetails.bankName, branchName: consultantBankDetails.branchName, accountHolderName: consultantBankDetails.accountHolderName, accountNumberLast4: consultantBankDetails.accountNumberLast4, updatedAt: consultantBankDetails.updatedAt });
  response.json({ bankDetails: saved, message: "Bank details securely saved." });
}));

const studentRegistrationInput = z.object({
  firstName: z.string().trim().min(2).max(60), lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(200), phone: z.string().trim().min(7).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(), "Date of birth අනාගත දිනයක් විය නොහැක."),
  nicOrPassport: z.string().trim().max(50).optional(), withoutNic: z.boolean().default(false),
  addressLine1: z.string().trim().min(3).max(250), addressLine2: z.string().trim().max(250).optional(),
  province: z.string().trim().min(2).max(80), district: z.string().trim().min(2).max(80), city: z.string().trim().min(2).max(80),
  courseId: z.string().uuid(), paymentPlan: z.enum(["FULL", "HALF"]), parentAccountId: z.string().uuid(), side: z.enum(["LEFT", "RIGHT"])
}).superRefine((value, context) => {
  if (!value.withoutNic && (!value.nicOrPassport || value.nicOrPassport.length < 5)) context.addIssue({ code: "custom", path: ["nicOrPassport"], message: "NIC / Passport එක අවශ්‍යයි." });
});

consultantRouter.post("/consultant/student-registrations", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]);
  const input = studentRegistrationInput.parse(request.body);
  const db = requireDatabase();
  const email = input.email.toLowerCase();
  const [[account], [course], [existingUser], [recentPayId]] = await Promise.all([
    db.select().from(networkAccounts).where(and(eq(networkAccounts.id, input.parentAccountId), eq(networkAccounts.ownerUserId, consultant.id), eq(networkAccounts.prefix, "CN"), eq(networkAccounts.status, "ACTIVE"))).limit(1),
    db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.isPublished, true))).limit(1),
    db.select({ id: users.id }).from(users).where(and(eq(users.email, email), isNull(users.removedAt))).limit(1),
    db.select().from(paymentReferenceIds).where(and(eq(paymentReferenceIds.email, email), gt(paymentReferenceIds.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000)))).orderBy(desc(paymentReferenceIds.createdAt)).limit(1)
  ]);
  if (!account) throw new HttpError(400, "Active consultant CN account එකක් තෝරන්න.");
  if (!course) throw new HttpError(404, "Course එක හමු නොවීය.");
  const fullAmount = Number(course.price);
  const expectedPaymentAmount = input.paymentPlan === "HALF" ? 10000 : fullAmount;
  if (input.paymentPlan === "HALF" && fullAmount !== 15000) {
    throw new HttpError(400, "Half payment option එක මෙම course එකට ලබා දී නොමැත.");
  }
  if (existingUser) throw new HttpError(409, "මෙම email එකට account එකක් දැනටමත් ඇත.");
  if (recentPayId) throw new HttpError(429, "මෙම email එකට පැය 48 ඇතුළත Pay ID එකක් නිකුත් කර ඇත.");
  const [occupied] = await db.select({ id: networkPlacements.id }).from(networkPlacements).where(and(eq(networkPlacements.parentAccountId, account.id), eq(networkPlacements.side, input.side), eq(networkPlacements.placementKind, "STUDENT"))).limit(1);
  if (occupied) throw new HttpError(409, `${input.side} placement එක දැනටමත් භාවිත කර ඇත.`);
  const [pendingPlacement] = await db.select({ id: consultantStudentRegistrations.id }).from(consultantStudentRegistrations)
    .where(and(
      eq(consultantStudentRegistrations.parentAccountId, account.id),
      eq(consultantStudentRegistrations.side, input.side),
      inArray(consultantStudentRegistrations.status, ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED"])
    )).limit(1);
  if (pendingPlacement) throw new HttpError(409, `${input.side} placement එක සඳහා තවත් admission එකක් දැනට process වෙමින් පවතී.`);
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const code = `ADIL-PAY-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const result = await db.transaction(async (tx) => {
    const [payId] = await tx.insert(paymentReferenceIds).values({ code, email, expiresAt }).returning();
    const [registration] = await tx.insert(consultantStudentRegistrations).values({
      consultantUserId: consultant.id, parentAccountId: account.id, payIdId: payId.id, courseId: course.id,
      paymentPlan: input.paymentPlan, expectedPaymentAmount: expectedPaymentAmount.toFixed(2),
      firstName: input.firstName, lastName: input.lastName, email, phone: input.phone, dateOfBirth: input.dateOfBirth,
      nicOrPassport: input.withoutNic ? null : input.nicOrPassport, addressLine1: input.addressLine1,
      addressLine2: input.addressLine2, province: input.province, district: input.district, city: input.city, side: input.side
    }).returning();
    return { registration, payId };
  });
  try { await sendPayId(email, code, expiresAt); }
  catch {
    await db.delete(consultantStudentRegistrations).where(eq(consultantStudentRegistrations.id, result.registration.id));
    await db.delete(paymentReferenceIds).where(eq(paymentReferenceIds.id, result.payId.id));
    throw new HttpError(503, "Pay ID email එක යැවීමට නොහැකි විය.");
  }
  response.status(201).json({ registration: { id: result.registration.id, status: result.registration.status }, payIdSent: true, expiresAt });
}));

consultantRouter.get("/consultant/student-registrations", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]);
  const db = requireDatabase();
  const rows = await db.select({
    registration: consultantStudentRegistrations,
    payId: paymentReferenceIds.code,
    payIdExpiresAt: paymentReferenceIds.expiresAt,
    courseTitle: courses.title,
    paymentPlan: consultantStudentRegistrations.paymentPlan,
    expectedPaymentAmount: consultantStudentRegistrations.expectedPaymentAmount,
    paymentStatus: paymentRequests.status,
    paymentCode: paymentRequests.paymentCode,
    paidAmount: paymentRequests.paidAmount,
    totalAmount: paymentRequests.totalAmount,
    studentUserId: users.id,
    studentActive: users.isActive,
    accountPrefix: networkAccounts.prefix,
    accountNumericPart: networkAccounts.numericPart,
    accountStatus: networkAccounts.status
  })
    .from(consultantStudentRegistrations).innerJoin(paymentReferenceIds, eq(paymentReferenceIds.id, consultantStudentRegistrations.payIdId))
    .innerJoin(courses, eq(courses.id, consultantStudentRegistrations.courseId))
    .leftJoin(paymentRequests, eq(paymentRequests.payIdId, consultantStudentRegistrations.payIdId))
    .leftJoin(users, eq(users.email, consultantStudentRegistrations.email))
    .leftJoin(networkAccounts, and(eq(networkAccounts.ownerUserId, users.id), eq(networkAccounts.isMainAccount, true)))
    .where(eq(consultantStudentRegistrations.consultantUserId, consultant.id)).orderBy(desc(consultantStudentRegistrations.createdAt));
  response.json({ registrations: rows.map((row) => ({
    ...row.registration,
    payId: row.payId,
    payIdExpiresAt: row.payIdExpiresAt,
    courseTitle: row.courseTitle,
    paymentPlan: row.paymentPlan,
    expectedPaymentAmount: Number(row.expectedPaymentAmount),
    paymentCode: row.paymentCode,
    paidAmount: row.paidAmount === null ? null : Number(row.paidAmount),
    totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
    accountNumber: row.accountPrefix && row.accountNumericPart ? `${row.accountPrefix}${row.accountNumericPart}` : null,
    accountStatus: row.accountStatus,
    status: row.paymentStatus === "APPROVED" && row.accountStatus === "ACTIVE" ? "ACTIVE"
      : row.paymentStatus === "PENDING" ? "PAYMENT_REVIEW"
      : row.paymentStatus === "REJECTED" ? "REJECTED"
      : row.registration.status
  })) });
}));

consultantRouter.get(
  "/consultant/cco-dashboard",
  asyncRoute(async (request, response) => {
    const user = await requireRole(request, ["consultant"]);
    const db = requireDatabase();
    await expireTrialAccounts(db);
    const accountRows = await db.select({
      account: networkAccounts,
      balance: accountPointBalances
    }).from(networkAccounts)
      .leftJoin(accountPointBalances, eq(accountPointBalances.accountId, networkAccounts.id))
      .where(eq(networkAccounts.ownerUserId, user.id))
      .orderBy(desc(networkAccounts.isMainAccount));

    const accountIds = accountRows.map((row) => row.account.id);
    const [wallet] = await db.select().from(wallets)
      .where(eq(wallets.userId, user.id)).limit(1);
    const [entries, placements, ledger, payouts, directEntries] = await Promise.all([
      accountIds.length
        ? db.select().from(commissionEntries)
          .where(inArray(commissionEntries.accountId, accountIds))
          .orderBy(desc(commissionEntries.createdAt))
        : Promise.resolve([]),
      accountIds.length
        ? db.select().from(networkPlacements)
          .where(inArray(networkPlacements.parentAccountId, accountIds))
        : Promise.resolve([]),
      wallet
        ? db.select().from(walletLedger).where(eq(walletLedger.walletId, wallet.id))
          .orderBy(desc(walletLedger.createdAt))
        : Promise.resolve([]),
      wallet
        ? db.select().from(payoutRequests).where(eq(payoutRequests.walletId, wallet.id))
          .orderBy(desc(payoutRequests.createdAt))
        : Promise.resolve([]),
      wallet
        ? db.select({ amount: walletLedger.amount }).from(walletLedger).where(and(eq(walletLedger.walletId, wallet.id), eq(walletLedger.entryType, "DIRECT_ADMISSION_INCOME")))
        : Promise.resolve([])
    ]);

    const main = accountRows.find((row) => row.account.isMainAccount)?.account ?? accountRows[0]?.account;
    const activeByNumber = new Map(accountRows.map((row) => [row.account.numericPart, row.account]));
    const slots = main ? Array.from({ length: 7 }, (_, index) => {
      const numericPart = main.numericPart + index;
      const active = activeByNumber.get(numericPart);
      return {
        position: index + 1,
        numericPart,
        number: active ? `${active.prefix}${numericPart}` : `CN${numericPart}`,
        status: active?.status ?? "RESERVED_SLOT",
        isMain: index === 0,
        accountId: active?.id ?? null
      };
    }) : [];
    const accountSummaries = accountRows.map(({ account, balance }) => {
      const accountIncome = entries.filter((entry) => entry.accountId === account.id)
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const left = balance?.leftAvailable ?? 0;
      const right = balance?.rightAvailable ?? 0;
      return {
        id: account.id,
        number: `${account.prefix}${account.numericPart}`,
        status: account.status,
        isMain: account.isMainAccount,
        leftAvailable: left,
        rightAvailable: right,
        lifetimeLeft: balance?.lifetimeLeft ?? 0,
        lifetimeRight: balance?.lifetimeRight ?? 0,
        stageOneAchieved: balance?.stageOneAchieved ?? false,
        stageTwoAchieved: balance?.stageTwoAchieved ?? false,
        nextStage: !(balance?.stageOneAchieved) ? "1:1" : !(balance?.stageTwoAchieved) ? "2:2" : "3:3",
        nextPayout: !(balance?.stageOneAchieved) ? 2500 : !(balance?.stageTwoAchieved) ? 5000 : 8000,
        income: accountIncome
      };
    });

    const directIncome = directEntries.reduce((sum, item) => sum + Number(item.amount), 0);
    const earningRows = ledger.filter((item) => ["DIRECT_ADMISSION_INCOME", "COMMISSION_PENDING"].includes(item.entryType) && Number(item.amount) > 0);
    response.json({
      mainAccountNumber: main ? `${main.prefix}${main.numericPart}` : null,
      totalIncome: entries.reduce((sum, entry) => sum + Number(entry.amount), 0) + directIncome,
      directIncome,
      totalPaid: payouts.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.amount), 0),
      upcomingIncome: Number(wallet?.pendingBalance ?? 0),
      availableBalance: Number(wallet?.availableBalance ?? 0),
      directStudents: new Set(placements.map((item) => item.accountId)).size,
      leftPoints: accountSummaries.reduce((sum, item) => sum + item.leftAvailable, 0),
      rightPoints: accountSummaries.reduce((sum, item) => sum + item.rightAvailable, 0),
      accounts: accountSummaries,
      slots,
      recentLedger: ledger.slice(0, 20),
      earningChart: {
        daily: earningTrend(earningRows, "daily"),
        weekly: earningTrend(earningRows, "weekly"),
        monthly: earningTrend(earningRows, "monthly")
      }
    });
  })
);

consultantRouter.get("/consultant/service-accounts", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant"]);
  const db = requireDatabase();
  const rows = await db.select({ account: networkAccounts, balance: accountPointBalances })
    .from(networkAccounts)
    .leftJoin(accountPointBalances, eq(accountPointBalances.accountId, networkAccounts.id))
    .where(and(eq(networkAccounts.ownerUserId, user.id), eq(networkAccounts.prefix, "CN")))
    .orderBy(desc(networkAccounts.isMainAccount), networkAccounts.numericPart);
  const accountIds = rows.map((row) => row.account.id);
  const entries = accountIds.length ? await db.select({ entry: commissionEntries, cycle: commissionCycles })
    .from(commissionEntries)
    .innerJoin(commissionCycles, eq(commissionEntries.cycleId, commissionCycles.id))
    .where(inArray(commissionEntries.accountId, accountIds))
    .orderBy(desc(commissionCycles.periodEnd), desc(commissionEntries.createdAt)) : [];
  const [allAccounts, pointRows] = await Promise.all([
    db.select().from(networkAccounts),
    accountIds.length ? db.select({ event: pointEvents, payment: paymentRequests, studentName: users.displayName, studentEmail: users.email, studentPhone: users.phone })
      .from(pointEvents)
      .innerJoin(paymentRequests, eq(paymentRequests.id, pointEvents.sourcePaymentId))
      .innerJoin(users, eq(users.id, paymentRequests.userId))
      .where(inArray(pointEvents.beneficiaryAccountId, accountIds))
      .orderBy(desc(pointEvents.createdAt)) : []
  ]);
  const accountById = new Map(allAccounts.map((item) => [item.id, item]));
  const studentMainByUser = new Map(allAccounts.filter((item) => item.isMainAccount).map((item) => [item.ownerUserId, item]));
  const groupedActivity = new Map<string, Record<string, any>>();
  for (const row of pointRows) {
    const key = `${row.payment.id}:${row.event.side}`;
    const beneficiary = accountById.get(row.event.beneficiaryAccountId);
    const beneficiaryNumber = beneficiary ? `${beneficiary.prefix}${beneficiary.numericPart}` : "Unknown";
    const existing = groupedActivity.get(key);
    if (existing) {
      existing.beneficiaryAccountIds.push(row.event.beneficiaryAccountId);
      existing.beneficiaryAccountNumbers.push(beneficiaryNumber);
      existing.pointCount += row.event.points;
      continue;
    }
    const studentAccount = studentMainByUser.get(row.payment.userId);
    groupedActivity.set(key, {
      id: key,
      beneficiaryAccountIds: [row.event.beneficiaryAccountId],
      beneficiaryAccountNumbers: [beneficiaryNumber],
      side: row.event.side,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      studentPhone: row.studentPhone,
      studentAccountNumber: studentAccount ? `${studentAccount.prefix}${studentAccount.numericPart}` : null,
      paymentCode: row.payment.paymentCode,
      paidAmount: Number(row.payment.paidAmount),
      totalAmount: Number(row.payment.totalAmount),
      paymentType: "FULL",
      paymentStatus: row.payment.status,
      pointAwarded: true,
      pointCount: row.event.points,
      createdAt: row.event.createdAt
    });
  }
  const activity = [...groupedActivity.values()];
  response.json({
    accounts: rows.map(({ account, balance }, index) => {
      const latest = entries.find((row) => row.entry.accountId === account.id);
      const metadata = (latest?.entry.metadata ?? {}) as Record<string, unknown>;
      const leftBefore = Number(metadata.leftBefore ?? 0);
      const rightBefore = Number(metadata.rightBefore ?? 0);
      const matchedPairs = latest?.entry.matchedPairs ?? 0;
      return {
        id: account.id,
        position: index + 1,
        number: `${account.prefix}${account.numericPart}`,
        username: user.name.split(/\s+/)[0] || user.name,
        status: account.status,
        leftPoints: balance?.leftAvailable ?? 0,
        rightPoints: balance?.rightAvailable ?? 0,
        weeklyFlush: latest ? {
          cycleKey: latest.cycle.cycleKey,
          periodStart: latest.cycle.periodStart,
          periodEnd: latest.cycle.periodEnd,
          stage: latest.entry.stage,
          matchedPairs,
          leftBefore,
          rightBefore,
          leftFlushed: Math.min(leftBefore, matchedPairs),
          rightFlushed: Math.min(rightBefore, matchedPairs),
          amount: Number(latest.entry.amount)
        } : null
      };
    }), activity
  });
}));

const defaultActivationPrices: Record<string, number> = { "2": 20000, "3": 20000, "4": 15000, "5": 15000, "6": 15000, "7": 15000 };
const activationPlacement: Record<number, { parentPosition: number; side: "LEFT" | "RIGHT" }> = {
  2: { parentPosition: 1, side: "LEFT" }, 3: { parentPosition: 1, side: "RIGHT" },
  4: { parentPosition: 2, side: "LEFT" }, 5: { parentPosition: 3, side: "RIGHT" },
  6: { parentPosition: 2, side: "RIGHT" }, 7: { parentPosition: 3, side: "LEFT" }
};
const activationRequestInput = z.object({
  slotPosition: z.coerce.number().int().min(2).max(7),
  activationMode: z.enum(["FULL", "TRIAL"]),
  parentAccountId: z.string().uuid(),
  side: z.enum(["LEFT", "RIGHT"]),
  amount: z.coerce.number().positive(),
  transactionReference: z.string().trim().min(3).max(150),
  seniorConsultantName: z.string().trim().max(150).optional()
});
const activationReviewInput = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(1000).optional() });
const activationProofTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

async function activationConfiguration(db: ReturnType<typeof requireDatabase>) {
  const settings = await db.select().from(systemSettings).where(inArray(systemSettings.key, ["CCO_BANK_DETAILS", "CCO_ACCOUNT_PRICES"]));
  const byKey = new Map(settings.map((item) => [item.key, item.value]));
  return {
    bankDetails: (byKey.get("CCO_BANK_DETAILS") ?? null) as null | { bankName?: string; branchName?: string; accountHolderName?: string; accountNumber?: string },
    prices: { ...defaultActivationPrices, ...((byKey.get("CCO_ACCOUNT_PRICES") ?? {}) as Record<string, number>) }
  };
}

async function expireTrialAccounts(db: ReturnType<typeof requireDatabase>) {
  const expired = await db.select({ requestId: ccoActivationRequests.id, accountId: ccoActivationRequests.activatedAccountId }).from(ccoActivationRequests).where(and(eq(ccoActivationRequests.activationMode, "TRIAL"), eq(ccoActivationRequests.status, "APPROVED"), lte(ccoActivationRequests.trialExpiresAt, new Date())));
  for (const item of expired) {
    if (item.accountId) await db.update(networkAccounts).set({ status: "SUSPENDED" }).where(eq(networkAccounts.id, item.accountId));
    await db.update(ccoActivationRequests).set({ status: "EXPIRED", updatedAt: new Date() }).where(eq(ccoActivationRequests.id, item.requestId));
  }
}

consultantRouter.get("/consultant/cco-activation-config", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  await expireTrialAccounts(db);
  const [consultantProfile] = await db.select({ name: users.displayName, phone: users.phone }).from(users).where(eq(users.id, consultant.id)).limit(1);
  const accounts = await db.select().from(networkAccounts).where(and(eq(networkAccounts.ownerUserId, consultant.id), eq(networkAccounts.prefix, "CN"))).orderBy(desc(networkAccounts.isMainAccount));
  const main = accounts.find((item) => item.isMainAccount) ?? accounts[0];
  const config = await activationConfiguration(db);
  const pendingRequests = await db.select({ numericPart: ccoActivationRequests.requestedNumericPart }).from(ccoActivationRequests).where(and(eq(ccoActivationRequests.consultantUserId, consultant.id), eq(ccoActivationRequests.status, "PENDING")));
  const pendingNumbers = new Set(pendingRequests.map((item) => item.numericPart));
  const activeTrials = await db.select({ numericPart: ccoActivationRequests.requestedNumericPart, expiresAt: ccoActivationRequests.trialExpiresAt }).from(ccoActivationRequests).where(and(eq(ccoActivationRequests.consultantUserId, consultant.id), eq(ccoActivationRequests.activationMode, "TRIAL"), eq(ccoActivationRequests.status, "APPROVED")));
  const trialByNumber = new Map(activeTrials.map((item) => [item.numericPart, item.expiresAt]));
  const firstMissingPosition = main && !activeTrials.length ? Array.from({ length: 6 }, (_, index) => index + 2).find((position) => !accounts.some((item) => item.numericPart === main.numericPart + position - 1 && item.status === "ACTIVE")) ?? null : null;
  response.json({
    ...config,
    consultant: { name: consultantProfile?.name ?? consultant.name, phone: consultantProfile?.phone ?? null, mainAccountNumber: main ? `CN${main.numericPart}` : null },
    activeAccounts: accounts.filter((item) => item.status === "ACTIVE").map((item) => ({ id: item.id, number: `CN${item.numericPart}` })),
    slots: main ? Array.from({ length: 6 }, (_, index) => {
      const position = index + 2; const numericPart = main.numericPart + index + 1; const active = accounts.find((item) => item.numericPart === numericPart); const placement = activationPlacement[position];
      const parentNumericPart = main.numericPart + placement.parentPosition - 1; const parent = accounts.find((item) => item.numericPart === parentNumericPart && item.status === "ACTIVE");
      const trialExpiry = trialByNumber.get(numericPart); const purchaseState = trialExpiry ? "TRIAL_ACTIVE" : active?.status === "ACTIVE" ? "ACTIVE" : pendingNumbers.has(numericPart) ? "PENDING" : position === firstMissingPosition ? "AVAILABLE" : "LOCKED";
      return { position, numericPart, number: `CN${numericPart}`, status: active?.status ?? "RESERVED", purchaseState, price: Number(config.prices[String(position)] ?? 0), trialPrice: 5000, trialExpiresAt: trialExpiry ?? null, parentAccountId: parent?.id ?? null, parentAccountNumber: `CN${parentNumericPart}`, side: placement.side };
    }) : []
  });
}));

consultantRouter.get("/consultant/cco-activations", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase();
  const rows = await db.select().from(ccoActivationRequests).where(eq(ccoActivationRequests.consultantUserId, consultant.id)).orderBy(desc(ccoActivationRequests.createdAt));
  response.json({ requests: rows.map(({ proofObjectKey, ...item }) => ({ ...item, hasProof: Boolean(proofObjectKey) })) });
}));

consultantRouter.post("/consultant/cco-activations", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const input = activationRequestInput.parse(request.body); const db = requireDatabase();
  await expireTrialAccounts(db); const config = await activationConfiguration(db); const expected = input.activationMode === "TRIAL" ? 5000 : Number(config.prices[String(input.slotPosition)] ?? 0);
  if (!config.bankDetails?.accountNumber) throw new HttpError(409, "Adil Academy bank details Admin විසින් තවම configure කර නැහැ.");
  if (input.amount !== expected) throw new HttpError(400, `Account ${input.slotPosition} activation amount එක Rs. ${expected.toLocaleString()} විය යුතුයි.`);
  const accounts = await db.select().from(networkAccounts).where(and(eq(networkAccounts.ownerUserId, consultant.id), eq(networkAccounts.prefix, "CN")));
  const main = accounts.find((item) => item.isMainAccount) ?? accounts[0]; if (!main) throw new HttpError(409, "Main CN account එක හමු නොවීය.");
  const [runningTrial] = await db.select({ id: ccoActivationRequests.id }).from(ccoActivationRequests).where(and(eq(ccoActivationRequests.consultantUserId, consultant.id), eq(ccoActivationRequests.activationMode, "TRIAL"), eq(ccoActivationRequests.status, "APPROVED"))).limit(1);
  if (runningTrial) throw new HttpError(409, "දැනට active trial account එක අවසන් වනතුරු වෙනත් account එකක් මිලදීගත නොහැක.");
  const nextPosition = Array.from({ length: 6 }, (_, index) => index + 2).find((position) => !accounts.some((item) => item.numericPart === main.numericPart + position - 1 && item.status === "ACTIVE"));
  if (input.slotPosition !== nextPosition) throw new HttpError(409, nextPosition ? `මුලින් CN${main.numericPart + nextPosition - 1} (${nextPosition}th account) activate කරන්න.` : "සියලු CCO accounts දැනටමත් active.");
  const numericPart = main.numericPart + input.slotPosition - 1;
  if (accounts.some((item) => item.numericPart === numericPart && item.status === "ACTIVE")) throw new HttpError(409, `CN${numericPart} දැනටමත් active.`);
  const placement = activationPlacement[input.slotPosition]; const expectedParentNumber = main.numericPart + placement.parentPosition - 1;
  const parent = accounts.find((item) => item.status === "ACTIVE" && item.numericPart === expectedParentNumber); if (!parent) throw new HttpError(409, `Required parent CN${expectedParentNumber} තවම active නැහැ.`);
  if (input.parentAccountId !== parent.id || input.side !== placement.side) throw new HttpError(400, `CN${numericPart} placement එක CN${expectedParentNumber} ${placement.side} විය යුතුයි.`);
  const [occupied] = await db.select({ id: networkPlacements.id }).from(networkPlacements).where(and(eq(networkPlacements.parentAccountId, parent.id), eq(networkPlacements.side, input.side), eq(networkPlacements.placementKind, "CCO"))).limit(1);
  if (occupied) throw new HttpError(409, `${parent.prefix}${parent.numericPart} ${input.side} position එක දැනටමත් භාවිත කර ඇත.`);
  const [pending] = await db.select({ id: ccoActivationRequests.id }).from(ccoActivationRequests).where(and(eq(ccoActivationRequests.consultantUserId, consultant.id), eq(ccoActivationRequests.requestedNumericPart, numericPart), eq(ccoActivationRequests.status, "PENDING"))).limit(1);
  if (pending) throw new HttpError(409, `CN${numericPart} සඳහා pending request එකක් දැනටමත් ඇත.`);
  const [created] = await db.insert(ccoActivationRequests).values({ consultantUserId: consultant.id, slotPosition: input.slotPosition, requestedNumericPart: numericPart, parentAccountId: parent.id, side: input.side, activationMode: input.activationMode, amount: input.amount.toFixed(2), transactionReference: input.transactionReference, seniorConsultantName: input.seniorConsultantName }).returning();
  response.status(201).json({ request: created, message: "Request saved. දැන් payment slip එක upload කරන්න." });
}));

consultantRouter.put("/consultant/cco-activations/:id/proof", express.raw({ type: ["image/jpeg", "image/png", "image/webp", "application/pdf"], limit: "10mb" }), asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]); const db = requireDatabase(); const id = z.string().uuid().parse(request.params.id); const mime = String(request.headers["content-type"] ?? "").split(";")[0];
  const extension = activationProofTypes[mime]; if (!extension || !Buffer.isBuffer(request.body) || !request.body.length) throw new HttpError(400, "JPG, PNG, WEBP හෝ PDF slip එකක් upload කරන්න.");
  const [item] = await db.select().from(ccoActivationRequests).where(and(eq(ccoActivationRequests.id, id), eq(ccoActivationRequests.consultantUserId, consultant.id), eq(ccoActivationRequests.status, "PENDING"))).limit(1); if (!item) throw new HttpError(404, "Pending activation request එක හමු නොවීය.");
  const objectKey = `cco-activation-proofs/${item.id}-${crypto.randomBytes(5).toString("hex")}.${extension}`; await uploadPrivateFile(objectKey, request.body);
  await db.update(ccoActivationRequests).set({ proofObjectKey: objectKey, proofMimeType: mime, updatedAt: new Date() }).where(eq(ccoActivationRequests.id, item.id));
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (admins.length) await db.insert(notifications).values(admins.map((admin) => ({ userId: admin.id, type: "CCO_ACTIVATION_REQUEST", title: "New CCO activation request", message: `${consultant.name} • CN${item.requestedNumericPart} • ${item.side} • Rs. ${Number(item.amount).toLocaleString()}` })));
  response.json({ message: "Payment slip submitted. Admin review notification sent." });
}));

consultantRouter.get("/admin/cco-activations", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]); const db = requireDatabase();
  const rows = await db.select({ request: ccoActivationRequests, consultantName: users.displayName, consultantEmail: users.email, consultantPhone: users.phone, parentPrefix: networkAccounts.prefix, parentNumericPart: networkAccounts.numericPart })
    .from(ccoActivationRequests).innerJoin(users, eq(users.id, ccoActivationRequests.consultantUserId)).innerJoin(networkAccounts, eq(networkAccounts.id, ccoActivationRequests.parentAccountId)).orderBy(desc(ccoActivationRequests.createdAt));
  response.json({ requests: rows.map(({ request: item, ...extra }) => { const { proofObjectKey, ...safe } = item; return { ...safe, ...extra, parentAccountNumber: `${extra.parentPrefix}${extra.parentNumericPart}`, hasProof: Boolean(proofObjectKey) }; }) });
}));

consultantRouter.get("/admin/cco-activations/:id/proof", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]); const db = requireDatabase(); const id = z.string().uuid().parse(request.params.id);
  const [item] = await db.select({ key: ccoActivationRequests.proofObjectKey, mime: ccoActivationRequests.proofMimeType }).from(ccoActivationRequests).where(eq(ccoActivationRequests.id, id)).limit(1); if (!item?.key) throw new HttpError(404, "Slip එක හමු නොවීය.");
  response.type(item.mime ?? "application/octet-stream").send(await downloadPrivateFile(item.key));
}));

consultantRouter.post("/admin/cco-activations/:id/review", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const input = activationReviewInput.parse(request.body); const db = requireDatabase(); const id = z.string().uuid().parse(request.params.id);
  const config = await activationConfiguration(db);
  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(ccoActivationRequests).where(eq(ccoActivationRequests.id, id)).limit(1); if (!item) throw new HttpError(404, "Activation request එක හමු නොවීය."); if (item.status !== "PENDING") throw new HttpError(409, "Request එක දැනටමත් review කර ඇත."); if (!item.proofObjectKey) throw new HttpError(400, "Payment slip එක අවශ්‍යයි.");
    if (input.status === "REJECTED") { await tx.update(ccoActivationRequests).set({ status: "REJECTED", reviewNote: input.note, reviewedBy: admin.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(ccoActivationRequests.id, item.id)); await tx.insert(notifications).values({ userId: item.consultantUserId, type: "CCO_ACTIVATION_REJECTED", title: "CCO activation request rejected", message: input.note || `CN${item.requestedNumericPart} request එක reject කර ඇත.` }); return { activated: false }; }
    const expected = item.activationMode === "TRIAL" ? 5000 : Number(config.prices[String(item.slotPosition)] ?? 0); if (Number(item.amount) !== expected) throw new HttpError(409, `Expected amount Rs. ${expected.toLocaleString()}.`);
    const ownedAccounts = await tx.select().from(networkAccounts).where(and(eq(networkAccounts.ownerUserId, item.consultantUserId), eq(networkAccounts.prefix, "CN")));
    const mainAccount = ownedAccounts.find((account) => account.isMainAccount) ?? ownedAccounts[0]; if (!mainAccount) throw new HttpError(409, "Main CN account එක හමු නොවීය.");
    const nextPosition = Array.from({ length: 6 }, (_, index) => index + 2).find((position) => !ownedAccounts.some((account) => account.numericPart === mainAccount.numericPart + position - 1 && account.status === "ACTIVE"));
    if (nextPosition !== item.slotPosition) throw new HttpError(409, nextPosition ? `මුලින් CN${mainAccount.numericPart + nextPosition - 1} activate කළ යුතුයි.` : "සියලු accounts active.");
    const fixedPlacement = activationPlacement[item.slotPosition]; const fixedParentNumber = mainAccount.numericPart + fixedPlacement.parentPosition - 1;
    if (item.side !== fixedPlacement.side) throw new HttpError(409, "Saved placement side එක fixed network plan එකට නොගැලපේ.");
    const [parent] = await tx.select().from(networkAccounts).where(and(eq(networkAccounts.id, item.parentAccountId), eq(networkAccounts.ownerUserId, item.consultantUserId), eq(networkAccounts.status, "ACTIVE"))).limit(1); if (!parent) throw new HttpError(409, "Parent CN account එක active නැහැ.");
    if (parent.numericPart !== fixedParentNumber) throw new HttpError(409, `Parent account එක CN${fixedParentNumber} විය යුතුයි.`);
    const [existing] = await tx.select().from(networkAccounts).where(and(eq(networkAccounts.prefix, "CN"), eq(networkAccounts.numericPart, item.requestedNumericPart))).limit(1);
    if (existing && (existing.ownerUserId !== item.consultantUserId || existing.status !== "SUSPENDED")) throw new HttpError(409, `CN${item.requestedNumericPart} දැනටමත් පවතී.`);
    const [occupied] = await tx.select({ accountId: networkPlacements.accountId }).from(networkPlacements).where(and(eq(networkPlacements.parentAccountId, parent.id), eq(networkPlacements.side, item.side), eq(networkPlacements.placementKind, "CCO"))).limit(1); if (occupied && occupied.accountId !== existing?.id) throw new HttpError(409, `${parent.prefix}${parent.numericPart} ${item.side} CCO position එක වෙනත් account එකක් භාවිත කරයි.`);
    const account = existing ? (await tx.update(networkAccounts).set({ status: "ACTIVE", activatedAt: new Date() }).where(eq(networkAccounts.id, existing.id)).returning())[0] : (await tx.insert(networkAccounts).values({ ownerUserId: item.consultantUserId, prefix: "CN", numericPart: item.requestedNumericPart, status: "ACTIVE", isMainAccount: false, activatedAt: new Date() }).returning())[0];
    if (!occupied) await tx.insert(networkPlacements).values({ accountId: account.id, parentAccountId: parent.id, side: item.side, placementKind: "CCO", placedByUserId: admin.id }); await tx.insert(accountPointBalances).values({ accountId: account.id }).onConflictDoNothing({ target: accountPointBalances.accountId });
    const trialExpiresAt = item.activationMode === "TRIAL" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
    await tx.update(ccoActivationRequests).set({ status: "APPROVED", reviewNote: input.note, reviewedBy: admin.id, reviewedAt: new Date(), activatedAccountId: account.id, trialExpiresAt, updatedAt: new Date() }).where(eq(ccoActivationRequests.id, item.id));
    await tx.insert(notifications).values({ userId: item.consultantUserId, type: "CCO_ACTIVATION_APPROVED", title: `CN${item.requestedNumericPart} activated`, message: item.activationMode === "TRIAL" ? `30-day trial active. ${trialExpiresAt!.toLocaleDateString()} දින ස්වයංක්‍රීයව suspend වේ.` : `${parent.prefix}${parent.numericPart} ${item.side} යටතේ account එක සාර්ථකව active කර ඇත.` }); await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "CCO_ACCOUNT_ACTIVATED", entityType: "network_account", entityId: account.id, metadata: { requestId: item.id, activationMode: item.activationMode, amount: item.amount, transactionReference: item.transactionReference } }); return { activated: true, accountNumber: `CN${account.numericPart}` };
  });
  response.json({ ...result, message: result.activated ? `${result.accountNumber} successfully activated.` : "Request rejected." });
}));

consultantRouter.get("/admin/cco-activation-config", asyncRoute(async (request, response) => { await requireRole(request, ["admin"]); response.json(await activationConfiguration(requireDatabase())); }));
consultantRouter.put("/admin/cco-activation-config", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const input = z.object({ bankDetails: z.object({ bankName: z.string().trim().min(2), branchName: z.string().trim().min(2), accountHolderName: z.string().trim().min(2), accountNumber: z.string().trim().min(5) }), prices: z.record(z.string(), z.coerce.number().positive()) }).parse(request.body); const db = requireDatabase();
  await db.transaction(async (tx) => { for (const [key, value] of [["CCO_BANK_DETAILS", input.bankDetails], ["CCO_ACCOUNT_PRICES", input.prices]] as const) await tx.insert(systemSettings).values({ key, value, updatedBy: admin.id }).onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedBy: admin.id, updatedAt: new Date() } }); }); response.json({ message: "CCO bank details and prices saved." });
}));

const applicationInput = z.object({
  motivation: z.string().trim().min(10).max(3000)
});

const reviewInput = z.object({
  status: z.enum(["INTERVIEW", "APPROVED", "REJECTED"]),
  interviewNote: z.string().trim().max(3000).optional()
});

consultantRouter.post(
  "/consultant-applications",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    if (user.role !== "student") {
      throw new HttpError(409, "Only students can apply to become consultants.");
    }
    const input = applicationInput.parse(request.body);
    const db = requireDatabase();
    const [existing] = await db
      .select()
      .from(consultantApplications)
      .where(
        and(
          eq(consultantApplications.userId, user.id),
          inArray(consultantApplications.status, ["PENDING", "INTERVIEW"])
        )
      )
      .limit(1);
    if (existing) {
      throw new HttpError(409, "A consultant application is already active.");
    }
    const [created] = await db
      .insert(consultantApplications)
      .values({ userId: user.id, motivation: input.motivation })
      .returning();
    response.status(201).json({ application: created });
  })
);

consultantRouter.get(
  "/consultant-applications/me",
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request);
    const db = requireDatabase();
    const [application] = await db
      .select()
      .from(consultantApplications)
      .where(eq(consultantApplications.userId, user.id))
      .orderBy(desc(consultantApplications.createdAt))
      .limit(1);
    response.json({ application: application ?? null });
  })
);

consultantRouter.get(
  "/admin/consultant-applications",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const applications = await db
      .select({
        application: consultantApplications,
        student: {
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          phone: users.phone
        }
      })
      .from(consultantApplications)
      .innerJoin(users, eq(consultantApplications.userId, users.id))
      .orderBy(desc(consultantApplications.createdAt));
    response.json({ applications });
  })
);

consultantRouter.post(
  "/admin/consultant-applications/:id/review",
  asyncRoute(async (request, response) => {
    const reviewer = await requireRole(request, ["staff", "admin"]);
    const input = reviewInput.parse(request.body);
    if (input.status === "APPROVED" && reviewer.role !== "admin") {
      throw new HttpError(403, "Super Admin approval is required.");
    }
    const db = requireDatabase();
    const result = await db.transaction(async (tx) => {
      const [application] = await tx
        .select()
        .from(consultantApplications)
        .where(eq(consultantApplications.id, String(request.params.id)))
        .limit(1);
      if (!application) {
        throw new HttpError(404, "Consultant application not found.");
      }
      if (["APPROVED", "REJECTED"].includes(application.status)) {
        throw new HttpError(409, "Application is already finalized.");
      }

      const [updated] = await tx
        .update(consultantApplications)
        .set({
          status: input.status,
          interviewNote: input.interviewNote,
          reviewedBy: reviewer.id,
          reviewedAt: new Date()
        })
        .where(eq(consultantApplications.id, application.id))
        .returning();

      let mainAccount = null;
      if (input.status === "APPROVED") {
        [mainAccount] = await tx
          .select()
          .from(networkAccounts)
          .where(
            and(
              eq(networkAccounts.ownerUserId, application.userId),
              eq(networkAccounts.isMainAccount, true),
              eq(networkAccounts.status, "ACTIVE")
            )
          )
          .limit(1);
        if (!mainAccount) {
          throw new HttpError(
            409,
            "An active paid SR account is required before consultant approval."
          );
        }
        if (mainAccount.prefix === "SR") {
          [mainAccount] = await tx
            .update(networkAccounts)
            .set({ prefix: "CN" })
            .where(eq(networkAccounts.id, mainAccount.id))
            .returning();
        }
        await tx
          .update(users)
          .set({ role: "consultant", updatedAt: new Date() })
          .where(eq(users.id, application.userId));
        await tx
          .insert(wallets)
          .values({ userId: application.userId })
          .onConflictDoNothing({ target: wallets.userId });
      }

      await tx.insert(notifications).values({
        userId: application.userId,
        type: "CONSULTANT_APPLICATION_" + input.status,
        title:
          input.status === "APPROVED"
            ? "Consultant account approved"
            : "Consultant application updated",
        message:
          input.status === "APPROVED"
            ? "Your SR main account is now an active CN consultant account."
            : "Your consultant application status is now " + input.status + "."
      });
      await tx.insert(auditLogs).values({
        actorUserId: reviewer.id,
        action: "CONSULTANT_APPLICATION_" + input.status,
        entityType: "consultant_application",
        entityId: application.id,
        metadata: {
          userId: application.userId,
          accountId: mainAccount?.id ?? null
        }
      });
      return { application: updated, account: mainAccount };
    });
    response.json(result);
  })
);

consultantRouter.get(
  "/consultant/accounts",
  asyncRoute(async (request, response) => {
    const user = await requireRole(request, ["consultant", "admin"]);
    const db = requireDatabase();
    const accounts = await db
      .select({
        account: networkAccounts,
        balance: accountPointBalances
      })
      .from(networkAccounts)
      .leftJoin(
        accountPointBalances,
        eq(accountPointBalances.accountId, networkAccounts.id)
      )
      .where(eq(networkAccounts.ownerUserId, user.id))
      .orderBy(desc(networkAccounts.isMainAccount));
    response.json({ accounts, maxAccounts: 7 });
  })
);

consultantRouter.get(
  "/consultant/network",
  asyncRoute(async (request, response) => {
    const user = await requireRole(request, ["consultant", "admin"]);
    const db = requireDatabase();
    const owned = await db
      .select()
      .from(networkAccounts)
      .where(eq(networkAccounts.ownerUserId, user.id));
    if (owned.length === 0) {
      response.json({ roots: [], accounts: [], placements: [] });
      return;
    }

    const allAccounts = await db.select().from(networkAccounts);
    const allPlacements = await db.select().from(networkPlacements);
    const accountMap = new Map(
      allAccounts.map((account) => [account.id, account])
    );
    const children = new Map<
      string,
      { side: "LEFT" | "RIGHT"; accountId: string }[]
    >();
    for (const placement of allPlacements) {
      const list = children.get(placement.parentAccountId) ?? [];
      list.push({ side: placement.side, accountId: placement.accountId });
      children.set(placement.parentAccountId, list);
    }

    const visibleIds = new Set<string>();
    const queue = owned.map((account) => account.id);
    while (queue.length && visibleIds.size < 2000) {
      const current = queue.shift()!;
      if (visibleIds.has(current)) continue;
      visibleIds.add(current);
      for (const child of children.get(current) ?? []) {
        queue.push(child.accountId);
      }
    }

    response.json({
      roots: owned.map((account) => account.id),
      accounts: [...visibleIds]
        .map((id) => accountMap.get(id))
        .filter(Boolean),
      placements: allPlacements.filter(
        (placement) =>
          visibleIds.has(placement.accountId) &&
          visibleIds.has(placement.parentAccountId)
      )
    });
  })
);

import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import {
  accountPointBalances,
  auditLogs,
  commissionCycles,
  commissionEntries,
  consultantBankDetails,
  networkAccounts,
  notifications,
  payoutRequests,
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
import { calculateCommissionCycle } from "./service";
import { nextFridaySettlement } from "./scheduler";
import { decryptBankAccount } from "../../services/bank-details";

export const commissionRouter = Router();

const calculateInput = z.object({
  cycleKey: z.string().trim().min(4).max(40),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date()
});

const payoutInput = z.object({
  amount: z.coerce.number().positive(),
  payoutMethod: z.enum(["BANK_TRANSFER", "USDT"]),
  payoutDetails: z.record(z.string(), z.string().max(300))
});

const payoutReviewInput = z.object({
  status: z.enum(["APPROVED", "PAID", "REJECTED"])
});
const fridayBatchInput = z.object({ batchKey: z.string().trim().regex(/^\d{4}-W\d{2}$/) });

commissionRouter.get("/consultant/income-summary", asyncRoute(async (request, response) => {
  const consultant = await requireRole(request, ["consultant"]);
  const db = requireDatabase();
  const [wallet] = await db.select().from(wallets)
    .where(eq(wallets.userId, consultant.id)).limit(1);

  if (!wallet) {
    response.json({
      availableBalance: 0,
      pendingBalance: 0,
      directIncome: 0,
      serviceIncome: 0,
      totalIncome: 0,
      lastPayout: null,
      nextSettlementAt: nextFridaySettlement().toISOString(),
      ledger: []
    });
    return;
  }

  const [ledger, paidPayouts] = await Promise.all([
    db.select().from(walletLedger).where(eq(walletLedger.walletId, wallet.id))
      .orderBy(desc(walletLedger.createdAt)).limit(50),
    db.select().from(payoutRequests).where(and(
      eq(payoutRequests.walletId, wallet.id),
      eq(payoutRequests.status, "PAID")
    )).orderBy(desc(payoutRequests.paidAt)).limit(1)
  ]);
  const directIncome = ledger
    .filter((item) => item.entryType === "DIRECT_ADMISSION_INCOME")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const serviceIncome = ledger
    .filter((item) => item.entryType === "COMMISSION_PENDING")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const lastPayout = paidPayouts[0];

  response.json({
    availableBalance: Number(wallet.availableBalance),
    pendingBalance: Number(wallet.pendingBalance),
    directIncome,
    serviceIncome,
    totalIncome: directIncome + serviceIncome,
    lastPayout: lastPayout ? {
      amount: Number(lastPayout.amount),
      paidAt: lastPayout.paidAt?.toISOString() ?? null
    } : null,
    nextSettlementAt: nextFridaySettlement().toISOString(),
    ledger: ledger.slice(0, 25).map((item) => ({
      id: item.id,
      entryType: item.entryType,
      amount: Number(item.amount),
      note: item.note,
      createdAt: item.createdAt.toISOString()
    }))
  });
}));

commissionRouter.get("/admin/consultant-payout-summary", asyncRoute(async (request, response) => {
  await requireRole(request, ["admin"]);
  const db = requireDatabase();
  const consultants = await db.select({ id: users.id, name: users.displayName, email: users.email }).from(users).where(eq(users.role, "consultant"));
  const rows = await Promise.all(consultants.map(async (consultant) => {
    const accounts = await db.select({ id: networkAccounts.id, prefix: networkAccounts.prefix, numericPart: networkAccounts.numericPart }).from(networkAccounts).where(eq(networkAccounts.ownerUserId, consultant.id));
    const accountIds = accounts.map((item) => item.id);
    const [[wallet], [bank], serviceEntries] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, consultant.id)).limit(1),
      db.select({ bankName: consultantBankDetails.bankName, accountNumberLast4: consultantBankDetails.accountNumberLast4 }).from(consultantBankDetails).where(eq(consultantBankDetails.userId, consultant.id)).limit(1),
      accountIds.length ? db.select({ amount: commissionEntries.amount }).from(commissionEntries).where(inArray(commissionEntries.accountId, accountIds)) : Promise.resolve([])
    ]);
    const directEntries = wallet ? await db.select({ amount: walletLedger.amount }).from(walletLedger).where(and(eq(walletLedger.walletId, wallet.id), eq(walletLedger.entryType, "DIRECT_ADMISSION_INCOME"))) : [];
    const directIncome = directEntries.reduce((sum, item) => sum + Number(item.amount), 0);
    const serviceGroupIncome = serviceEntries.reduce((sum, item) => sum + Number(item.amount), 0);
    const [fullBank] = await db.select().from(consultantBankDetails).where(eq(consultantBankDetails.userId, consultant.id)).limit(1);
    return { ...consultant, accounts: accounts.map((item) => `${item.prefix}${item.numericPart}`), directIncome, serviceGroupIncome, totalIncome: directIncome + serviceGroupIncome, pendingBalance: Number(wallet?.pendingBalance ?? 0), availableBalance: Number(wallet?.availableBalance ?? 0), fridayPayable: Number(wallet?.pendingBalance ?? 0) + Number(wallet?.availableBalance ?? 0), bankDetailsReady: Boolean(bank), bankSummary: bank ? `${bank.bankName} ••••${bank.accountNumberLast4}` : null, bankDetails: fullBank ? { bankName: fullBank.bankName, branchName: fullBank.branchName, accountHolderName: fullBank.accountHolderName, accountNumber: decryptBankAccount(fullBank.accountNumberEncrypted) } : null };
  }));
  rows.sort((a, b) => b.totalIncome - a.totalIncome);
  const [reminderSetting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, "friday-payout-current")).limit(1);
  response.json({ consultants: rows, totalFridayPayable: rows.reduce((sum, item) => sum + item.fridayPayable, 0), totalIncome: rows.reduce((sum, item) => sum + item.totalIncome, 0), payoutReminder: reminderSetting?.value ?? null });
}));

commissionRouter.post("/admin/consultants/:userId/pay-and-clear", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const consultantUserId = z.string().uuid().parse(request.params.userId);
  const db = requireDatabase();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select({ wallet: wallets, user: users, bank: consultantBankDetails }).from(wallets)
      .innerJoin(users, eq(users.id, wallets.userId))
      .leftJoin(consultantBankDetails, eq(consultantBankDetails.userId, users.id))
      .where(and(eq(wallets.userId, consultantUserId), eq(users.role, "consultant"))).limit(1);
    if (!row) throw new HttpError(404, "Consultant wallet එක හමු නොවීය.");
    if (!row.bank) throw new HttpError(400, "Consultant bank details තවම add කර නැහැ.");
    const amount = Number(row.wallet.availableBalance) + Number(row.wallet.pendingBalance);
    if (amount <= 0) throw new HttpError(409, "Clear කිරීමට payable balance එකක් නැහැ.");
    const now = new Date();
    const [payout] = await tx.insert(payoutRequests).values({
      walletId: row.wallet.id,
      amount: amount.toFixed(2),
      status: "PAID",
      payoutMethod: "BANK_TRANSFER",
      payoutDetails: { paidManually: true, bankName: row.bank.bankName, accountNumberLast4: row.bank.accountNumberLast4 },
      reviewedBy: admin.id,
      reviewedAt: now,
      paidAt: now
    }).returning();
    await tx.update(wallets).set({ availableBalance: "0.00", pendingBalance: "0.00", updatedAt: now }).where(eq(wallets.id, row.wallet.id));
    await tx.insert(walletLedger).values({
      walletId: row.wallet.id,
      idempotencyKey: `manual-payout:${payout.id}`,
      entryType: "MANUAL_BANK_PAYOUT",
      amount: (-amount).toFixed(2),
      referenceType: "payout_request",
      referenceId: payout.id,
      note: `Paid manually by Admin to ${row.bank.bankName} ••••${row.bank.accountNumberLast4}`
    });
    await tx.insert(notifications).values({ userId: row.user.id, type: "PAYOUT_PAID", title: "Commission payment completed", message: `Rs. ${amount.toLocaleString()} bank transfer payment එක සම්පූර්ණ කර ඇත.` });
    await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "CONSULTANT_PAYOUT_PAID_AND_CLEARED", entityType: "payout_request", entityId: payout.id, metadata: { consultantUserId, amount, bankName: row.bank.bankName, accountNumberLast4: row.bank.accountNumberLast4 } });
    return { payoutId: payout.id, consultantName: row.user.displayName, amount };
  });
  const remaining = await db.select({ available: wallets.availableBalance, pending: wallets.pendingBalance }).from(wallets)
    .innerJoin(users, eq(users.id, wallets.userId)).where(eq(users.role, "consultant"));
  if (remaining.every((item) => Number(item.available) + Number(item.pending) <= 0)) {
    const [current] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, "friday-payout-current")).limit(1);
    const value = (current?.value ?? {}) as Record<string, unknown>;
    await db.insert(systemSettings).values({ key: "friday-payout-current", value: { ...value, completedAt: new Date().toISOString() }, updatedBy: admin.id })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: { ...value, completedAt: new Date().toISOString() }, updatedBy: admin.id, updatedAt: new Date() } });
  }
  response.json(result);
}));

commissionRouter.post("/admin/friday-payout-batches", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]);
  const { batchKey } = fridayBatchInput.parse(request.body);
  const db = requireDatabase();
  const result = await db.transaction(async (tx) => {
    const walletRows = await tx.select({ wallet: wallets, user: users, bank: consultantBankDetails }).from(wallets)
      .innerJoin(users, eq(users.id, wallets.userId)).leftJoin(consultantBankDetails, eq(consultantBankDetails.userId, users.id)).where(eq(users.role, "consultant"));
    let totalAmount = 0; let createdCount = 0; const skipped: string[] = [];
    for (const row of walletRows) {
      const amount = Number(row.wallet.availableBalance) + Number(row.wallet.pendingBalance);
      if (amount <= 0) continue;
      if (!row.bank) { skipped.push(`${row.user.displayName}: bank details missing`); continue; }
      const key = `friday-payout:${batchKey}:${row.user.id}`;
      const [existing] = await tx.select({ id: walletLedger.id }).from(walletLedger).where(eq(walletLedger.idempotencyKey, key)).limit(1);
      if (existing) { skipped.push(`${row.user.displayName}: already included`); continue; }
      const [payout] = await tx.insert(payoutRequests).values({ walletId: row.wallet.id, amount: amount.toFixed(2), payoutMethod: "BANK_TRANSFER", payoutDetails: { batchKey, bankDetailsOnFile: true } }).returning();
      await tx.update(wallets).set({ availableBalance: "0.00", pendingBalance: "0.00", updatedAt: new Date() }).where(eq(wallets.id, row.wallet.id));
      await tx.insert(walletLedger).values({ walletId: row.wallet.id, idempotencyKey: key, entryType: "FRIDAY_PAYOUT_RESERVED", amount: (-amount).toFixed(2), referenceType: "payout_request", referenceId: payout.id, note: `${batchKey} Friday batch` });
      await tx.insert(notifications).values({ userId: row.user.id, type: "FRIDAY_PAYOUT_CREATED", title: "Friday payout prepared", message: `Rs. ${amount.toLocaleString()} payout එක Admin විසින් සකස් කර ඇත.` });
      totalAmount += amount; createdCount += 1;
    }
    await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "FRIDAY_PAYOUT_BATCH_CREATED", entityType: "payout_batch", entityId: batchKey, metadata: { createdCount, totalAmount, skipped } });
    return { batchKey, createdCount, totalAmount, skipped };
  });
  response.status(201).json(result);
}));

commissionRouter.post("/admin/friday-payout-batches/:batchKey/mark-paid", asyncRoute(async (request, response) => {
  const admin = await requireRole(request, ["admin"]); const batchKey = fridayBatchInput.shape.batchKey.parse(request.params.batchKey); const db = requireDatabase();
  const all = await db.select().from(payoutRequests).where(inArray(payoutRequests.status, ["PENDING", "APPROVED"]));
  const matching = all.filter((item) => (item.payoutDetails as { batchKey?: string }).batchKey === batchKey);
  if (!matching.length) throw new HttpError(404, "Payout batch not found or already paid.");
  await db.transaction(async (tx) => { for (const payout of matching) await tx.update(payoutRequests).set({ status: "PAID", reviewedBy: admin.id, reviewedAt: new Date(), paidAt: new Date() }).where(eq(payoutRequests.id, payout.id)); await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "FRIDAY_PAYOUT_BATCH_PAID", entityType: "payout_batch", entityId: batchKey, metadata: { payoutCount: matching.length, totalAmount: matching.reduce((sum, item) => sum + Number(item.amount), 0) } }); });
  response.json({ batchKey, paidCount: matching.length, totalAmount: matching.reduce((sum, item) => sum + Number(item.amount), 0) });
}));

commissionRouter.post(
  "/admin/commission-cycles/calculate",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const input = calculateInput.parse(request.body);
    const result = await calculateCommissionCycle(input, admin.id);
    response.status(201).json(result);
  })
);

/* Legacy inline implementation removed: calculation lives in service.ts so
   the same transaction is safely used by both the admin API and Friday job. */
/*
    const db = requireDatabase();
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(commissionCycles)
        .where(eq(commissionCycles.cycleKey, input.cycleKey))
        .limit(1);
      if (existing) {
        throw new HttpError(409, "This commission cycle already exists.");
      }
      const [cycle] = await tx
        .insert(commissionCycles)
        .values({
          cycleKey: input.cycleKey,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: "CALCULATING"
        })
        .returning();

      const balances = await tx
        .select({
          balance: accountPointBalances,
          account: networkAccounts
        })
        .from(accountPointBalances)
        .innerJoin(
          networkAccounts,
          eq(accountPointBalances.accountId, networkAccounts.id)
        )
        .where(eq(networkAccounts.status, "ACTIVE"));

      let totalAmount = 0;
      let awardedAccounts = 0;
      for (const row of balances) {
        const calculation = calculateAccountCommission({
          leftAvailable: row.balance.leftAvailable,
          rightAvailable: row.balance.rightAvailable,
          stageOneAchieved: row.balance.stageOneAchieved,
          stageTwoAchieved: row.balance.stageTwoAchieved
        });
        if (calculation.awards.length === 0) continue;

        awardedAccounts += 1;
        const accountTotal = calculation.awards.reduce(
          (sum, award) => sum + award.amount,
          0
        );
        totalAmount += accountTotal;
        for (const award of calculation.awards) {
          await tx.insert(commissionEntries).values({
            cycleId: cycle.id,
            accountId: row.account.id,
            stage: award.stage,
            matchedPairs: award.pairs,
            amount: award.amount.toFixed(2),
            metadata: {
              leftBefore: row.balance.leftAvailable,
              rightBefore: row.balance.rightAvailable
            }
          });
        }

        await tx
          .update(accountPointBalances)
          .set({
            leftAvailable: calculation.leftRemaining,
            rightAvailable: calculation.rightRemaining,
            stageOneAchieved: calculation.stageOneAchieved,
            stageTwoAchieved: calculation.stageTwoAchieved,
            updatedAt: new Date()
          })
          .where(eq(accountPointBalances.id, row.balance.id));

        await tx
          .insert(wallets)
          .values({ userId: row.account.ownerUserId })
          .onConflictDoNothing({ target: wallets.userId });
        const [wallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, row.account.ownerUserId))
          .limit(1);
        const newPending =
          Number(wallet.pendingBalance) + Number(accountTotal);
        await tx
          .update(wallets)
          .set({
            pendingBalance: newPending.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(wallets.id, wallet.id));
        await tx.insert(walletLedger).values({
          walletId: wallet.id,
          idempotencyKey:
            "commission-pending:" + cycle.id + ":" + row.account.id,
          entryType: "COMMISSION_PENDING",
          amount: accountTotal.toFixed(2),
          referenceType: "commission_cycle",
          referenceId: cycle.id,
          note: "Commission calculated for " + row.account.prefix + row.account.numericPart
        });
      }

      const [updatedCycle] = await tx
        .update(commissionCycles)
        .set({ status: "CALCULATED", calculatedAt: new Date() })
        .where(eq(commissionCycles.id, cycle.id))
        .returning();
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "COMMISSION_CYCLE_CALCULATED",
        entityType: "commission_cycle",
        entityId: cycle.id,
        metadata: { awardedAccounts, totalAmount }
      });
      return { cycle: updatedCycle, awardedAccounts, totalAmount };
    });
    response.status(201).json(result);
  })
); */

commissionRouter.post(
  "/admin/commission-cycles/:id/approve",
  asyncRoute(async (request, response) => {
    const admin = await requireRole(request, ["admin"]);
    const db = requireDatabase();
    const cycleId = String(request.params.id);
    const result = await db.transaction(async (tx) => {
      const [cycle] = await tx
        .select()
        .from(commissionCycles)
        .where(eq(commissionCycles.id, cycleId))
        .limit(1);
      if (!cycle) throw new HttpError(404, "Commission cycle not found.");
      if (cycle.status !== "CALCULATED") {
        throw new HttpError(409, "Only a calculated cycle can be approved.");
      }

      const rows = await tx
        .select({
          accountId: commissionEntries.accountId,
          amount: commissionEntries.amount,
          ownerUserId: networkAccounts.ownerUserId
        })
        .from(commissionEntries)
        .innerJoin(
          networkAccounts,
          eq(commissionEntries.accountId, networkAccounts.id)
        )
        .where(eq(commissionEntries.cycleId, cycle.id));
      const totals = new Map<string, number>();
      for (const row of rows) {
        totals.set(
          row.ownerUserId,
          (totals.get(row.ownerUserId) ?? 0) + Number(row.amount)
        );
      }

      for (const [userId, amount] of totals) {
        const [wallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .limit(1);
        if (!wallet) throw new Error("Wallet missing for commission owner.");
        const pending = Number(wallet.pendingBalance);
        if (pending < amount) {
          throw new Error("Wallet pending balance is inconsistent.");
        }
        await tx
          .update(wallets)
          .set({
            pendingBalance: (pending - amount).toFixed(2),
            availableBalance: (
              Number(wallet.availableBalance) + amount
            ).toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(wallets.id, wallet.id));
        await tx.insert(walletLedger).values({
          walletId: wallet.id,
          idempotencyKey: "commission-release:" + cycle.id + ":" + userId,
          entryType: "COMMISSION_RELEASED",
          amount: amount.toFixed(2),
          referenceType: "commission_cycle",
          referenceId: cycle.id
        });
      }

      const [approved] = await tx
        .update(commissionCycles)
        .set({
          status: "APPROVED",
          approvedBy: admin.id,
          approvedAt: new Date()
        })
        .where(eq(commissionCycles.id, cycle.id))
        .returning();
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "COMMISSION_CYCLE_APPROVED",
        entityType: "commission_cycle",
        entityId: cycle.id,
        metadata: { consultantCount: totals.size }
      });
      return { cycle: approved, consultantCount: totals.size };
    });
    response.json(result);
  })
);

commissionRouter.get(
  "/admin/commission-cycles",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const cycles = await db
      .select()
      .from(commissionCycles)
      .orderBy(desc(commissionCycles.periodEnd));
    response.json({ cycles });
  })
);

commissionRouter.get(
  "/consultant/wallet",
  asyncRoute(async (request, response) => {
    const user = await requireRole(request, ["consultant", "admin"]);
    const db = requireDatabase();
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, user.id))
      .limit(1);
    if (!wallet) {
      response.json({ wallet: null, ledger: [], payouts: [] });
      return;
    }
    const ledger = await db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.walletId, wallet.id))
      .orderBy(desc(walletLedger.createdAt));
    const payouts = await db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.walletId, wallet.id))
      .orderBy(desc(payoutRequests.createdAt));
    response.json({ wallet, ledger, payouts });
  })
);

commissionRouter.post(
  "/consultant/payout-requests",
  asyncRoute(async (request, response) => {
    const user = await requireRole(request, ["consultant"]);
    const input = payoutInput.parse(request.body);
    const db = requireDatabase();
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, user.id))
        .limit(1);
      if (!wallet || Number(wallet.availableBalance) < input.amount) {
        throw new HttpError(400, "Available wallet balance is insufficient.");
      }
      const [payout] = await tx
        .insert(payoutRequests)
        .values({
          walletId: wallet.id,
          amount: input.amount.toFixed(2),
          payoutMethod: input.payoutMethod,
          payoutDetails: input.payoutDetails
        })
        .returning();
      await tx
        .update(wallets)
        .set({
          availableBalance: (
            Number(wallet.availableBalance) - input.amount
          ).toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));
      await tx.insert(walletLedger).values({
        walletId: wallet.id,
        idempotencyKey: "payout-reserve:" + payout.id,
        entryType: "PAYOUT_RESERVED",
        amount: (-input.amount).toFixed(2),
        referenceType: "payout_request",
        referenceId: payout.id
      });
      return payout;
    });
    response.status(201).json({ payout: result });
  })
);

commissionRouter.get(
  "/admin/payout-requests",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["staff", "admin"]);
    const db = requireDatabase();
    const payouts = await db
      .select()
      .from(payoutRequests)
      .orderBy(desc(payoutRequests.createdAt));
    response.json({ payouts });
  })
);

commissionRouter.post(
  "/admin/payout-requests/:id/review",
  asyncRoute(async (request, response) => {
    const reviewer = await requireRole(request, ["admin"]);
    const input = payoutReviewInput.parse(request.body);
    const db = requireDatabase();
    const result = await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.id, String(request.params.id)))
        .limit(1);
      if (!payout) throw new HttpError(404, "Payout request not found.");
      if (["PAID", "REJECTED"].includes(payout.status)) {
        throw new HttpError(409, "Payout request is already finalized.");
      }

      if (input.status === "REJECTED") {
        const [wallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.id, payout.walletId))
          .limit(1);
        await tx
          .update(wallets)
          .set({
            availableBalance: (
              Number(wallet.availableBalance) + Number(payout.amount)
            ).toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(wallets.id, wallet.id));
        await tx.insert(walletLedger).values({
          walletId: wallet.id,
          idempotencyKey: "payout-return:" + payout.id,
          entryType: "PAYOUT_RETURNED",
          amount: payout.amount,
          referenceType: "payout_request",
          referenceId: payout.id
        });
      }

      const [updated] = await tx
        .update(payoutRequests)
        .set({
          status: input.status,
          reviewedBy: reviewer.id,
          reviewedAt: new Date(),
          paidAt: input.status === "PAID" ? new Date() : null
        })
        .where(eq(payoutRequests.id, payout.id))
        .returning();
      await tx.insert(auditLogs).values({
        actorUserId: reviewer.id,
        action: "PAYOUT_" + input.status,
        entityType: "payout_request",
        entityId: payout.id,
        metadata: { amount: payout.amount }
      });
      return updated;
    });
    response.json({ payout: result });
  })
);

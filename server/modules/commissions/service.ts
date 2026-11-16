import { eq } from "drizzle-orm";
import { requireDatabase } from "../../../db/client";
import {
  accountPointBalances,
  auditLogs,
  commissionCycles,
  commissionEntries,
  networkAccounts,
  notifications,
  walletLedger,
  wallets
} from "../../../db/schema";
import { calculateAccountCommission } from "../../domain/commission";
import { HttpError } from "../../lib/auth";

export type CommissionCycleInput = {
  cycleKey: string;
  periodStart: Date;
  periodEnd: Date;
};

export async function calculateCommissionCycle(
  input: CommissionCycleInput,
  actorUserId: string | null
) {
  if (input.periodEnd <= input.periodStart) {
    throw new HttpError(400, "Commission period is invalid.");
  }
  const db = requireDatabase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commissionCycles)
      .where(eq(commissionCycles.cycleKey, input.cycleKey)).limit(1);
    if (existing) throw new HttpError(409, "This commission cycle already exists.");

    const [cycle] = await tx.insert(commissionCycles).values({
      cycleKey: input.cycleKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "CALCULATING"
    }).returning();

    const balances = await tx.select({ balance: accountPointBalances, account: networkAccounts })
      .from(accountPointBalances)
      .innerJoin(networkAccounts, eq(accountPointBalances.accountId, networkAccounts.id))
      .where(eq(networkAccounts.status, "ACTIVE"));

    let totalAmount = 0;
    let awardedAccounts = 0;
    const ownerTotals = new Map<string, number>();
    for (const row of balances) {
      const calculation = calculateAccountCommission({
        leftAvailable: row.balance.leftAvailable,
        rightAvailable: row.balance.rightAvailable,
        stageOneAchieved: row.balance.stageOneAchieved,
        stageTwoAchieved: row.balance.stageTwoAchieved
      });
      if (calculation.awards.length) awardedAccounts += 1;
      const accountTotal = calculation.awards.reduce((sum, award) => sum + award.amount, 0);
      totalAmount += accountTotal;
      for (const award of calculation.awards) {
        await tx.insert(commissionEntries).values({
          cycleId: cycle.id,
          accountId: row.account.id,
          stage: award.stage,
          matchedPairs: award.pairs,
          amount: award.amount.toFixed(2),
          metadata: { leftBefore: row.balance.leftAvailable, rightBefore: row.balance.rightAvailable }
        });
      }
      await tx.update(accountPointBalances).set({
        // Adil Academy weekly rule: every Friday settlement clears every
        // available point, including an unmatched point on either side.
        leftAvailable: 0,
        rightAvailable: 0,
        stageOneAchieved: calculation.stageOneAchieved,
        stageTwoAchieved: calculation.stageTwoAchieved,
        updatedAt: new Date()
      }).where(eq(accountPointBalances.id, row.balance.id));

      if (accountTotal > 0) {
        ownerTotals.set(
          row.account.ownerUserId,
          (ownerTotals.get(row.account.ownerUserId) ?? 0) + accountTotal
        );
        await tx.insert(wallets).values({ userId: row.account.ownerUserId })
          .onConflictDoNothing({ target: wallets.userId });
        const [wallet] = await tx.select().from(wallets)
          .where(eq(wallets.userId, row.account.ownerUserId)).limit(1);
        await tx.update(wallets).set({
          pendingBalance: (Number(wallet.pendingBalance) + accountTotal).toFixed(2),
          updatedAt: new Date()
        }).where(eq(wallets.id, wallet.id));
        await tx.insert(walletLedger).values({
          walletId: wallet.id,
          idempotencyKey: `commission-pending:${cycle.id}:${row.account.id}`,
          entryType: "COMMISSION_PENDING",
          amount: accountTotal.toFixed(2),
          referenceType: "commission_cycle",
          referenceId: cycle.id,
          note: `Friday commission for ${row.account.prefix}${row.account.numericPart}`
        });
      }
    }

    for (const [userId, amount] of ownerTotals) {
      await tx.insert(notifications).values({
        userId,
        type: "FRIDAY_COMMISSION_ADDED",
        title: "Friday commission added",
        message: `Weekly points flush සම්පූර්ණයි. Rs. ${amount.toLocaleString()} commission ඔබගේ pending income එකට එකතු විය.`
      });
    }

    const [updatedCycle] = await tx.update(commissionCycles)
      .set({ status: "CALCULATED", calculatedAt: new Date() })
      .where(eq(commissionCycles.id, cycle.id)).returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "COMMISSION_CYCLE_CALCULATED",
      entityType: "commission_cycle",
      entityId: cycle.id,
      metadata: { awardedAccounts, totalAmount, source: actorUserId ? "ADMIN" : "SCHEDULED_JOB" }
    });
    return { cycle: updatedCycle, awardedAccounts, totalAmount };
  });
}

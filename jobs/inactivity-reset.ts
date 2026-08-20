import { and, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { pool, requireDatabase } from "../db/client";
import {
  accountPointBalances,
  auditLogs,
  inactivityResets
} from "../db/schema";

async function runInactivityReset() {
  const db = requireDatabase();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const balances = await db
    .select()
    .from(accountPointBalances)
    .where(
      and(
        isNotNull(accountPointBalances.lastQualifiedActivityAt),
        lte(accountPointBalances.lastQualifiedActivityAt, cutoff),
        or(
          sql.raw("left_available > 0"),
          sql.raw("right_available > 0")
        )
      )
    );

  for (const balance of balances) {
    await db.transaction(async (tx) => {
      await tx.insert(inactivityResets).values({
        accountId: balance.accountId,
        leftPointsReset: balance.leftAvailable,
        rightPointsReset: balance.rightAvailable,
        inactivityDays: 90
      });
      await tx
        .update(accountPointBalances)
        .set({
          leftAvailable: 0,
          rightAvailable: 0,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(accountPointBalances.id, balance.id),
            lte(accountPointBalances.lastQualifiedActivityAt, cutoff)
          )
        );
      await tx.insert(auditLogs).values({
        action: "INACTIVITY_CARRY_FORWARD_RESET",
        entityType: "network_account",
        entityId: balance.accountId,
        metadata: {
          leftPointsReset: balance.leftAvailable,
          rightPointsReset: balance.rightAvailable,
          inactivityDays: 90
        }
      });
    });
  }

  console.log(
    "Inactivity reset completed for " + balances.length + " account(s)."
  );
}

try {
  await runInactivityReset();
} finally {
  await pool?.end();
}

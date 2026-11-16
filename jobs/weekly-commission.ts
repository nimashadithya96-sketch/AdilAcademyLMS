import { pool } from "../db/client";
import { calculateCommissionCycle } from "../server/modules/commissions/service";

function colomboWeek(now = new Date()) {
  const local = new Date(now.getTime() + 330 * 60_000);
  const day = local.getUTCDay();
  const daysSinceFriday = (day + 2) % 7;
  const friday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceFriday));
  const end = new Date(friday.getTime() - 330 * 60_000 + 24 * 60 * 60_000 - 1);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60_000 + 1);
  return { cycleKey: `FRIDAY-${friday.toISOString().slice(0, 10)}`, periodStart: start, periodEnd: end };
}

async function run() {
  const result = await calculateCommissionCycle(colomboWeek(), null);
  console.log(JSON.stringify({ ok: true, ...result }));
}

run().catch((error) => {
  if (error instanceof Error && error.message.includes("already exists")) {
    console.log(JSON.stringify({ ok: true, skipped: "cycle-already-calculated" }));
    return;
  }
  console.error(error);
  process.exitCode = 1;
}).finally(async () => pool?.end());

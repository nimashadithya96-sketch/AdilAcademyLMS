import { eq } from "drizzle-orm";
import { requireDatabase } from "../../../db/client";
import { commissionCycles, notifications, systemSettings, users, wallets } from "../../../db/schema";
import { sendFridayPayoutReminder } from "../../services/email";
import { calculateCommissionCycle } from "./service";

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const FRIDAY = 5;
const SETTLEMENT_HOUR = 12;
const SETTLEMENT_MINUTE = 30;
const CHECK_INTERVAL_MS = 60_000;

export type FridaySettlementWindow = {
  cycleKey: string;
  periodStart: Date;
  periodEnd: Date;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function latestFridaySettlement(now = new Date()): FridaySettlementWindow | null {
  // Shift UTC into Sri Lanka wall-clock time. Sri Lanka does not use DST.
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const daysSinceFriday = (local.getUTCDay() - FRIDAY + 7) % 7;
  const localDue = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceFriday,
    SETTLEMENT_HOUR,
    SETTLEMENT_MINUTE
  ));

  // Before 12:30 PM on Friday, the latest due settlement was last Friday.
  if (local.getTime() < localDue.getTime()) localDue.setUTCDate(localDue.getUTCDate() - 7);

  const periodEnd = new Date(localDue.getTime() - COLOMBO_OFFSET_MS);
  if (periodEnd.getTime() > now.getTime()) return null;
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    cycleKey: `LK-FRIDAY-${dateKey(localDue)}`,
    periodStart,
    periodEnd
  };
}

export function nextFridaySettlement(now = new Date()) {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const daysUntilFriday = (FRIDAY - local.getUTCDay() + 7) % 7;
  const localDue = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + daysUntilFriday,
    SETTLEMENT_HOUR,
    SETTLEMENT_MINUTE
  ));
  if (localDue.getTime() <= local.getTime()) localDue.setUTCDate(localDue.getUTCDate() + 7);
  return new Date(localDue.getTime() - COLOMBO_OFFSET_MS);
}

let running = false;
let reminderRunning = false;

function payoutReminderSlot(now: Date) {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  if (local.getUTCDay() !== FRIDAY) return null;
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (minutes < 17 * 60) return null;
  const slot = minutes >= 17 * 60 + 30 ? "1730" : minutes >= 17 * 60 + 20 ? "1720" : "1700";
  return { slot, date: dateKey(local) };
}

export async function runFridayPayoutReminder(now = new Date()) {
  if (reminderRunning) return;
  const reminder = payoutReminderSlot(now);
  if (!reminder) return;
  reminderRunning = true;
  try {
    const db = requireDatabase();
    const walletRows = await db.select({ available: wallets.availableBalance, pending: wallets.pendingBalance })
      .from(wallets).innerJoin(users, eq(users.id, wallets.userId)).where(eq(users.role, "consultant"));
    const amounts = walletRows.map((row) => Number(row.available) + Number(row.pending)).filter((amount) => amount > 0);
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
    if (totalAmount <= 0) return;

    const markerKey = `friday-payout-reminder:${reminder.date}:${reminder.slot}`;
    const [created] = await db.insert(systemSettings).values({
      key: markerKey,
      value: { sentAt: now.toISOString(), totalAmount, consultantCount: amounts.length }
    }).onConflictDoNothing().returning({ key: systemSettings.key });
    if (!created) return;

    await db.insert(systemSettings).values({
      key: "friday-payout-current",
      value: { payoutDate: reminder.date, dueAt: now.toISOString(), completedAt: null }
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: { payoutDate: reminder.date, dueAt: now.toISOString(), completedAt: null }, updatedAt: now }
    });

    const admins = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "admin"));
    if (admins.length) await db.insert(notifications).values(admins.map((admin) => ({
      userId: admin.id,
      type: "FRIDAY_PAYOUT_REMINDER",
      title: reminder.slot === "1730" ? "URGENT: Friday payouts are due" : "Friday payout reminder",
      message: `${amounts.length} consultants සඳහා Rs. ${totalAmount.toLocaleString()} manual bank payments සම්පූර්ණ කරන්න.`
    })));
    await Promise.all(admins.map((admin) => sendFridayPayoutReminder(admin.email, totalAmount, amounts.length).catch((error) => console.error("Friday payout reminder email failed", error))));
    console.log(`[Friday payout reminder] ${reminder.date} ${reminder.slot}: ${amounts.length} consultants, Rs. ${totalAmount}`);
  } catch (error) {
    console.error("Friday payout reminder failed", error);
  } finally {
    reminderRunning = false;
  }
}

export async function runDueFridaySettlement(now = new Date()) {
  if (running) return;
  const window = latestFridaySettlement(now);
  if (!window) return;
  running = true;
  try {
    const db = requireDatabase();
    const [existing] = await db.select({ id: commissionCycles.id })
      .from(commissionCycles)
      .where(eq(commissionCycles.cycleKey, window.cycleKey))
      .limit(1);
    if (existing) return;
    const result = await calculateCommissionCycle(window, null);
    console.log(
      `[Friday settlement] ${window.cycleKey}: ${result.awardedAccounts} accounts, Rs. ${result.totalAmount}`
    );
  } catch (error) {
    // The cycle key is unique, so concurrent instances cannot pay twice.
    console.error("Friday commission settlement failed", error);
  } finally {
    running = false;
  }
}

export function startFridayCommissionScheduler() {
  void runDueFridaySettlement();
  void runFridayPayoutReminder();
  const timer = setInterval(() => { void runDueFridaySettlement(); void runFridayPayoutReminder(); }, CHECK_INTERVAL_MS);
  timer.unref();
  console.log("Friday scheduler active: settlement 12:30 PM; payout reminders 5:00/5:20/5:30 PM Asia/Colombo");
}

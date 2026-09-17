import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { requireDatabase } from "../../../db/client";
import {
  consultantAdmissionTargets,
  networkAccounts,
  paymentRequests,
  users
} from "../../../db/schema";
import { requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const adminAdmissionHeroesRouter = Router();

const COLOMBO_OFFSET_MS = 330 * 60 * 1000;

function colomboDate(date: Date) {
  return new Date(date.getTime() + COLOMBO_OFFSET_MS);
}

function dateKey(date: Date) {
  return colomboDate(date).toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const local = colomboDate(date);
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return local.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return colomboDate(date).toISOString().slice(0, 7);
}

async function admissionSnapshot() {
  const db = requireDatabase();

  const rows = await db
    .select({
      ownerUserId: networkAccounts.ownerUserId,
      paidAmount: paymentRequests.paidAmount,
      totalAmount: paymentRequests.totalAmount,
      reviewedAt: paymentRequests.reviewedAt,
      createdAt: paymentRequests.createdAt
    })
    .from(paymentRequests)
    .innerJoin(
      networkAccounts,
      eq(networkAccounts.id, paymentRequests.requestedParentAccountId)
    )
    .where(eq(paymentRequests.status, "APPROVED"));

  return rows
    .filter((row) => Number(row.paidAmount) >= Number(row.totalAmount))
    .map((row) => ({
      ownerUserId: row.ownerUserId,
      createdAt: row.reviewedAt ?? row.createdAt
    }));
}

adminAdmissionHeroesRouter.get(
  "/admin/admission-heroes",
  asyncRoute(async (request, response) => {
    await requireRole(request, ["admin"]);
    const db = requireDatabase();

    const [consultants, targets, admissions] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.displayName,
          accountNumericPart: networkAccounts.numericPart,
          hasPhoto: users.profilePhotoObjectKey
        })
        .from(users)
        .leftJoin(
          networkAccounts,
          and(
            eq(networkAccounts.ownerUserId, users.id),
            eq(networkAccounts.prefix, "CN"),
            eq(networkAccounts.isMainAccount, true)
          )
        )
        .where(
          and(
            eq(users.role, "consultant"),
            eq(users.isActive, true)
          )
        ),
      db.select().from(consultantAdmissionTargets),
      admissionSnapshot()
    ]);

    const targetMap = new Map(targets.map((item) => [item.userId, item]));
    const now = new Date();

    const heroes = consultants.map((person) => {
      const own = admissions.filter((item) => item.ownerUserId === person.id);

      const counts = {
        daily: own.filter((item) => dateKey(item.createdAt) === dateKey(now)).length,
        weekly: own.filter((item) => weekKey(item.createdAt) === weekKey(now)).length,
        monthly: own.filter((item) => monthKey(item.createdAt) === monthKey(now)).length,
        allTime: own.length
      };

      const target = targetMap.get(person.id);
      const wins = (["daily", "weekly", "monthly"] as const).filter((period) => {
        const goal = target?.[`${period}Target`] ?? 0;
        return goal > 0 && counts[period] >= goal;
      });

      return {
        id: person.id,
        name: person.name,
        accountNumber: person.accountNumericPart
          ? `CN${person.accountNumericPart}`
          : null,
        photoUrl: person.hasPhoto
          ? `/api/consultant/profile-photo/${person.id}`
          : null,
        counts,
        wins
      };
    });

    const rank = (period: "weekly" | "monthly", limit: number) =>
      heroes
        .filter((item) => item.counts[period] > 0)
        .sort(
          (a, b) =>
            b.counts[period] - a.counts[period] ||
            b.counts.allTime - a.counts.allTime ||
            a.name.localeCompare(b.name)
        )
        .slice(0, limit);

    response.json({
      targetWinners: heroes
        .filter((item) => item.wins.length > 0)
        .sort(
          (a, b) =>
            b.wins.length - a.wins.length ||
            b.counts.monthly - a.counts.monthly ||
            a.name.localeCompare(b.name)
        ),
      weeklyChampions: rank("weekly", 5),
      monthlyChampions: rank("monthly", 10)
    });
  })
);

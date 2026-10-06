import crypto from "node:crypto";
import argon2 from "argon2";
import { Router } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { passwordResetCodes, sessions, users } from "../../../db/schema";
import { asyncRoute } from "../../lib/http";
import { sendPasswordResetCode } from "../../services/email";

export const passwordResetRouter = Router();

const requestResetSchema = z.object({
  email: z.string().trim().email().max(200)
});

const completeResetSchema = z.object({
  email: z.string().trim().email().max(200),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)
});

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;
const RESET_CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;

function resetCodeHash(userId: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET_REQUIRED");
  return crypto.createHmac("sha256", secret).update(`password-reset:${userId}:${code}`).digest("hex");
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function authCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt
  };
}

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    role: user.role,
    learningPortalEnabled: user.learningPortalEnabled
  };
}

async function createSessionFor(user: typeof users.$inferSelect) {
  const db = requireDatabase();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessions).values({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt, user: publicUser(user) };
}

passwordResetRouter.post(
  "/auth/forgot-password",
  asyncRoute(async (request, response) => {
    const input = requestResetSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const db = requireDatabase();
    const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true), isNull(users.removedAt))).limit(1);

    // Always return the same public response so the endpoint does not reveal whether an account exists.
    if (user?.emailVerifiedAt && user.passwordSetAt) {
      const [latest] = await db.select().from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, user.id))
        .orderBy(desc(passwordResetCodes.createdAt))
        .limit(1);

      const createdAt = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
      if (!latest || Date.now() - createdAt >= RESET_RESEND_COOLDOWN_MS) {
        const code = String(crypto.randomInt(100000, 1000000));
        await db.transaction(async (tx) => {
          await tx.update(passwordResetCodes)
            .set({ usedAt: new Date() })
            .where(and(eq(passwordResetCodes.userId, user.id), isNull(passwordResetCodes.usedAt)));
          await tx.insert(passwordResetCodes).values({
            userId: user.id,
            codeHash: resetCodeHash(user.id, code),
            expiresAt: new Date(Date.now() + RESET_CODE_LIFETIME_MS)
          });
        });
        try {
          await sendPasswordResetCode(user.email, user.displayName, code);
        } catch (error) {
          console.error("Password reset email failed", error);
        }
      }
    }

    response.json({ message: "මෙම email එකට active account එකක් තිබේ නම් password reset code එකක් email කර ඇත. Inbox, Spam සහ Promotions බලන්න." });
  })
);

passwordResetRouter.post(
  "/auth/reset-password",
  asyncRoute(async (request, response) => {
    const input = completeResetSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const db = requireDatabase();
    const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true), isNull(users.removedAt))).limit(1);
    if (!user?.emailVerifiedAt || !user.passwordSetAt) {
      response.status(400).json({ message: "Reset code එක වැරදි හෝ expire වී ඇත." });
      return;
    }

    const [reset] = await db.select().from(passwordResetCodes)
      .where(and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.usedAt),
        gt(passwordResetCodes.expiresAt, new Date())
      ))
      .orderBy(desc(passwordResetCodes.createdAt))
      .limit(1);

    if (!reset || reset.attempts >= 5 || reset.codeHash !== resetCodeHash(user.id, input.code)) {
      if (reset && reset.attempts < 5) {
        await db.update(passwordResetCodes).set({ attempts: reset.attempts + 1 }).where(eq(passwordResetCodes.id, reset.id));
      }
      response.status(400).json({ message: "Reset code එක වැරදි හෝ expire වී ඇත." });
      return;
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const [updated] = await db.transaction(async (tx) => {
      await tx.update(passwordResetCodes).set({ usedAt: new Date() }).where(eq(passwordResetCodes.id, reset.id));
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      return tx.update(users).set({ passwordHash, passwordSetAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    });

    const session = await createSessionFor(updated);
    response.cookie("adil_session", session.token, authCookieOptions(session.expiresAt));
    response.json({ user: session.user, message: "Password එක සාර්ථකව reset විය." });
  })
);

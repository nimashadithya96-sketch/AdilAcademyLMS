import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { z } from "zod";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { requireDatabase } from "../db/client";
import {
  ccoMainApplications,
  networkAccounts,
  notifications,
  paymentReferenceIds,
  paymentRequests,
  users,
} from "../db/schema";
import type { DemoUser, PlatformOverview, UserRole } from "../shared/platform";
import {
  deletePersistentSession,
  createAdmissionApplication,
  createAndSendVerificationCode,
  getUserForSession,
  loginUser,
  matchesRegistrationToken,
  verifyCodeAndSetPassword,
} from "./modules/auth/service";
import { uploadPrivateFile } from "./services/storage";
import { sendApplicationReceived, sendPayId } from "./services/email";
import { apiErrorHandler } from "./lib/http";
import { courseRouter } from "./modules/courses/routes";
import { lessonQandARouter } from "./modules/courses/lesson-q-and-a";
import { paymentRouter } from "./modules/payments/routes";
import { consultantRouter } from "./modules/consultants/routes";
import { commissionRouter } from "./modules/commissions/routes";
import { startFridayCommissionScheduler } from "./modules/commissions/scheduler";
import { platformRouter } from "./modules/platform/routes";
import { supportRouter } from "./modules/support/routes";
import { ccoMainRouter } from "./modules/cco-main/routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// UptimeRobot 24/7 Ping Endpoint
app.get("/ping", (req, res) => {
  res.status(200).send("LMS Server is Alive and Running!");
});
const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";
// Demo access is opt-in in every environment. Never grant passwordless role
// access merely because the server is running in development mode.
const demoLoginEnabled = process.env.ENABLE_DEMO_LOGIN === "true";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const overview: PlatformOverview = {
  course: {
    title: "Crypto Trading — Zero to Pro",
    language: "සිංහල",
    modules: 6,
    access: "Lifetime course access",
  },
  features: [
    "Spot & Futures Trading",
    "Technical Analysis",
    "Risk Management",
    "Progress Tracking",
    "Consultant Network",
    "Weekly Commission Reports",
  ],
  paymentMethods: ["Bank Transfer", "Binance Pay / USDT"],
};

const demoUsers: Record<UserRole, DemoUser> = {
  student: {
    id: "demo-student",
    name: "Nimal Perera",
    email: "student@adilacademy.demo",
    role: "student",
    accountNumber: "SR527694",
  },
  consultant: {
    id: "demo-consultant",
    name: "Kasun Silva",
    email: "consultant@adilacademy.demo",
    role: "consultant",
    accountNumber: "CN527695",
  },
  staff: {
    id: "demo-staff",
    name: "Academy Staff",
    email: "staff@adilacademy.demo",
    role: "staff",
  },
  admin: {
    id: "demo-admin",
    name: "Super Admin",
    email: "admin@adilacademy.demo",
    role: "admin",
  },
};

const demoSessions = new Map<string, DemoUser>();
const demoLoginSchema = z.object({
  role: z.enum(["student", "consultant", "staff", "admin"]),
});
const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30).optional(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[0-9]/, "Password needs a number."),
});
const admissionSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
  nicOrPassport: z.string().trim().min(5).max(50),
  courseId: z.string().uuid(),
  transactionReference: z.string().trim().min(2).max(200),
  payId: z.string().trim().min(10).max(80),
});
const verificationSchema = z.object({
  email: z.string().trim().email().max(200),
  code: z.string().regex(/^\d{6}$/),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
const payIdRequestSchema = z.object({
  email: z.string().trim().email().max(200),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(128),
});

function authCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 1000 * 60 * 60 * 8 }),
  };
}

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "adil-academy-lms",
    environment: process.env.NODE_ENV ?? "development",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  });
});

app.get("/api/public/overview", (_request, response) => {
  response.json(overview);
});

app.post("/api/pay-ids", async (request, response) => {
  const parsed = payIdRequestSchema.safeParse(request.body);
  if (!parsed.success)
    return void response
      .status(400)
      .json({ message: "Valid email address එකක් ඇතුළත් කරන්න." });
  const email = parsed.data.email.toLowerCase();
  try {
    const db = requireDatabase();
    const [recent] = await db
      .select()
      .from(paymentReferenceIds)
      .where(
        and(
          eq(paymentReferenceIds.email, email),
          gt(
            paymentReferenceIds.createdAt,
            new Date(Date.now() - 48 * 60 * 60 * 1000),
          ),
        ),
      )
      .orderBy(desc(paymentReferenceIds.createdAt))
      .limit(1);
    if (recent) {
      const availableAt = new Date(
        recent.createdAt.getTime() + 48 * 60 * 60 * 1000,
      );
      return void response.status(429).json({
        message: `මෙම email එකට Pay ID එකක් දැනටමත් නිකුත් කර ඇත. අලුත් Pay ID එකක් ලබාගත හැක්කේ ${availableAt.toLocaleString("en-LK", { timeZone: "Asia/Colombo" })} පසුවයි.`,
      });
    }

    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const code = `ADIL-PAY-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const [created] = await db
      .insert(paymentReferenceIds)
      .values({ code, email, expiresAt })
      .returning();
    try {
      await sendPayId(email, code, expiresAt);
    } catch (emailError) {
      await db
        .delete(paymentReferenceIds)
        .where(eq(paymentReferenceIds.id, created.id));
      throw emailError;
    }
    response.status(201).json({ message: "Pay ID එක ඔබගේ email එකට යවා ඇත." });
  } catch (error) {
    console.error("Pay ID email failed", error);
    response
      .status(503)
      .json({
        message:
          "Pay ID email එක යැවීමට නොහැකි විය. EMAIL_APP_PASSWORD check කරන්න.",
      });
  }
});

app.post("/api/auth/demo-login", (request, response) => {
  if (!demoLoginEnabled) {
    response.status(404).json({ message: "Demo login is disabled." });
    return;
  }

  const parsed = demoLoginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid role." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const user = demoUsers[parsed.data.role];
  demoSessions.set(token, user);

  response.cookie("adil_session", token, authCookieOptions());
  response.json({ user });
});

app.post("/api/auth/apply", async (request, response) => {
  const parsed = admissionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      message: "Application details are invalid.",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  try {
    const application = await createAdmissionApplication(parsed.data);
    response.status(201).json(application);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "EMAIL_ALREADY_EXISTS") {
      response.status(409).json({ message: "Email already registered." });
      return;
    }
    if (code === "DATABASE_NOT_CONFIGURED") {
      response.status(503).json({
        message: "Database is not configured. Add Replit PostgreSQL first.",
      });
      return;
    }
    if (code === "COURSE_NOT_FOUND")
      return void response.status(404).json({ message: "Course not found." });
    if (code === "FULL_PAYMENT_REQUIRED")
      return void response
        .status(400)
        .json({ message: "Full course payment is required." });
    if (code === "INVALID_PAY_ID")
      return void response
        .status(400)
        .json({
          message:
            "Pay ID එක invalid, expired, already used, email එකට නොගැළපෙන හෝ bank reference එකට නොගැළපේ.",
        });
    console.error("Application failed", error);
    response.status(500).json({ message: "Application failed." });
  }
});

app.put(
  "/api/auth/applications/:id/proof",
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    limit: "8mb",
  }),
  async (request, response) => {
    try {
      const token = String(request.headers["x-registration-token"] || "");
      const db = requireDatabase();
      const [payment] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, String(request.params.id)))
        .limit(1);
      if (
        !payment ||
        !matchesRegistrationToken(token, payment.registrationTokenHash)
      )
        return void response
          .status(403)
          .json({ message: "Invalid application token." });
      const mime = String(request.headers["content-type"] || "").split(";")[0];
      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      };
      if (
        !extensions[mime] ||
        !Buffer.isBuffer(request.body) ||
        request.body.length < 1
      )
        return void response
          .status(400)
          .json({ message: "Upload a JPG, PNG, WebP, or PDF proof." });
      const objectKey = `payment-proofs/${payment.userId}/${payment.id}.${extensions[mime]}`;
      await uploadPrivateFile(objectKey, request.body);
      await db
        .update(paymentRequests)
        .set({
          proofObjectKey: objectKey,
          proofMimeType: mime,
          status: "UNDER_REVIEW",
          registrationTokenHash: null,
        })
        .where(eq(paymentRequests.id, payment.id));
      if (payment.payIdId)
        await db
          .update(paymentReferenceIds)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(paymentReferenceIds.id, payment.payIdId),
              isNull(paymentReferenceIds.usedAt),
            ),
          );
      const [[student], [account], admins] = await Promise.all([
        db
          .select({ name: users.displayName, email: users.email })
          .from(users)
          .where(eq(users.id, payment.userId))
          .limit(1),
        db
          .select({
            prefix: networkAccounts.prefix,
            numericPart: networkAccounts.numericPart,
          })
          .from(networkAccounts)
          .where(
            and(
              eq(networkAccounts.ownerUserId, payment.userId),
              eq(networkAccounts.isMainAccount, true),
            ),
          )
          .limit(1),
        db.select({ id: users.id }).from(users).where(eq(users.role, "admin")),
      ]);
      const accountNumber = account
        ? `${account.prefix}${account.numericPart}`
        : "SR pending";
      if (admins.length)
        await db.insert(notifications).values(
          admins.map((admin) => ({
            userId: admin.id,
            type: "NEW_STUDENT_APPLICATION",
            title: "New student payment submitted",
            message: `${student?.name ?? "Student"} • ${accountNumber} • ${payment.paymentCode}`,
          })),
        );
      let confirmationEmailSent = false;
      if (student) {
        try {
          await sendApplicationReceived(
            student.email,
            student.name,
            payment.paymentCode,
          );
          confirmationEmailSent = true;
        } catch (emailError) {
          console.error(
            "Application saved but confirmation email failed",
            emailError,
          );
        }
      }
      response.json({
        message: "Application and payment proof submitted.",
        confirmationEmailSent,
      });
    } catch (error) {
      console.error("Application proof failed", error);
      response.status(500).json({ message: "Payment proof upload failed." });
    }
  },
);

app.post("/api/auth/verify", async (request, response) => {
  const parsed = verificationSchema.safeParse(request.body);
  if (!parsed.success)
    return void response
      .status(400)
      .json({ message: "OTP or password is invalid." });
  try {
    const session = await verifyCodeAndSetPassword(parsed.data);
    response.cookie(
      "adil_session",
      session.token,
      authCookieOptions(session.expiresAt),
    );
    response.json({ user: session.user });
  } catch {
    response.status(400).json({ message: "OTP is incorrect or expired." });
  }
});

app.post("/api/auth/resend-otp", async (request, response) => {
  const email = z.string().email().safeParse(request.body?.email);
  if (!email.success)
    return void response
      .status(400)
      .json({ message: "Valid email is required." });
  try {
    const db = requireDatabase();
    const normalizedEmail = email.data.toLowerCase();
    const [courseApproval] = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(paymentRequests, eq(paymentRequests.userId, users.id))
      .where(
        and(
          eq(users.email, normalizedEmail),
          eq(paymentRequests.status, "APPROVED"),
        ),
      )
      .limit(1);
    const [ccoApproval] = courseApproval
      ? []
      : await db
          .select({ userId: users.id })
          .from(users)
          .innerJoin(
            ccoMainApplications,
            eq(ccoMainApplications.userId, users.id),
          )
          .where(
            and(
              eq(users.email, normalizedEmail),
              eq(ccoMainApplications.status, "APPROVED"),
            ),
          )
          .limit(1);
    const record = courseApproval ?? ccoApproval;
    if (!record)
      return void response
        .status(400)
        .json({ message: "Payment approval is still pending." });
    await createAndSendVerificationCode(record.userId);
    response.json({ message: "A new OTP was sent." });
  } catch (error) {
    console.error("OTP resend failed", error);
    response.status(500).json({ message: "OTP email could not be sent." });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid email or password." });
    return;
  }

  try {
    const session = await loginUser(parsed.data);
    response.cookie(
      "adil_session",
      session.token,
      authCookieOptions(session.expiresAt),
    );
    response.json({ user: session.user });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_CREDENTIALS") {
      response.status(401).json({ message: "Invalid email or password." });
      return;
    }
    if (code === "DATABASE_NOT_CONFIGURED") {
      response.status(503).json({
        message: "Database is not configured. Use platform preview for now.",
      });
      return;
    }
    console.error("Login failed", error);
    response.status(500).json({ message: "Login failed." });
  }
});

app.get("/api/auth/me", async (request, response) => {
  const token = readCookie(request.headers.cookie, "adil_session");
  const demoUser = token ? demoSessions.get(token) : undefined;

  if (demoUser) {
    response.json({ user: demoUser });
    return;
  }

  if (!token) {
    response.status(401).json({ message: "Not authenticated." });
    return;
  }

  try {
    const user = await getUserForSession(token);
    if (!user) {
      response.status(401).json({ message: "Not authenticated." });
      return;
    }
    response.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
      response.status(401).json({ message: "Not authenticated." });
      return;
    }
    console.error("Session lookup failed", error);
    response.status(500).json({ message: "Session lookup failed." });
  }
});

app.post("/api/auth/logout", async (request, response) => {
  const token = readCookie(request.headers.cookie, "adil_session");
  if (token) {
    if (demoSessions.has(token)) {
      demoSessions.delete(token);
    } else {
      try {
        await deletePersistentSession(token);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "DATABASE_NOT_CONFIGURED"
        ) {
          console.error("Session deletion failed", error);
        }
      }
    }
  }
  response.clearCookie("adil_session");
  response.status(204).end();
});

app.use("/api", courseRouter);
app.use("/api", lessonQandARouter);
app.use("/api", paymentRouter);
app.use("/api", consultantRouter);
app.use("/api", commissionRouter);
app.use("/api", platformRouter);
app.use("/api", supportRouter);
app.use("/api", ccoMainRouter);
app.use("/api", (_request, response) => {
  response
    .status(404)
    .json({
      message:
        "API route not found. Latest build එක install කර app එක restart කරන්න.",
    });
});
app.use("/api", apiErrorHandler);

async function attachFrontend() {
  if (!isProduction && process.env.SERVE_STATIC !== "true") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: path.resolve(process.cwd(), "client"),
      server: { middlewareMode: true, allowedHosts: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
    return;
  }

  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.use((_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });
}

await attachFrontend();

app.listen(port, "0.0.0.0", () => {
  console.log("Adil Academy LMS running on port " + port);
  startFridayCommissionScheduler();
});

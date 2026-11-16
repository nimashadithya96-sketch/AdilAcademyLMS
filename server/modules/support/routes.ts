import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { requireDatabase } from "../../../db/client";
import { notifications, supportAgentPresence, supportConversations, supportMessages, users } from "../../../db/schema";
import { getUserForSession } from "../auth/service";
import { HttpError, readCookie, requireRole } from "../../lib/auth";
import { asyncRoute } from "../../lib/http";

export const supportRouter = Router();
const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const createInput = z.object({ mode: z.enum(["FAQ", "HUMAN"]), name: z.string().trim().max(100).optional(), email: z.string().trim().email().max(200).optional() });
const messageInput = z.object({ token: z.string().min(32).max(200), message: z.string().trim().min(1).max(1500) });
const tokenInput = z.object({ token: z.string().min(32).max(200) });

const rate = new Map<string, { count: number; resets: number }>();
function limit(request: Request) {
  const key = request.ip || "unknown"; const now = Date.now(); const value = rate.get(key);
  if (!value || value.resets < now) { rate.set(key, { count: 1, resets: now + 60_000 }); return; }
  if (value.count >= 30) throw new HttpError(429, "කරුණාකර මිනිත්තුවකට පසු නැවත උත්සාහ කරන්න.");
  value.count += 1;
}
async function optionalUser(request: Request) {
  const token = readCookie(request.headers.cookie, "adil_session");
  return token ? await getUserForSession(token).catch(() => null) : null;
}

type FaqIntent = { id: string; phrases: string[]; answer: string };
const FAQS: FaqIntent[] = [
  { id: "greeting", phrases: ["hello", "hi", "hey", "හෙලෝ", "ආයුබෝවන්", "kohomada"], answer: "ආයුබෝවන්! මම Adil Academy සිංහල FAQ සහායකයා. පාඨමාලා, registration, payment, Pay ID, OTP, login, Student Portal, CCO, points, commission හෝ payout ගැන අහන්න." },
  { id: "courses", phrases: ["course", "courses", "පාඨමාල", "class", "පන්තිය", "ඉගෙන", "learn"], answer: "Home page එකේ Courses කොටසෙන් දැනට publish කර ඇති පාඨමාලා, මිල සහ කෙටි විස්තර බලන්න පුළුවන්. Admission Form එකේ මුලින්ම අවශ්‍ය පාඨමාලාව තෝරා එයට අදාළ application එක submit කරන්න." },
  { id: "register", phrases: ["register", "registration", "admission", "apply", "ලියාපදිංචි", "අයදුම්"], answer: "Admission Form එකෙන් course එක තෝරා නම, phone, NIC/Passport, email, Pay ID/bank reference සහ payment slip ලබාදී submit කරන්න. Consultant කෙනෙකු හරහා එනවා නම් ඔහු/ඇය ලබාදුන් Pay ID එක භාවිත කරන්න." },
  { id: "payid", phrases: ["pay id", "payid", "payment id", "reference id", "bank reference"], answer: "Pay ID එක payment එක නිවැරදි student/application එකට හඳුනාගැනීමට භාවිත කරන unique reference එකයි. Bank transfer කරන විට reference field එකට එය වෙනස් නොකර ඇතුළත් කරන්න. එකම Pay ID එක වෙනත් කෙනෙකුට භාවිත නොකරන්න." },
  { id: "payment", phrases: ["payment", "pay", "ගෙව", "මුදල", "bank transfer", "slip", "receipt"], answer: "Payment කළ පසු නිවැරදි Pay ID/reference සහ පැහැදිලි bank slip එක Admission Form එකෙන් upload කරන්න. Status එක Under Review ලෙස පෙන්වයි. Admin bank transaction එක පරීක්ෂා කර approve කළ පසු email OTP එක ලැබේ." },
  { id: "payment_pending", phrases: ["pending", "under review", "approve නැ", "approve n", "පරීක්ෂා", "තවම approve"], answer: "Under Review/Pending කියන්නේ payment එක Admin විසින් තවම verify කරමින් සිටින බවයි. Pay ID, amount සහ slip එක පැහැදිලිද බලන්න. බොහෝ වේලාවක් වෙනසක් නැත්නම් Payment ID එක සමඟ Human Support අමතන්න." },
  { id: "otp", phrases: ["otp", "verification code", "verify code", "කේත", "code එන්න", "code enna"], answer: "OTP එක payment approve කළ පසු application email එකට යවයි. Inbox, Spam සහ Promotions folders බලන්න. Email address එක වැරදි නම් Human Support අමතන්න. OTP/password කිසිවෙකුට share කරන්න එපා." },
  { id: "email_spam", phrases: ["spam", "email නැ", "email na", "mail නැ", "mail awe na", "promotions"], answer: "Email එක Inbox එකේ නැත්නම් Spam/Junk/Promotions folder සහ search box එකේ ‘Adil Academy’ බලන්න. තවම නැත්නම් application එකේ email address එක නිවැරදිද පරීක්ෂා කර Human Support වෙත Payment ID එක යවන්න." },
  { id: "password", phrases: ["password", "මුරපද", "forgot", "reset password", "pass word"], answer: "පළමු OTP verification එකේ ඔබම permanent password එකක් තෝරන්න. Uppercase, lowercase සහ number එකක් ඇතුළත් ශක්තිමත් password එකක් යොදන්න. Password අමතක නම් Human Support මගින් identity verify කර reset සහාය ලබාගන්න." },
  { id: "login", phrases: ["login", "log in", "sign in", "ඇතුල්", "open wenne", "ලොග්"], answer: "Payment approve කර OTP verify කළ email එක සහ ඔබ තෝරාගත් password එකෙන් Login කරන්න. Account inactive/locked ලෙස පෙන්වන්නේ නම් Admin approval හෝ payment status එක Human Support සමඟ පරීක්ෂා කරන්න." },
  { id: "student_portal", phrases: ["student portal", "dashboard", "my course", "lesson", "video", "progress", "quiz"], answer: "Student Portal තුළ My Course, lessons, progress, quizzes, certificates සහ payments පෙන්වයි. අලුත් account එකක progress 0% සිට ආරම්භ විය යුතුයි. Course locked නම් enrollment/payment approval එක පරීක්ෂා කරන්න." },
  { id: "certificate", phrases: ["certificate", "සහතික", "completion"], answer: "අදාළ පාඨමාලාවේ සියලු required lessons සහ quizzes සම්පූර්ණ කර අවම quiz requirement එක ලබාගත් පසු certificate eligibility ලැබේ. Certificates tab එකෙන් status එක බලන්න." },
  { id: "consultant", phrases: ["consultant", "cco", "cn number", "cn account", "උපදේශක"], answer: "CCO/Consultant access ලබාදෙන්නේ interview සහ Admin approval එකෙන් පමණයි. Approve වූ student account එකේ Consultant Portal enable වේ; අවසර තිබේ නම් Student Portal සහ Consultant Portal අතර switch කරන්න පුළුවන්." },
  { id: "cco_activation", phrases: ["cco activation", "account buy", "reserved account", "trial account", "30 day", "active account"], answer: "Consultant Portal → CCO Activation තුළ ඊළඟ available reserved CN account එක පමණක් තෝරා full activation හෝ ලබාදී ඇති trial option එකෙන් request කරන්න. Bank slip submit කළ පසු Admin verify කර account එක activate කරයි." },
  { id: "points", phrases: ["point", "points", "left side", "right side", "service account", "පොයින්ට්"], answer: "Verified full-payment admission එක placement වූ service account side එකට point එකක් ලෙස record වේ. Network structure අනුව එය අදාළ ඉහළ accounts වෙත propagate විය හැක. Half payment එකකට qualification point එක නොලැබේ." },
  { id: "cycles", phrases: ["1:1", "2:2", "3:3", "cycle", "flush"], answer: "සෑම active service account එකකටම 1:1 cycle එක එක් වරක් Rs.2,500 සහ 2:2 cycle එක එක් වරක් Rs.5,000 වේ. ඉන්පසු eligible 3:3 cycle එකකට Rs.8,000 බැගින් repeat වේ. Settlement එකේ භාවිත කළ points flush වී ඉතිරි points carry වේ." },
  { id: "commission", phrases: ["commission", "income", "earning", "කොමිස්", "ආදාය", "direct income"], answer: "Approved direct admission එකකට direct income record වේ. Service-group income eligible left/right points settle වූ පසු පමණක් wallet එකට පෙන්වයි. Income tab එකේ available balance, ledger සහ payout status බලන්න." },
  { id: "friday", phrases: ["friday", "sikurada", "සිකුරාදා", "12:30", "5:30", "weekly settlement", "payout"], answer: "ශ්‍රී ලංකා වේලාවෙන් සෑම සිකුරාදාම 12:30 PM eligible points settle කර commission wallet එකට add වේ. Admin manual bank payouts සිකුරාදා 5:30 PM දක්වා process කරයි; bank processing time අනුව credit වීම ප්‍රමාද විය හැක." },
  { id: "bank_details", phrases: ["bank details", "account number", "bank account", "branch", "බැංකු විස්තර"], answer: "Consultant payout ලබාගැනීමට My Profile/Income සම්බන්ධ bank details form එකේ account holder name, bank, branch සහ account number නිවැරදිව save කරන්න. වැරදි bank details නිසා transfer fail විය හැක." },
  { id: "suspend", phrases: ["suspend", "disabled", "inactive", "blocked", "lock", "අක්‍රීය"], answer: "Account එක suspended/disabled නම් access තාවකාලිකව නවතී. Trial expiry, payment issue, security review හෝ Admin action හේතුවක් විය හැක. SR/CN number එක සමඟ Human Support අමතන්න." },
  { id: "security", phrases: ["hack", "security", "safe", "scam", "otp share", "ආරක්ෂා"], answer: "Password සහ OTP කිසිවෙකුට share නොකරන්න. Payment කරන්න Adil Academy ලබාදෙන verified bank details පමණක් භාවිත කරන්න. සැක සහිත message/link එකක් ලැබුණොත් payment නොකර Human Support වෙත screenshot එක යවන්න." },
  { id: "human", phrases: ["human", "person", "agent", "personal guide", "support", "admin එක්ක", "කෙනෙක් එක්ක"], answer: "Customer Care එක නැවත විවෘත කර Personal Guide තෝරන්න. Online consultant/Admin කෙනෙක් I CAN HELP තෝරාගත් විට live chat එක ආරම්භ වේ. කවුරුත් online නැත්නම් ඔබගේ Payment ID/SR/CN number සමඟ message එක තබන්න." }
];
function normalizeFaqText(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[?!.(),/\\:_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function faqAnswer(question: string) {
  const normalized = normalizeFaqText(question);
  const words = new Set(normalized.split(" ").filter((word) => word.length > 1));
  const ranked = FAQS.map((item) => {
    const score = item.phrases.reduce((total, phrase) => {
      const key = normalizeFaqText(phrase);
      if (normalized.includes(key)) return total + (key.includes(" ") ? 5 : 3);
      const parts = key.split(" ");
      return total + parts.filter((part) => words.has(part)).length;
    }, 0);
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 3) return ranked[0].item.answer;
  return "ඔබගේ ප්‍රශ්නය මට තවම නිවැරදිව හඳුනාගත නොහැක. Payment ID, OTP, login, course, Student Portal, CCO, points, commission හෝ payout යන මාතෘකාව සඳහන් කර නැවත කෙටියෙන් අහන්න. එසේ නැත්නම් Customer Care → Personal Guide තෝරා Human Support ලබාගන්න.";
}

supportRouter.get("/public/support/availability", asyncRoute(async (_request, response) => {
  const db = requireDatabase(); const since = new Date(Date.now() - 60_000);
  const online = await db.select({ id: users.id }).from(supportAgentPresence).innerJoin(users, eq(users.id, supportAgentPresence.userId)).where(and(gt(supportAgentPresence.lastSeenAt, since), eq(users.isActive, true), inArray(users.role, ["consultant", "staff", "admin"]))).limit(1);
  response.json({ humanOnline: online.length > 0 });
}));

supportRouter.post("/public/support/conversations", asyncRoute(async (request, response) => {
  limit(request); const input = createInput.parse(request.body); const db = requireDatabase(); const rawToken = crypto.randomBytes(32).toString("hex");
  const current = await optionalUser(request); const since = new Date(Date.now() - 60_000);
  const onlineAgents = input.mode === "HUMAN" ? await db.select({ id: users.id }).from(supportAgentPresence).innerJoin(users, eq(users.id, supportAgentPresence.userId)).where(and(gt(supportAgentPresence.lastSeenAt, since), eq(users.isActive, true), inArray(users.role, ["consultant", "staff", "admin"]))) : [];
  const humanOnline = onlineAgents.length > 0; const channel = input.mode === "HUMAN" && humanOnline ? "HUMAN" : "FAQ"; const status = channel === "HUMAN" ? "WAITING" : "BOT";
  const [conversation] = await db.insert(supportConversations).values({ publicTokenHash: tokenHash(rawToken), channel, status, visitorName: input.name, visitorEmail: input.email, visitorUserId: current?.id }).returning();
  const welcome = input.mode === "HUMAN" && !humanOnline ? "දැනට Human Support team එක online නැහැ. ඔබට ඉක්මනින් උදව් කිරීමට FAQ Bot එක සම්බන්ධ කළා." : channel === "HUMAN" ? "ඔබගේ request එක online support team එකට යැව්වා. පළමු available Personal Guide ඔබ සමඟ සම්බන්ධ වේ." : "ආයුබෝවන්! ඔබගේ ප්‍රශ්නය සිංහලෙන් හෝ English වලින් කෙටියෙන් ලියන්න.";
  await db.insert(supportMessages).values({ conversationId: conversation.id, senderType: "SYSTEM", body: welcome });
  if (channel === "HUMAN" && onlineAgents.length) await db.insert(notifications).values(onlineAgents.map((agent) => ({ userId: agent.id, type: "SUPPORT_WAITING", title: "Customer needs human support", message: `${input.name || "Visitor"} සමඟ chat කිරීමට I CAN HELP ඔබන්න.` })));
  response.status(201).json({ id: conversation.id, token: rawToken, status, humanOnline, message: welcome });
}));

supportRouter.post("/public/support/conversations/:id/messages", asyncRoute(async (request, response) => {
  limit(request); const input = messageInput.parse(request.body); const db = requireDatabase();
  const [conversation] = await db.select().from(supportConversations).where(and(eq(supportConversations.id, String(request.params.id)), eq(supportConversations.publicTokenHash, tokenHash(input.token)))).limit(1);
  if (!conversation) throw new HttpError(404, "Support chat එක සොයාගත නොහැක."); if (conversation.status === "CLOSED") throw new HttpError(409, "මෙම chat එක අවසන් කර ඇත.");
  const [sent] = await db.insert(supportMessages).values({ conversationId: conversation.id, senderType: "VISITOR", body: input.message }).returning();
  await db.update(supportConversations).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(supportConversations.id, conversation.id));
  let bot = null; if (conversation.channel === "FAQ") { [bot] = await db.insert(supportMessages).values({ conversationId: conversation.id, senderType: "BOT", body: faqAnswer(input.message) }).returning(); }
  response.status(201).json({ message: sent, bot });
}));

supportRouter.get("/public/support/conversations/:id", asyncRoute(async (request, response) => {
  limit(request); const input = tokenInput.parse(request.query); const db = requireDatabase();
  const [conversation] = await db.select().from(supportConversations).where(and(eq(supportConversations.id, String(request.params.id)), eq(supportConversations.publicTokenHash, tokenHash(input.token)))).limit(1);
  if (!conversation) throw new HttpError(404, "Support chat එක සොයාගත නොහැක.");
  const messages = await db.select().from(supportMessages).where(eq(supportMessages.conversationId, conversation.id)).orderBy(supportMessages.createdAt);
  let agentName: string | null = null; if (conversation.assignedTo) { const [agent] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, conversation.assignedTo)); agentName = agent?.name ?? null; }
  response.json({ conversation: { ...conversation, publicTokenHash: undefined, agentName }, messages });
}));

supportRouter.post("/support/heartbeat", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const db = requireDatabase();
  await db.insert(supportAgentPresence).values({ userId: user.id, lastSeenAt: new Date() }).onConflictDoUpdate({ target: supportAgentPresence.userId, set: { lastSeenAt: new Date() } }); response.status(204).end();
}));

supportRouter.get("/support/queue", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const db = requireDatabase();
  const rows = await db.select().from(supportConversations).where(or(eq(supportConversations.status, "WAITING"), and(eq(supportConversations.assignedTo, user.id), inArray(supportConversations.status, ["CLAIMED", "OPEN"])))).orderBy(desc(supportConversations.lastMessageAt)).limit(100);
  response.json({ conversations: rows.map(({ publicTokenHash: _secret, ...row }) => ({ ...row, visitorEmail: row.assignedTo === user.id || user.role === "admin" ? row.visitorEmail : null })) });
}));

supportRouter.post("/support/conversations/:id/claim", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const db = requireDatabase();
  const [claimed] = await db.update(supportConversations).set({ assignedTo: user.id, status: "CLAIMED", claimedAt: new Date(), updatedAt: new Date() }).where(and(eq(supportConversations.id, String(request.params.id)), eq(supportConversations.status, "WAITING"), isNull(supportConversations.assignedTo))).returning();
  if (!claimed) throw new HttpError(409, "මෙම customerට වෙනත් guide කෙනෙක් දැනටමත් උදව් කරයි.");
  await db.insert(supportMessages).values({ conversationId: claimed.id, senderType: "SYSTEM", body: `${user.name} Personal Guide ලෙස chat එකට සම්බන්ධ විය.` }); response.json({ conversation: claimed });
}));

supportRouter.get("/support/conversations/:id/messages", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const db = requireDatabase(); const id = String(request.params.id);
  const [conversation] = await db.select().from(supportConversations).where(eq(supportConversations.id, id)); if (!conversation || (user.role !== "admin" && conversation.assignedTo !== user.id)) throw new HttpError(403, "මෙම chat එකට access නැහැ.");
  const messages = await db.select().from(supportMessages).where(eq(supportMessages.conversationId, id)).orderBy(supportMessages.createdAt); response.json({ conversation, messages });
}));

supportRouter.post("/support/conversations/:id/messages", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const body = z.object({ message: z.string().trim().min(1).max(1500) }).parse(request.body); const db = requireDatabase(); const id = String(request.params.id);
  const [conversation] = await db.select().from(supportConversations).where(eq(supportConversations.id, id)); if (!conversation || (user.role !== "admin" && conversation.assignedTo !== user.id)) throw new HttpError(403, "මෙම chat එකට access නැහැ.");
  const [message] = await db.insert(supportMessages).values({ conversationId: id, senderType: "AGENT", senderUserId: user.id, body: body.message }).returning(); await db.update(supportConversations).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(supportConversations.id, id)); response.status(201).json({ message });
}));

supportRouter.post("/support/conversations/:id/close", asyncRoute(async (request, response) => {
  const user = await requireRole(request, ["consultant", "staff", "admin"]); const db = requireDatabase(); const id = String(request.params.id);
  const [closed] = await db.update(supportConversations).set({ status: "CLOSED", closedAt: new Date(), updatedAt: new Date() }).where(and(eq(supportConversations.id, id), user.role === "admin" ? or(eq(supportConversations.assignedTo, user.id), isNull(supportConversations.assignedTo))! : eq(supportConversations.assignedTo, user.id))).returning();
  if (!closed) throw new HttpError(403, "මෙම chat එක close කළ නොහැක."); await db.insert(supportMessages).values({ conversationId: id, senderType: "SYSTEM", body: "Support chat එක අවසන් කර ඇත. ඔබට නැවත උදව් අවශ්‍ය නම් අලුත් chat එකක් ආරම්භ කරන්න." }); response.json({ conversation: closed });
}));

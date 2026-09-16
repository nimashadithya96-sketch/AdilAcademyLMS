import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const payload = path.join(root, "__adil_revision_v46_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");
const qaPath = path.join(root, "server", "modules", "courses", "lesson-q-and-a.ts");
const coursePath = path.join(root, "server", "modules", "courses", "routes.ts");

function fail(message) {
  console.error(`\n❌ v46 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
function replaceOnce(source, oldText, newText, label) {
  const index = source.indexOf(oldText);
  if (index === -1) fail(`${label} patch point not found. No source files were changed.`);
  if (source.indexOf(oldText, index + oldText.length) !== -1) {
    fail(`${label} patch point is ambiguous. No source files were changed.`);
  }
  return source.slice(0, index) + newText + source.slice(index + oldText.length);
}

for (const file of [appPath, schemaPath, serverPath, qaPath, coursePath]) mustExist(file);
for (const file of [
  path.join(payload, "server/modules/revision/student-service.ts"),
  path.join(payload, "server/modules/revision/student-routes.ts"),
  path.join(payload, "client/src/StudentRevisionCenter.tsx"),
  path.join(payload, "client/src/student-revision.css"),
  path.join(payload, "db/migrations/0023_revision_student_system.sql")
]) mustExist(file);

const marker = "ADIL_STUDENT_REVISION_V46";
let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");
let qa = fs.readFileSync(qaPath, "utf8");
let course = fs.readFileSync(coursePath, "utf8");

if (!app.includes("ADIL_REVISION_MANAGER_V45") || !schema.includes("ADIL_REVISION_MANAGER_V45") || !server.includes("ADIL_REVISION_MANAGER_V45")) {
  fail("Revision Manager v45 is not detected. Apply/test v45 first.");
}

const alreadyApplied = app.includes(marker) && schema.includes(marker) && server.includes(marker);

if (!alreadyApplied) {
  const appImportPoint = 'import RevisionAdminManager from "./RevisionAdminManager"; // ADIL_REVISION_MANAGER_V45';
  const studentNavPoint = '    { label: "My Course", icon: <BookOpen /> },\n    { label: "Progress", icon: <BarChart3 /> },';
  const studentWorkspacePoint = '  if (module === "Q & A") return <StudentQAndAWorkspace />;\n  if (module === "Balance Payment") return <StudentBalancePaymentWorkspace />;';
  const serverImportPoint = 'import { revisionRouter } from "./modules/revision/routes"; // ADIL_REVISION_MANAGER_V45';
  const serverMountPoint = 'app.use("/api", revisionRouter);\napp.use("/api", lessonQandARouter);';
  const qaImportPoint = 'import { asyncRoute } from "../../lib/http";';
  const qaResponsePoint = `    response.json({\n      answer: {\n        ...answer,\n        correctOption: question.correctOption,\n        explanation: question.explanation\n      },\n      completedAttempt\n    });`;
  const courseImportPoint = 'import { deletePrivateFile, downloadPrivateFile, uploadPrivateFile } from "../../services/storage";';
  const courseResponsePoint = `    response.json({\n      progress: saved,\n      acceptedSeconds,\n      durationSeconds: effectiveDurationSeconds\n    });`;

  for (const [source, point, label] of [
    [app, appImportPoint, "App revision import"],
    [app, studentNavPoint, "Student navigation"],
    [app, studentWorkspacePoint, "Student workspace"],
    [server, serverImportPoint, "Server revision import"],
    [server, serverMountPoint, "Server revision mount"],
    [qa, qaImportPoint, "Q&A service import"],
    [qa, qaResponsePoint, "Q&A completion response"],
    [course, courseImportPoint, "Course revision service import"],
    [course, courseResponsePoint, "Course progress response"]
  ]) {
    if (!source.includes(point)) fail(`${label} patch point not found.`);
  }

  app = replaceOnce(
    app,
    appImportPoint,
    `${appImportPoint}\nimport StudentRevisionCenter from "./StudentRevisionCenter"; // ${marker}`,
    "App revision import"
  );
  app = replaceOnce(
    app,
    studentNavPoint,
    '    { label: "My Course", icon: <BookOpen /> },\n    { label: "Revision", icon: <GraduationCap /> },\n    { label: "Progress", icon: <BarChart3 /> },',
    "Student navigation"
  );
  app = replaceOnce(
    app,
    studentWorkspacePoint,
    '  if (module === "Q & A") return <StudentQAndAWorkspace />;\n  if (module === "Balance Payment") return <StudentBalancePaymentWorkspace />;\n  if (module === "Revision") return <StudentRevisionCenter VideoPlayer={ProtectedVideoPlayer} />;',
    "Student workspace"
  );

  server = replaceOnce(
    server,
    serverImportPoint,
    `${serverImportPoint}\nimport { revisionStudentRouter } from "./modules/revision/student-routes"; // ${marker}`,
    "Server revision import"
  );
  server = replaceOnce(
    server,
    serverMountPoint,
    'app.use("/api", revisionRouter);\napp.use("/api", revisionStudentRouter);\napp.use("/api", lessonQandARouter);',
    "Server revision mount"
  );

  qa = replaceOnce(
    qa,
    qaImportPoint,
    `${qaImportPoint}\nimport { ensureRevisionEligibilityState } from "../revision/student-service"; // ${marker}`,
    "Q&A service import"
  );
  qa = replaceOnce(
    qa,
    qaResponsePoint,
    `    const revisionUnlock = completedAttempt?.completedAt\n      ? await ensureRevisionEligibilityState(db, user.id)\n      : null;\n    response.json({\n      answer: {\n        ...answer,\n        correctOption: question.correctOption,\n        explanation: question.explanation\n      },\n      completedAttempt,\n      revisionUnlock: revisionUnlock\n        ? { newlyUnlocked: revisionUnlock.newlyUnlocked, eligible: revisionUnlock.eligibility.eligible }\n        : null\n    });`,
    "Q&A completion response"
  );

  course = replaceOnce(
    course,
    courseImportPoint,
    `${courseImportPoint}\nimport { ensureRevisionEligibilityState } from "../revision/student-service"; // ${marker}`,
    "Course revision service import"
  );
  course = replaceOnce(
    course,
    courseResponsePoint,
    `    const revisionUnlock = progressPercent >= 100\n      ? await ensureRevisionEligibilityState(db, user.id)\n      : null;\n    response.json({\n      progress: saved,\n      acceptedSeconds,\n      durationSeconds: effectiveDurationSeconds,\n      revisionUnlock: revisionUnlock\n        ? { newlyUnlocked: revisionUnlock.newlyUnlocked, eligible: revisionUnlock.eligibility.eligible }\n        : null\n    });`,
    "Course progress response"
  );

  const schemaBlock = `\n\n// ${marker}: per-student Revision access, daily batches and watch progress.\nexport const revisionStudentAccess = pgTable(\n  "revision_student_access",\n  {\n    id: uuid("id").defaultRandom().primaryKey(),\n    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),\n    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),\n    revisionUnlockedAt: timestamp("revision_unlocked_at", { withTimezone: true }).defaultNow().notNull(),\n    welcomeSeenAt: timestamp("welcome_seen_at", { withTimezone: true }),\n    advancedUnlockedAt: timestamp("advanced_unlocked_at", { withTimezone: true }),\n    advancedCongratulationsSeenAt: timestamp("advanced_congratulations_seen_at", { withTimezone: true }),\n    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()\n  },\n  (table) => [uniqueIndex("revision_student_access_user_course_unique").on(table.userId, table.courseId)]\n);\n\nexport const revisionStudentLevelState = pgTable(\n  "revision_student_level_state",\n  {\n    id: uuid("id").defaultRandom().primaryKey(),\n    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),\n    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),\n    level: text("level").notNull(),\n    batchStartPosition: integer("batch_start_position").default(1).notNull(),\n    batchUnlockedAt: timestamp("batch_unlocked_at", { withTimezone: true }).defaultNow().notNull(),\n    rolloverMidnight: timestamp("rollover_midnight", { withTimezone: true }),\n    midnightActiveSlot: integer("midnight_active_slot"),\n    nextBatchUnlockAt: timestamp("next_batch_unlock_at", { withTimezone: true }),\n    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()\n  },\n  (table) => [uniqueIndex("revision_student_level_state_unique").on(table.userId, table.courseId, table.level)]\n);\n\nexport const revisionVideoProgress = pgTable(\n  "revision_video_progress",\n  {\n    id: uuid("id").defaultRandom().primaryKey(),\n    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),\n    videoId: uuid("video_id").notNull().references(() => revisionVideos.id, { onDelete: "cascade" }),\n    progressPercent: integer("progress_percent").default(0).notNull(),\n    watchedSeconds: integer("watched_seconds").default(0).notNull(),\n    resumeSeconds: integer("resume_seconds").default(0).notNull(),\n    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),\n    reachedEightyAt: timestamp("reached_eighty_at", { withTimezone: true }),\n    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),\n    completedAt: timestamp("completed_at", { withTimezone: true }),\n    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()\n  },\n  (table) => [uniqueIndex("revision_video_progress_user_video_unique").on(table.userId, table.videoId)]\n);\n`;
  schema += schemaBlock;
}

const backupDir = path.join(root, "backup", "student-revision-v46");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, schemaPath, serverPath, qaPath, coursePath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v46`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!alreadyApplied) {
  fs.writeFileSync(appPath, app);
  fs.writeFileSync(schemaPath, schema);
  fs.writeFileSync(serverPath, server);
  fs.writeFileSync(qaPath, qa);
  fs.writeFileSync(coursePath, course);
}

const copies = [
  ["server/modules/revision/student-service.ts", "server/modules/revision/student-service.ts"],
  ["server/modules/revision/student-routes.ts", "server/modules/revision/student-routes.ts"],
  ["client/src/StudentRevisionCenter.tsx", "client/src/StudentRevisionCenter.tsx"],
  ["client/src/student-revision.css", "client/src/student-revision.css"],
  ["db/migrations/0023_revision_student_system.sql", "db/migrations/0023_revision_student_system.sql"]
];
for (const [from, to] of copies) {
  const source = path.join(payload, from);
  const target = path.join(root, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${path.basename(target)}.before-v46`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${to}`);
}

console.log("\n✅ ADIL ACADEMY Student Revision System v46 source update applied.");
console.log("v45 Admin Revision Manager remains intact.");
console.log("Normal payments, OTP, consultant, commission and payout logic was not changed.");
console.log("\nNEXT: node ./ensure-student-revision-v46.mjs");
console.log("Then: npm run check && npm run build");

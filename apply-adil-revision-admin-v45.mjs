import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const payload = path.join(root, "__adil_revision_v45_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");

function fail(message) {
  console.error(`\n❌ v45 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} හමු වුණේ නැහැ.`);
}
function replaceOnce(source, oldText, newText, label) {
  const index = source.indexOf(oldText);
  if (index === -1) fail(`${label} patch point එක හමු වුණේ නැහැ. Existing project වෙනස් කරලා නැහැ.`);
  return source.slice(0, index) + newText + source.slice(index + oldText.length);
}

for (const file of [appPath, schemaPath, serverPath]) mustExist(file);
for (const file of [
  path.join(payload, "server/modules/revision/routes.ts"),
  path.join(payload, "client/src/RevisionAdminManager.tsx"),
  path.join(payload, "client/src/revision-admin.css"),
  path.join(payload, "db/migrations/0022_revision_manager_foundation.sql")
]) mustExist(file);

const marker = "ADIL_REVISION_MANAGER_V45";
let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

const alreadyApplied = app.includes(marker) && schema.includes(marker) && server.includes(marker);
if (alreadyApplied) {
  console.log("ℹ️ Revision Manager v45 source patch is already applied. New payload files will be refreshed only.");
} else {
  // Validate all patch points BEFORE writing anything.
  const appImportPoint = 'import { sriLankaLocations, sriLankaProvinces } from "./sri-lanka-locations";';
  const navPoint = '    { label: "Course", icon: <BookOpen /> },\n    { label: "Students", icon: <Users /> },';
  const workspacePoint = '  if (role === "admin" && module === "Course") return <CourseManagementWorkspace />;\n  if (role === "admin" && module === "Commissions") return <AdminCommissionWorkspace />;';
  const serverImportPoint = 'import { courseRouter } from "./modules/courses/routes";';
  const serverMountPoint = 'app.use("/api", courseRouter);\napp.use("/api", lessonQandARouter);';

  for (const [source, point, label] of [
    [app, appImportPoint, "App import"],
    [app, navPoint, "Admin navigation"],
    [app, workspacePoint, "Admin workspace"],
    [server, serverImportPoint, "Server import"],
    [server, serverMountPoint, "Server router mount"]
  ]) {
    if (!source.includes(point)) fail(`${label} patch point එක හමු වුණේ නැහැ.`);
  }

  app = replaceOnce(
    app,
    appImportPoint,
    `${appImportPoint}\nimport RevisionAdminManager from "./RevisionAdminManager"; // ${marker}`,
    "App import"
  );
  app = replaceOnce(
    app,
    navPoint,
    '    { label: "Course", icon: <BookOpen /> },\n    { label: "Revision Manager", icon: <GraduationCap /> },\n    { label: "Students", icon: <Users /> },',
    "Admin navigation"
  );
  app = replaceOnce(
    app,
    workspacePoint,
    '  if (role === "admin" && module === "Course") return <CourseManagementWorkspace />;\n  if (role === "admin" && module === "Revision Manager") return <RevisionAdminManager />;\n  if (role === "admin" && module === "Commissions") return <AdminCommissionWorkspace />;',
    "Admin workspace"
  );

  server = replaceOnce(
    server,
    serverImportPoint,
    `${serverImportPoint}\nimport { revisionRouter } from "./modules/revision/routes"; // ${marker}`,
    "Server import"
  );
  server = replaceOnce(
    server,
    serverMountPoint,
    'app.use("/api", courseRouter);\napp.use("/api", revisionRouter);\napp.use("/api", lessonQandARouter);',
    "Server router mount"
  );

  const schemaBlock = `\n\n// ${marker}: standalone Basic / Advanced Revision content foundation.\nexport const revisionSeries = pgTable(\n  "revision_series",\n  {\n    id: uuid("id").defaultRandom().primaryKey(),\n    courseId: uuid("course_id")\n      .notNull()\n      .references(() => courses.id, { onDelete: "cascade" }),\n    level: text("level").notNull(),\n    isComplete: boolean("is_complete").default(false).notNull(),\n    completedAt: timestamp("completed_at", { withTimezone: true }),\n    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()\n  },\n  (table) => [uniqueIndex("revision_series_course_level_unique").on(table.courseId, table.level)]\n);\n\nexport const revisionVideos = pgTable("revision_videos", {\n  id: uuid("id").defaultRandom().primaryKey(),\n  seriesId: uuid("series_id")\n    .notNull()\n    .references(() => revisionSeries.id, { onDelete: "cascade" }),\n  title: text("title").notNull(),\n  videoProvider: text("video_provider"),\n  videoId: text("video_id"),\n  content: text("content"),\n  durationSeconds: integer("duration_seconds").default(0).notNull(),\n  position: integer("position").notNull(),\n  isPublished: boolean("is_published").default(false).notNull(),\n  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()\n});\n`;
  schema += schemaBlock;
}

const backupDir = path.join(root, "backup", "revision-manager-v45");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, schemaPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v45`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!alreadyApplied) {
  fs.writeFileSync(appPath, app);
  fs.writeFileSync(schemaPath, schema);
  fs.writeFileSync(serverPath, server);
}

const copies = [
  ["server/modules/revision/routes.ts", "server/modules/revision/routes.ts"],
  ["client/src/RevisionAdminManager.tsx", "client/src/RevisionAdminManager.tsx"],
  ["client/src/revision-admin.css", "client/src/revision-admin.css"],
  ["db/migrations/0022_revision_manager_foundation.sql", "db/migrations/0022_revision_manager_foundation.sql"]
];
for (const [from, to] of copies) {
  const source = path.join(payload, from);
  const target = path.join(root, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${path.basename(target)}.before-v45`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${to}`);
}

console.log("\n✅ ADIL ACADEMY Revision Foundation + Admin Revision Manager v45 source update applied.");
console.log("Unrelated student, payment, OTP, consultant, payout and normal course logic was not changed.");
console.log("\nNEXT: node ./ensure-revision-foundation-v45.mjs");
console.log("Then: npm run check && npm run build");

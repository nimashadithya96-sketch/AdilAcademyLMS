import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const payload = path.join(root, "__adil_student_learning_analytics_v52_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");
const marker = "ADIL_STUDENT_LEARNING_ANALYTICS_V52";

const componentSource = path.join(payload, "client/src/StudentLearningAnalyticsWorkspace.tsx");
const cssSource = path.join(payload, "client/src/student-learning-analytics.css");
const routeSource = path.join(payload, "server/modules/admin/student-learning-analytics.ts");

const componentTarget = path.join(root, "client", "src", "StudentLearningAnalyticsWorkspace.tsx");
const cssTarget = path.join(root, "client", "src", "student-learning-analytics.css");
const routeTarget = path.join(root, "server", "modules", "admin", "student-learning-analytics.ts");

function fail(message) {
  console.error(`\n❌ v52 FIX stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [appPath, schemaPath, serverPath, componentSource, cssSource, routeSource]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

let app = fs.readFileSync(appPath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

if (!schema.includes("export const revisionSeries") || !schema.includes("export const revisionVideoProgress")) {
  fail("Revision v45/v46 schema is not detected. Apply/test the Revision updates first.");
}

/* Validate anchors BEFORE writing anything. */
const appImportCandidates = [
  'import AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel";',
  'import HalfPaymentStudentsWorkspace from "./HalfPaymentStudentsWorkspace";',
  'import StudentRevisionCenter from "./StudentRevisionCenter";',
  'import RevisionAdminManager from "./RevisionAdminManager";'
];
const appImportAnchor = appImportCandidates.find((candidate) => app.includes(candidate));
if (!appImportAnchor) fail("Client import anchor not found.");

const adminStart = app.indexOf("  admin: [");
if (adminStart === -1) fail("Admin navigation block not found.");
const adminEnd = app.indexOf("\n  ]", adminStart);
if (adminEnd === -1) fail("Admin navigation block end not found.");
const studentsNav = '    { label: "Students", icon: <Users /> },';
const studentsNavPos = app.indexOf(studentsNav, adminStart);
if (studentsNavPos === -1 || studentsNavPos > adminEnd) fail("Admin Students navigation item not found.");

const featureStart = app.indexOf("function FeatureWorkspace(");
if (featureStart === -1) fail("FeatureWorkspace function not found.");
const workspaceCandidates = [
  '  if (role === "admin" && module === "Half Payment Students") return <HalfPaymentStudentsWorkspace />;',
  '  if (role === "admin" && module === "Revision Manager") return <RevisionAdminManager />;',
  '  if (role === "admin" && module === "Course") return <CourseManagementWorkspace />;'
];
const workspaceAnchor = workspaceCandidates.find((candidate) => {
  const pos = app.indexOf(candidate, featureStart);
  return pos !== -1;
});
if (!workspaceAnchor) fail("Admin workspace route anchor not found.");

const serverImportCandidates = [
  'import { adminAdmissionHeroesRouter } from "./modules/admin/admission-heroes";',
  'import { halfPaymentAdminRouter } from "./modules/platform/half-payment-students";',
  'import { revisionStudentRouter } from "./modules/revision/student-routes";',
  'import { revisionRouter } from "./modules/revision/routes";'
];
const serverImportAnchor = serverImportCandidates.find((candidate) => server.includes(candidate));
if (!serverImportAnchor) fail("Server import anchor not found.");

const apiFallback = 'app.use("/api", (_request, response) => {';
const apiFallbackPos = server.indexOf(apiFallback);
if (apiFallbackPos === -1) fail("Server API fallback anchor not found.");

/* Patch client import. */
if (!app.includes('import StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace";')) {
  const lineEnd = app.indexOf("\n", app.indexOf(appImportAnchor));
  app = app.slice(0, lineEnd) + `\nimport StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace"; // ${marker}` + app.slice(lineEnd);
}

/* Recalculate nav positions after import insertion. */
const freshAdminStart = app.indexOf("  admin: [");
const freshAdminEnd = app.indexOf("\n  ]", freshAdminStart);
const freshAdminBlock = app.slice(freshAdminStart, freshAdminEnd);
if (!freshAdminBlock.includes('{ label: "Student Learning Analytics", icon: <BarChart3 /> }')) {
  const pos = app.indexOf(studentsNav, freshAdminStart);
  if (pos === -1 || pos > freshAdminEnd) fail("Admin Students navigation item moved unexpectedly.");
  const insertAt = pos + studentsNav.length;
  app = app.slice(0, insertAt) + `\n    { label: "Student Learning Analytics", icon: <BarChart3 /> }, // ${marker}` + app.slice(insertAt);
}

/* Patch FeatureWorkspace directly by exact route anchor. Do NOT use the old broken `indexOf("\\n}")` signature logic. */
if (!app.includes('module === "Student Learning Analytics"')) {
  const freshFeatureStart = app.indexOf("function FeatureWorkspace(");
  const routeAnchorPos = app.indexOf(workspaceAnchor, freshFeatureStart);
  if (routeAnchorPos === -1) fail("Admin workspace route anchor moved unexpectedly.");
  const insertAt = routeAnchorPos + workspaceAnchor.length;
  app = app.slice(0, insertAt) + `\n  if (role === "admin" && module === "Student Learning Analytics") return <StudentLearningAnalyticsWorkspace />; // ${marker}` + app.slice(insertAt);
}

/* Patch server import. */
if (!server.includes('import { adminStudentLearningAnalyticsRouter } from "./modules/admin/student-learning-analytics";')) {
  const importStart = server.indexOf(serverImportAnchor);
  const lineEnd = server.indexOf("\n", importStart);
  server = server.slice(0, lineEnd) + `\nimport { adminStudentLearningAnalyticsRouter } from "./modules/admin/student-learning-analytics"; // ${marker}` + server.slice(lineEnd);
}

/* Mount before the API fallback so it can never be swallowed by 404 fallback. */
if (!server.includes('app.use("/api", adminStudentLearningAnalyticsRouter);')) {
  const fallbackPos = server.indexOf(apiFallback);
  if (fallbackPos === -1) fail("Server API fallback moved unexpectedly.");
  server = server.slice(0, fallbackPos) + 'app.use("/api", adminStudentLearningAnalyticsRouter);\n' + server.slice(fallbackPos);
}

const backupDir = path.join(root, "backup", "student-learning-analytics-v52-fixed");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v52-fixed`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(serverPath, server);

for (const [source, target] of [
  [componentSource, componentTarget],
  [cssSource, cssTarget],
  [routeSource, routeTarget]
]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${path.basename(target)}.before-v52-fixed`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${path.relative(root, target)}`);
}

console.log("\n✅ ADIL ACADEMY Student Learning Analytics v52 FIXED applied.");
console.log("✓ Corrected Admin workspace routing patch");
console.log("✓ Live DB totals — no hard-coded video counts");
console.log("✓ Basic Theory + Basic Revision + Advanced Revision");
console.log("✓ Learning Progress separate from Q&A Knowledge Check");
console.log("✓ SR/CN/name/email/phone search");
console.log("✓ 15-second auto refresh while a student profile is open");
console.log("✓ No database migration required");

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
  console.error(`\n❌ v52 stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [appPath, schemaPath, serverPath, componentSource, cssSource, routeSource]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

if (
  !schema.includes("ADIL_REVISION_MANAGER_V45") ||
  !schema.includes("ADIL_STUDENT_REVISION_V46")
) {
  fail("Revision v45/v46 schema is not detected. Apply/test the Revision updates first.");
}

/* Validate all required patch areas before any write. */
const adminStart = app.indexOf("  admin: [");
if (adminStart === -1) fail("Admin navigation block not found.");
const adminEnd = app.indexOf("\n  ]", adminStart);
if (adminEnd === -1) fail("Admin navigation block end not found.");
const adminBlock = app.slice(adminStart, adminEnd);

if (!adminBlock.includes('{ label: "Students", icon: <Users /> }')) {
  fail("Admin Students navigation item not found.");
}

const featureStart = app.indexOf("function FeatureWorkspace(");
if (featureStart === -1) fail("FeatureWorkspace function not found.");
const featureEnd = app.indexOf("\n}", featureStart);
if (featureEnd === -1) fail("FeatureWorkspace end not found.");
const featureBlock = app.slice(featureStart, featureEnd);

const appImportCandidates = [
  'import AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel";',
  'import HalfPaymentStudentsWorkspace from "./HalfPaymentStudentsWorkspace";',
  'import StudentRevisionCenter from "./StudentRevisionCenter";',
  'import RevisionAdminManager from "./RevisionAdminManager";'
];
const appImportAnchor = appImportCandidates.find((candidate) => app.includes(candidate));
if (!appImportAnchor) fail("Client import anchor not found.");

const serverImportCandidates = [
  'import { adminAdmissionHeroesRouter } from "./modules/admin/admission-heroes";',
  'import { revisionStudentRouter } from "./modules/revision/student-routes";',
  'import { revisionRouter } from "./modules/revision/routes";',
  'import { platformRouter } from "./modules/platform/routes";'
];
const serverImportAnchor = serverImportCandidates.find((candidate) => server.includes(candidate));
if (!serverImportAnchor) fail("Server import anchor not found.");

const apiFallback = 'app.use("/api", (_request, response) => {';
if (!server.includes(apiFallback)) fail("Server API fallback anchor not found.");

const alreadyApplied =
  app.includes(marker) &&
  server.includes(marker) &&
  fs.existsSync(componentTarget) &&
  fs.existsSync(routeTarget);

if (!alreadyApplied) {
  if (!app.includes('import StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace";')) {
    app = app.replace(
      appImportAnchor,
      `${appImportAnchor}\nimport StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace"; // ${marker}`
    );
  }

  /* Recalculate nav positions after import patch. */
  const freshAdminStart = app.indexOf("  admin: [");
  const freshAdminEnd = app.indexOf("\n  ]", freshAdminStart);
  const freshAdminBlock = app.slice(freshAdminStart, freshAdminEnd);

  if (!freshAdminBlock.includes('{ label: "Student Learning Analytics", icon: <BarChart3 /> }')) {
    const navAnchor = '    { label: "Students", icon: <Users /> },';
    const navPos = app.indexOf(navAnchor, freshAdminStart);
    if (navPos === -1 || navPos > freshAdminEnd) fail("Admin Students nav anchor not found.");
    const insertAt = navPos + navAnchor.length;
    app =
      app.slice(0, insertAt) +
      `\n    { label: "Student Learning Analytics", icon: <BarChart3 /> }, // ${marker}` +
      app.slice(insertAt);
  }

  /* Recalculate workspace positions after nav patch. */
  const freshFeatureStart = app.indexOf("function FeatureWorkspace(");
  const freshFeatureEnd = app.indexOf("\n}", freshFeatureStart);
  const freshFeatureBlock = app.slice(freshFeatureStart, freshFeatureEnd);

  if (!freshFeatureBlock.includes('module === "Student Learning Analytics"')) {
    const workspaceCandidates = [
      '  if (role === "admin" && module === "Half Payment Students") return <HalfPaymentStudentsWorkspace />;',
      '  if (role === "admin" && module === "Admission Heroes") return <AdminAdmissionHeroesPanel />;',
      '  if (role === "admin" && module === "Course") return <CourseManagementWorkspace />;'
    ];
    const workspaceAnchor = workspaceCandidates.find((candidate) =>
      freshFeatureBlock.includes(candidate)
    );
    if (!workspaceAnchor) fail("Admin workspace route anchor not found.");
    const workspacePos = app.indexOf(workspaceAnchor, freshFeatureStart);
    const insertAt = workspacePos + workspaceAnchor.length;
    app =
      app.slice(0, insertAt) +
      `\n  if (role === "admin" && module === "Student Learning Analytics") return <StudentLearningAnalyticsWorkspace />; // ${marker}` +
      app.slice(insertAt);
  }

  if (!server.includes('import { adminStudentLearningAnalyticsRouter } from "./modules/admin/student-learning-analytics";')) {
    server = server.replace(
      serverImportAnchor,
      `${serverImportAnchor}\nimport { adminStudentLearningAnalyticsRouter } from "./modules/admin/student-learning-analytics"; // ${marker}`
    );
  }

  /* Recalculate API fallback position after import patch. */
  const fallbackIndex = server.indexOf(apiFallback);
  if (fallbackIndex === -1) fail("Server API fallback anchor moved unexpectedly.");

  if (!server.includes('app.use("/api", adminStudentLearningAnalyticsRouter);')) {
    server =
      server.slice(0, fallbackIndex) +
      'app.use("/api", adminStudentLearningAnalyticsRouter);\n' +
      server.slice(fallbackIndex);
  }
}

const backupDir = path.join(root, "backup", "student-learning-analytics-v52");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v52`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!alreadyApplied) {
  fs.writeFileSync(appPath, app);
  fs.writeFileSync(serverPath, server);
}

for (const [source, target] of [
  [componentSource, componentTarget],
  [cssSource, cssTarget],
  [routeSource, routeTarget]
]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${path.basename(target)}.before-v52`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${path.relative(root, target)}`);
}

console.log("\n✅ ADIL ACADEMY Student Learning Analytics v52 applied.");
console.log("✓ Live DB totals — no hard-coded video counts");
console.log("✓ Basic Theory + Basic Revision + Advanced Revision");
console.log("✓ Learning Progress separate from Q&A Knowledge Check");
console.log("✓ SR/CN/name/email/phone search");
console.log("✓ 15-second auto refresh while a student profile is open");
console.log("✓ No database migration required");
console.log("✓ No payment, consultant, payout, video unlock or Revision progression logic was changed");

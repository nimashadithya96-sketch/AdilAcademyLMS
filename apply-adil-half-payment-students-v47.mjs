import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const payload = path.join(root, "__adil_half_payment_v47_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const serverPath = path.join(root, "server", "index.ts");

function fail(message) {
  console.error(`\n❌ v47 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
function insertAfter(source, anchor, addition, label) {
  const index = source.indexOf(anchor);
  if (index === -1) fail(`${label} patch point not found. No source files were changed.`);
  return source.slice(0, index + anchor.length) + addition + source.slice(index + anchor.length);
}
function insertBefore(source, anchor, addition, label) {
  const index = source.indexOf(anchor);
  if (index === -1) fail(`${label} patch point not found. No source files were changed.`);
  return source.slice(0, index) + addition + source.slice(index);
}

for (const file of [appPath, serverPath]) mustExist(file);
for (const file of [
  path.join(payload, "client/src/HalfPaymentStudentsWorkspace.tsx"),
  path.join(payload, "client/src/half-payment-students.css"),
  path.join(payload, "server/modules/platform/half-payment-students.ts")
]) mustExist(file);

const marker = "ADIL_HALF_PAYMENT_STUDENTS_V47";
let app = fs.readFileSync(appPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");
const alreadyApplied = app.includes(marker) && server.includes(marker);

if (!alreadyApplied) {
  const importCandidates = [
    'import StudentRevisionCenter from "./StudentRevisionCenter"; // ADIL_STUDENT_REVISION_V46',
    'import RevisionAdminManager from "./RevisionAdminManager"; // ADIL_REVISION_MANAGER_V45',
    'import { sriLankaLocations, sriLankaProvinces } from "./sri-lanka-locations";'
  ];
  const appImportPoint = importCandidates.find((item) => app.includes(item));
  if (!appImportPoint) fail("App import patch point not found.");

  const adminStart = app.indexOf("  admin: [");
  if (adminStart === -1) fail("Admin navigation block not found.");
  const adminEnd = app.indexOf("  ]", adminStart);
  if (adminEnd === -1) fail("Admin navigation block end not found.");
  const adminBlock = app.slice(adminStart, adminEnd);
  const studentNavLine = '    { label: "Students", icon: <Users /> },';
  if (!adminBlock.includes(studentNavLine)) fail("Admin Students navigation item not found.");

  const workspacePoint = '  if (role === "admin" && ["Students", "Payments", "Consultants", "Network"].includes(module)) return <AdminFeatureWorkspace module={module} />;';
  if (!app.includes(workspacePoint)) fail("Admin workspace patch point not found.");

  const serverImportCandidates = [
    'import { revisionStudentRouter } from "./modules/revision/student-routes"; // ADIL_STUDENT_REVISION_V46',
    'import { revisionRouter } from "./modules/revision/routes"; // ADIL_REVISION_MANAGER_V45',
    'import { platformRouter } from "./modules/platform/routes";'
  ];
  const serverImportPoint = serverImportCandidates.find((item) => server.includes(item));
  if (!serverImportPoint) fail("Server import patch point not found.");

  const serverMountPoint = 'app.use("/api", platformRouter);';
  if (!server.includes(serverMountPoint)) fail("Server router mount patch point not found.");

  app = insertAfter(
    app,
    appImportPoint,
    `\nimport HalfPaymentStudentsWorkspace from "./HalfPaymentStudentsWorkspace"; // ${marker}`,
    "App import"
  );

  const refreshedAdminStart = app.indexOf("  admin: [");
  const refreshedAdminEnd = app.indexOf("  ]", refreshedAdminStart);
  const refreshedBlock = app.slice(refreshedAdminStart, refreshedAdminEnd);
  const navIndexInBlock = refreshedBlock.indexOf(studentNavLine);
  const navAbsoluteEnd = refreshedAdminStart + navIndexInBlock + studentNavLine.length;
  app =
    app.slice(0, navAbsoluteEnd) +
    '\n    { label: "Half Payment Students", icon: <Wallet /> },' +
    app.slice(navAbsoluteEnd);

  app = insertBefore(
    app,
    workspacePoint,
    `  if (role === "admin" && module === "Half Payment Students") return <HalfPaymentStudentsWorkspace />;\n`,
    "Admin workspace"
  );

  server = insertAfter(
    server,
    serverImportPoint,
    `\nimport { halfPaymentAdminRouter } from "./modules/platform/half-payment-students"; // ${marker}`,
    "Server import"
  );
  server = insertBefore(
    server,
    serverMountPoint,
    'app.use("/api", halfPaymentAdminRouter);\n',
    "Server router mount"
  );
}

const backupDir = path.join(root, "backup", "half-payment-students-v47");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v47`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!alreadyApplied) {
  fs.writeFileSync(appPath, app);
  fs.writeFileSync(serverPath, server);
}

const copies = [
  ["client/src/HalfPaymentStudentsWorkspace.tsx", "client/src/HalfPaymentStudentsWorkspace.tsx"],
  ["client/src/half-payment-students.css", "client/src/half-payment-students.css"],
  ["server/modules/platform/half-payment-students.ts", "server/modules/platform/half-payment-students.ts"]
];

for (const [from, to] of copies) {
  const source = path.join(payload, from);
  const target = path.join(root, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${path.basename(target)}.before-v47`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${to}`);
}

console.log("\n✅ ADIL ACADEMY Half Payment Students v47 source update applied.");
console.log("No database migration is required.");
console.log("Existing Students, Payments, Revision, OTP, CCO, commissions and course-access rules were not replaced.");
console.log("\nNEXT: npm run check && npm run build");

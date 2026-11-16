import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const payload = path.join(root, "__adil_admin_admission_heroes_v50_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const cssTarget = path.join(root, "client", "src", "admin-admission-heroes.css");
const componentTarget = path.join(root, "client", "src", "AdminAdmissionHeroesPanel.tsx");
const serverTarget = path.join(root, "server", "modules", "admin", "admission-heroes.ts");
const serverIndex = path.join(root, "server", "index.ts");
const marker = "ADIL_ADMIN_ADMISSION_HEROES_V50";

function fail(message) {
  console.error(`\n❌ v50 stopped safely: ${message}\n`);
  process.exit(1);
}

function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

for (const file of [
  appPath,
  serverIndex,
  path.join(payload, "client/src/AdminAdmissionHeroesPanel.tsx"),
  path.join(payload, "client/src/admin-admission-heroes.css"),
  path.join(payload, "server/modules/admin/admission-heroes.ts")
]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let server = fs.readFileSync(serverIndex, "utf8");

if (!app.includes(marker)) {
  const importCandidates = [
    'import HalfPaymentStudentsWorkspace from "./HalfPaymentStudentsWorkspace";',
    'import StudentRevisionCenter from "./StudentRevisionCenter";',
    'import RevisionAdminManager from "./RevisionAdminManager";',
    'import { sriLankaLocations, sriLankaProvinces } from "./sri-lanka-locations";'
  ];
  const importAnchor = importCandidates.find((candidate) => app.includes(candidate));
  if (!importAnchor) fail("App import anchor not found.");

  const adminFunctionStart = app.indexOf("function AdminDashboard(");
  if (adminFunctionStart === -1) fail("AdminDashboard function not found.");

  const dashboardGridAnchor = '<div className="dashboard-grid">';
  const dashboardGridIndex = app.indexOf(dashboardGridAnchor, adminFunctionStart);
  if (dashboardGridIndex === -1) fail("Admin dashboard content anchor not found.");

  app = app.replace(
    importAnchor,
    `${importAnchor}\nimport AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel"; // ${marker}`
  );

  app =
    app.slice(0, dashboardGridIndex) +
    '      <AdminAdmissionHeroesPanel />\n      ' +
    app.slice(dashboardGridIndex);
}

if (!server.includes(marker)) {
  const importCandidates = [
    'import { halfPaymentAdminRouter } from "./modules/platform/half-payment-students";',
    'import { platformRouter } from "./modules/platform/routes";'
  ];
  const importAnchor = importCandidates.find((candidate) => server.includes(candidate));
  if (!importAnchor) fail("Server import anchor not found.");

  const fallbackAnchor = 'app.use("/api", (_request, response) => {';
  const fallbackIndex = server.indexOf(fallbackAnchor);
  if (fallbackIndex === -1) fail("Server API fallback anchor not found.");

  server = server.replace(
    importAnchor,
    `${importAnchor}\nimport { adminAdmissionHeroesRouter } from "./modules/admin/admission-heroes"; // ${marker}`
  );

  server =
    server.slice(0, fallbackIndex) +
    'app.use("/api", adminAdmissionHeroesRouter);\n' +
    server.slice(fallbackIndex);
}

const backupDir = path.join(root, "backup", "admin-admission-heroes-v50");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, serverIndex]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v50`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

fs.mkdirSync(path.dirname(serverTarget), { recursive: true });

fs.writeFileSync(appPath, app);
fs.writeFileSync(serverIndex, server);
fs.copyFileSync(
  path.join(payload, "client/src/AdminAdmissionHeroesPanel.tsx"),
  componentTarget
);
fs.copyFileSync(
  path.join(payload, "client/src/admin-admission-heroes.css"),
  cssTarget
);
fs.copyFileSync(
  path.join(payload, "server/modules/admin/admission-heroes.ts"),
  serverTarget
);

console.log("✓ Admin Overview now includes Admission Heroes.");
console.log("✓ Read-only Admin Admission Heroes API added.");
console.log("✓ Existing consultant leaderboard logic remains unchanged.");
console.log("✓ No database migration required.");
console.log("\n✅ ADIL ACADEMY Admin Admission Heroes v50 applied.");

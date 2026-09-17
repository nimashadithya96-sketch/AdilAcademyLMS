import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backupDir = path.join(root, "backup", "admin-admission-heroes-v50");
const appPath = path.join(root, "client", "src", "App.tsx");
const serverPath = path.join(root, "server", "index.ts");

const appBackup = path.join(backupDir, "App.tsx.before-v50");
const serverBackup = path.join(backupDir, "index.ts.before-v50");

const componentPath = path.join(root, "client", "src", "AdminAdmissionHeroesPanel.tsx");
const cssPath = path.join(root, "client", "src", "admin-admission-heroes.css");
const routePath = path.join(root, "server", "modules", "admin", "admission-heroes.ts");

const marker = "ADIL_ADMIN_ADMISSION_HEROES_V50";

function fail(message) {
  console.error(`\n❌ v50 repair stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [appPath, serverPath, appBackup, serverBackup, componentPath, cssPath, routePath]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

console.log("Restoring the two files that v50 patched from the automatic v50 backup...");
fs.copyFileSync(appBackup, appPath);
fs.copyFileSync(serverBackup, serverPath);

let app = fs.readFileSync(appPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

/* ---------- Correct App.tsx patch ---------- */
const appImportCandidates = [
  'import HalfPaymentStudentsWorkspace from "./HalfPaymentStudentsWorkspace";',
  'import StudentRevisionCenter from "./StudentRevisionCenter";',
  'import RevisionAdminManager from "./RevisionAdminManager";',
  'import { sriLankaLocations, sriLankaProvinces } from "./sri-lanka-locations";'
];

const appImportAnchor = appImportCandidates.find((candidate) => app.includes(candidate));
if (!appImportAnchor) fail("App import anchor not found.");

if (!app.includes('import AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel";')) {
  app = app.replace(
    appImportAnchor,
    `${appImportAnchor}\nimport AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel"; // ${marker}`
  );
}

/* Recalculate positions AFTER import insertion. */
const adminFunctionStart = app.indexOf("function AdminDashboard(");
if (adminFunctionStart === -1) fail("AdminDashboard function not found.");

const dashboardGridAnchor = '<div className="dashboard-grid">';
const dashboardGridIndex = app.indexOf(dashboardGridAnchor, adminFunctionStart);
if (dashboardGridIndex === -1) fail("Admin dashboard content anchor not found.");

if (!app.slice(adminFunctionStart, dashboardGridIndex).includes("<AdminAdmissionHeroesPanel />")) {
  app =
    app.slice(0, dashboardGridIndex) +
    '      <AdminAdmissionHeroesPanel />\n      ' +
    app.slice(dashboardGridIndex);
}

/* ---------- Correct server/index.ts patch ---------- */
const serverImportCandidates = [
  'import { halfPaymentAdminRouter } from "./modules/platform/half-payment-students";',
  'import { platformRouter } from "./modules/platform/routes";'
];

const serverImportAnchor = serverImportCandidates.find((candidate) => server.includes(candidate));
if (!serverImportAnchor) fail("Server import anchor not found.");

if (!server.includes('import { adminAdmissionHeroesRouter } from "./modules/admin/admission-heroes";')) {
  server = server.replace(
    serverImportAnchor,
    `${serverImportAnchor}\nimport { adminAdmissionHeroesRouter } from "./modules/admin/admission-heroes"; // ${marker}`
  );
}

/* Recalculate mount position AFTER import insertion. */
const fallbackAnchor = 'app.use("/api", (_request, response) => {';
const fallbackIndex = server.indexOf(fallbackAnchor);
if (fallbackIndex === -1) fail("Server API fallback anchor not found.");

if (!server.includes('app.use("/api", adminAdmissionHeroesRouter);')) {
  server =
    server.slice(0, fallbackIndex) +
    'app.use("/api", adminAdmissionHeroesRouter);\n' +
    server.slice(fallbackIndex);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(serverPath, server);

console.log("✓ Restored clean pre-v50 App.tsx and server/index.ts");
console.log("✓ Re-applied Admin Admission Heroes patch using recalculated safe positions");
console.log("✓ Existing v50 component/CSS/API files kept in place");
console.log("\n✅ v50 repair applied.");

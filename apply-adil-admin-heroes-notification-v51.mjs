import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "client", "src", "App.tsx");
const cssPath = path.join(root, "client", "src", "styles.css");
const marker = "ADIL_ADMIN_HEROES_DEDICATED_V51";
const cssMarker = "ADIL_NOTIFICATION_DOCK_V51";

function fail(message) {
  console.error(`\n❌ v51 stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [appPath, cssPath]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!app.includes('import AdminAdmissionHeroesPanel from "./AdminAdmissionHeroesPanel"')) {
  fail("AdminAdmissionHeroesPanel import is missing. Apply/fix v50 first.");
}

/* ---------- Add dedicated Admin sidebar item only inside admin nav ---------- */
if (!app.includes(marker)) {
  const adminStart = app.indexOf("  admin: [");
  if (adminStart === -1) fail("Admin navigation block not found.");

  const adminEnd = app.indexOf("\n  ]", adminStart);
  if (adminEnd === -1) fail("Admin navigation block end not found.");

  const adminBlock = app.slice(adminStart, adminEnd);
  if (!adminBlock.includes('{ label: "Overview", icon: <LayoutDashboard /> }')) {
    fail("Admin Overview navigation item not found.");
  }

  if (!adminBlock.includes('{ label: "Admission Heroes", icon: <Trophy /> }')) {
    const navAnchor = '    { label: "Overview", icon: <LayoutDashboard /> },';
    const navAbsolute = app.indexOf(navAnchor, adminStart);
    if (navAbsolute === -1 || navAbsolute > adminEnd) fail("Admin Overview nav anchor not found.");
    const navInsertAt = navAbsolute + navAnchor.length;

    app =
      app.slice(0, navInsertAt) +
      `\n    { label: "Admission Heroes", icon: <Trophy /> }, // ${marker}` +
      app.slice(navInsertAt);
  }

  /* ---------- Add dedicated Admin workspace route ---------- */
  const featureStart = app.indexOf("function FeatureWorkspace(");
  if (featureStart === -1) fail("FeatureWorkspace function not found.");

  const featureEnd = app.indexOf("\n}", featureStart);
  if (featureEnd === -1) fail("FeatureWorkspace end not found.");

  const featureBlock = app.slice(featureStart, featureEnd);
  if (!featureBlock.includes('role === "admin"')) {
    fail("Admin workspace routing block not found.");
  }

  if (!featureBlock.includes('module === "Admission Heroes"')) {
    const possibleAnchors = [
      '  if (role === "admin" && module === "Half Payment Students") return <HalfPaymentStudentsWorkspace />;',
      '  if (role === "admin" && module === "Course") return <CourseManagementWorkspace />;'
    ];
    const routeAnchor = possibleAnchors.find((candidate) => featureBlock.includes(candidate));
    if (!routeAnchor) fail("Admin workspace route anchor not found.");

    const routeAbsolute = app.indexOf(routeAnchor, featureStart);
    const routeInsertAt = routeAbsolute + routeAnchor.length;

    app =
      app.slice(0, routeInsertAt) +
      `\n  if (role === "admin" && module === "Admission Heroes") return <AdminAdmissionHeroesPanel />; // ${marker}` +
      app.slice(routeInsertAt);
  }
}

/* ---------- Notification panel: dock to right and keep dashboard visible ---------- */
if (!css.includes(cssMarker)) {
  css += `

/* =========================================================
   ${cssMarker}
   Keeps the notification list from covering Admin Overview.
   ========================================================= */
@media (min-width: 1051px) {
  .notification-panel {
    position: fixed !important;
    z-index: 140 !important;
    top: 92px !important;
    right: 22px !important;
    width: 350px !important;
    max-height: calc(100vh - 116px) !important;
    border-color: rgba(139,255,85,.18) !important;
    box-shadow: 0 26px 80px rgba(0,0,0,.46) !important;
  }

  .dashboard-shell:has(.notification-panel) .dashboard-content {
    padding-right: 405px !important;
    transition: padding-right .18s ease;
  }

  .dashboard-shell:has(.notification-panel) .dashboard-welcome {
    max-width: 100%;
  }
}

@media (max-width: 1050px) {
  .notification-panel {
    position: fixed !important;
    z-index: 140 !important;
    top: 74px !important;
    right: 14px !important;
    width: min(360px, calc(100vw - 28px)) !important;
    max-height: calc(100vh - 92px) !important;
  }
}
`;
}

const backupDir = path.join(root, "backup", "admin-heroes-nav-notification-v51");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, cssPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v51`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);

console.log("✓ Admin sidebar: Admission Heroes dedicated tab");
console.log("✓ Admin workspace: dedicated Admission Heroes page");
console.log("✓ Notification panel: right-docked desktop layout");
console.log("✓ Dashboard content shifts left while notifications are open, so balance/cards stay visible");
console.log("\n✅ v51 Admin Heroes navigation + notification layout fix applied.");

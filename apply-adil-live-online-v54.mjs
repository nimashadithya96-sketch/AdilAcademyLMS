import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_LIVE_ONLINE_V54";
const payload = path.join(root, "__adil_live_online_v54_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");

function fail(message) { console.error(`\n❌ v54 stopped safely: ${message}\n`); process.exit(1); }
function mustExist(file) { if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`); }
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. No source files were changed.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) fail(`${label} patch point is ambiguous. No source files were changed.`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

for (const file of [appPath, schemaPath, serverPath,
  path.join(payload, "client/src/LiveOnlineUsersWorkspace.tsx"),
  path.join(payload, "client/src/live-online-users.css"),
  path.join(payload, "server/modules/presence/routes.ts"),
  path.join(payload, "db/migrations/0025_live_online_presence.sql"),
  path.join(payload, "schema-block.txt")]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

const importAnchor = 'import StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace"; // ADIL_STUDENT_LEARNING_ANALYTICS_V52';
const navAnchor = '    { label: "Student Learning Analytics", icon: <BarChart3 /> }, // ADIL_STUDENT_LEARNING_ANALYTICS_V52';
const featureAnchor = '  if (role === "admin" && module === "Student Learning Analytics") return <StudentLearningAnalyticsWorkspace />; // ADIL_STUDENT_LEARNING_ANALYTICS_V52';
const effectiveRoleAnchor = '  const effectiveRole: UserRole = user.role === "consultant" && portalMode === "learning" ? "student" : user.role;';
const serverImportAnchor = 'import { adminStudentLearningAnalyticsRouter } from "./modules/admin/student-learning-analytics"; // ADIL_STUDENT_LEARNING_ANALYTICS_V52';
const serverMountAnchor = 'app.use("/api", adminStudentLearningAnalyticsRouter);';

if (!app.includes(marker)) {
  for (const [anchor, label] of [[importAnchor,"App import"],[navAnchor,"Admin navigation"],[featureAnchor,"Admin workspace"],[effectiveRoleAnchor,"Dashboard heartbeat"]]) {
    if (!app.includes(anchor)) fail(`${label} patch point not found.`);
  }
  app = replaceOnce(app, importAnchor, `${importAnchor}\nimport LiveOnlineUsersWorkspace from "./LiveOnlineUsersWorkspace"; // ${marker}`, "App import");
  app = replaceOnce(app, navAnchor, `${navAnchor}\n    { label: "Live Online", icon: <Users /> }, // ${marker}`, "Admin navigation");
  app = replaceOnce(app, featureAnchor, `${featureAnchor}\n  if (role === "admin" && module === "Live Online") return <LiveOnlineUsersWorkspace />; // ${marker}`, "Admin workspace");
  const heartbeat = `${effectiveRoleAnchor}\n  useEffect(() => { // ${marker}\n    if (!["student", "consultant"].includes(user.role)) return;\n    const heartbeat = () => {\n      if (document.visibilityState !== "visible") return;\n      void fetch("/api/presence/heartbeat", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          module: activeModule,\n          portalMode: user.role === "consultant" ? (portalMode === "learning" ? "learning" : "consultant") : "student"\n        })\n      }).catch(() => undefined);\n    };\n    heartbeat();\n    const timer = window.setInterval(heartbeat, 20_000);\n    document.addEventListener("visibilitychange", heartbeat);\n    return () => {\n      window.clearInterval(timer);\n      document.removeEventListener("visibilitychange", heartbeat);\n    };\n  }, [user.id, user.role, activeModule, portalMode]);`;
  app = replaceOnce(app, effectiveRoleAnchor, heartbeat, "Dashboard heartbeat");
}

if (!schema.includes(marker)) schema += fs.readFileSync(path.join(payload, "schema-block.txt"), "utf8");

if (!server.includes(marker)) {
  if (!server.includes(serverImportAnchor)) fail("Server import patch point not found.");
  if (!server.includes(serverMountAnchor)) fail("Server mount patch point not found.");
  server = replaceOnce(server, serverImportAnchor, `${serverImportAnchor}\nimport { presenceRouter } from "./modules/presence/routes"; // ${marker}`, "Server import");
  server = replaceOnce(server, serverMountAnchor, `${serverMountAnchor}\napp.use("/api", presenceRouter); // ${marker}`, "Server mount");
}

const backupDir = path.join(root, "backup", "live-online-v54");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, schemaPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v54`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(schemaPath, schema);
fs.writeFileSync(serverPath, server);

for (const relative of [
  "client/src/LiveOnlineUsersWorkspace.tsx",
  "client/src/live-online-users.css",
  "server/modules/presence/routes.ts",
  "db/migrations/0025_live_online_presence.sql"
]) {
  const source = path.join(payload, relative);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const backup = path.join(backupDir, `${relative.replaceAll("/", "__")}.before-v54`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${relative}`);
}

console.log("\n✅ ADIL ACADEMY Live Online v54 source update applied.");
console.log("Only authenticated Student/Consultant presence is tracked. Existing course, payment, Revision, CCO and commission logic was not changed.");

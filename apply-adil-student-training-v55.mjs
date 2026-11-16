import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_STUDENT_TRAINING_V55";
const payload = path.join(root, "__adil_student_training_v55_payload");

const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");

function fail(message) {
  console.error(`\n❌ v55 stopped safely: ${message}\n`);
  process.exit(1);
}

function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. No source files were changed.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) {
    fail(`${label} patch point is ambiguous. No source files were changed.`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

const payloadFiles = [
  "client/src/StudentGettingStartedPage.tsx",
  "client/src/TrainingVideosWorkspace.tsx",
  "client/src/student-training-videos.css",
  "server/modules/student-training/routes.ts",
  "db/migrations/0026_student_training_videos.sql",
  "schema-block.txt"
].map((item) => path.join(payload, item));

for (const file of [appPath, schemaPath, serverPath, ...payloadFiles]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

if (!app.includes("ADIL_CCO_SETUP_GUIDE_V53")) {
  fail("CCO Setup Guide v53 was not detected. Apply v53 first, then run v55.");
}

if (!fs.existsSync(path.join(root, "client", "src", "CcoTrainingVideosWorkspace.tsx"))) {
  fail("CcoTrainingVideosWorkspace.tsx not found. Apply v53 first.");
}

const backupDir = path.join(root, "backup", "student-training-v55");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, schemaPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v55`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!app.includes(marker)) {
  const ccoImport = 'import CcoTrainingVideosWorkspace from "./CcoTrainingVideosWorkspace"; // ADIL_CCO_SETUP_GUIDE_V53';
  const oldNav = '    { label: "CCO Training Videos", icon: <GraduationCap /> }, // ADIL_CCO_SETUP_GUIDE_V53';
  const newNavAlready = '    { label: "Training Videos", icon: <GraduationCap /> }, // ADIL_CCO_SETUP_GUIDE_V53 // ADIL_STUDENT_TRAINING_V55';
  const oldWorkspace = '  if (role === "admin" && module === "CCO Training Videos") return <CcoTrainingVideosWorkspace VideoPlayer={ProtectedVideoPlayer} />; // ADIL_CCO_SETUP_GUIDE_V53';
  const newWorkspaceAlready = '  if (role === "admin" && module === "Training Videos") return <TrainingVideosWorkspace VideoPlayer={ProtectedVideoPlayer} />; // ADIL_CCO_SETUP_GUIDE_V53 // ADIL_STUDENT_TRAINING_V55';
  const homeCta = `<Link className="button button-primary" to="/login">
                Start your application <ArrowRight size={18} />
              </Link>`;
  const loginRoute = '      <Route path="/login" element={<LoginPage onLogin={setUser} />} />';
  const ccoServerImport = 'import { ccoSetupGuideRouter } from "./modules/cco-setup-guide/routes"; // ADIL_CCO_SETUP_GUIDE_V53';
  const ccoServerMount = 'app.use("/api", ccoSetupGuideRouter); // ADIL_CCO_SETUP_GUIDE_V53';

  if (!app.includes(ccoImport)) fail("CCO Training import anchor not found.");
  if (!app.includes(oldNav) && !app.includes(newNavAlready)) fail("Admin Training Videos navigation anchor not found.");
  if (!app.includes(oldWorkspace) && !app.includes(newWorkspaceAlready)) fail("Admin Training Videos workspace anchor not found.");
  if (!app.includes(homeCta)) fail("Home Start your application button anchor not found.");
  if (!app.includes(loginRoute)) fail("Login route anchor not found.");
  if (!server.includes(ccoServerImport)) fail("CCO server import anchor not found.");
  if (!server.includes(ccoServerMount)) fail("CCO server mount anchor not found.");

  app = replaceOnce(
    app,
    ccoImport,
    `${ccoImport}
import StudentGettingStartedPage from "./StudentGettingStartedPage"; // ${marker}
import TrainingVideosWorkspace from "./TrainingVideosWorkspace"; // ${marker}`,
    "App imports"
  );

  if (app.includes(oldNav)) {
    app = replaceOnce(
      app,
      oldNav,
      `    { label: "Training Videos", icon: <GraduationCap /> }, // ADIL_CCO_SETUP_GUIDE_V53 // ${marker}`,
      "Admin navigation"
    );
  }

  if (app.includes(oldWorkspace)) {
    app = replaceOnce(
      app,
      oldWorkspace,
      `  if (role === "admin" && module === "Training Videos") return <TrainingVideosWorkspace VideoPlayer={ProtectedVideoPlayer} />; // ADIL_CCO_SETUP_GUIDE_V53 // ${marker}`,
      "Admin workspace"
    );
  }

  app = replaceOnce(
    app,
    homeCta,
    `<Link className="button button-primary" to="/student-getting-started">
                Start your application <ArrowRight size={18} />
              </Link>`,
    "Home Start your application"
  );

  app = replaceOnce(
    app,
    loginRoute,
    `${loginRoute}
      <Route path="/student-getting-started" element={<StudentGettingStartedPage PublicHeader={PublicHeader} VideoPlayer={ProtectedVideoPlayer} />} /> {/* ${marker} */}`,
    "Public Student Getting Started route"
  );

  server = replaceOnce(
    server,
    ccoServerImport,
    `${ccoServerImport}
import { studentTrainingRouter } from "./modules/student-training/routes"; // ${marker}`,
    "Server import"
  );

  server = replaceOnce(
    server,
    ccoServerMount,
    `${ccoServerMount}
app.use("/api", studentTrainingRouter); // ${marker}`,
    "Server mount"
  );

  schema += fs.readFileSync(path.join(payload, "schema-block.txt"), "utf8");

  fs.writeFileSync(appPath, app);
  fs.writeFileSync(schemaPath, schema);
  fs.writeFileSync(serverPath, server);
}

for (const relative of [
  "client/src/StudentGettingStartedPage.tsx",
  "client/src/TrainingVideosWorkspace.tsx",
  "client/src/student-training-videos.css",
  "server/modules/student-training/routes.ts",
  "db/migrations/0026_student_training_videos.sql"
]) {
  const source = path.join(payload, relative);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    const safeName = relative.replaceAll("/", "__");
    const backup = path.join(backupDir, `${safeName}.before-v55`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }

  fs.copyFileSync(source, target);
  console.log(`✓ ${relative}`);
}

console.log("\n✅ ADIL ACADEMY Student Training Videos v55 source update applied.");
console.log("Admin 'CCO Training Videos' is now 'Training Videos' with separate Student Training and CCO Training tabs.");
console.log("Existing CCO Setup Guide data, payments, courses, Revision, consultants and commissions were not changed.");

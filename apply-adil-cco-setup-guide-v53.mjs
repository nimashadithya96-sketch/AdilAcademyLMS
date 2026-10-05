import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_CCO_SETUP_GUIDE_V53";
const payload = path.join(root, "__adil_cco_setup_guide_v53_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");

function fail(message) {
  console.error(`\n❌ v53 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. No source files were changed.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) fail(`${label} patch point is ambiguous. No source files were changed.`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

const payloadFiles = [
  "client/src/CcoSetupGuidePage.tsx",
  "client/src/CcoTrainingVideosWorkspace.tsx",
  "client/src/cco-setup-guide.css",
  "server/modules/cco-setup-guide/routes.ts",
  "db/migrations/0024_cco_setup_guide_videos.sql",
  "schema-block.txt",
  "entry-card.txt"
].map((item) => path.join(payload, item));

for (const file of [appPath, schemaPath, serverPath, ...payloadFiles]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

const importAnchor = 'import StudentLearningAnalyticsWorkspace from "./StudentLearningAnalyticsWorkspace"; // ADIL_STUDENT_LEARNING_ANALYTICS_V52';
const navAnchor = '    { label: "CCO Main Buy", icon: <CircleDollarSign /> },';
const featureAnchor = '  if (role === "admin" && module === "CCO Main Buy") return <AdminCcoMainBuyWorkspace />;';
const routeAnchor = '      <Route path="/cco-main" element={<CcoMainApplicationPage />} />';
const serverImportAnchor = 'import { ccoMainRouter } from "./modules/cco-main/routes";';
const serverMountAnchor = 'app.use("/api", ccoMainRouter);';

if (!app.includes(marker)) {
  for (const [text, label] of [
    [importAnchor, "App import"],
    [navAnchor, "Admin navigation"],
    [featureAnchor, "Admin workspace"],
    [routeAnchor, "Public route"],
    ["function CcoMainApplicationPage()", "CCO Main page"],
    [serverImportAnchor, "Server import"],
    [serverMountAnchor, "Server mount"]
  ]) {
    const source = label.startsWith("Server") ? server : app;
    if (!source.includes(text)) fail(`${label} patch point not found.`);
  }

  app = replaceOnce(
    app,
    importAnchor,
    `${importAnchor}\nimport CcoSetupGuidePage from "./CcoSetupGuidePage"; // ${marker}\nimport CcoTrainingVideosWorkspace from "./CcoTrainingVideosWorkspace"; // ${marker}`,
    "App import"
  );

  app = replaceOnce(
    app,
    navAnchor,
    `${navAnchor}\n    { label: "CCO Training Videos", icon: <GraduationCap /> }, // ${marker}`,
    "Admin navigation"
  );

  app = replaceOnce(
    app,
    featureAnchor,
    `${featureAnchor}\n  if (role === "admin" && module === "CCO Training Videos") return <CcoTrainingVideosWorkspace VideoPlayer={ProtectedVideoPlayer} />; // ${marker}`,
    "Admin workspace"
  );

  app = replaceOnce(
    app,
    routeAnchor,
    `${routeAnchor}\n      <Route path="/cco-main/setup-guide" element={<CcoSetupGuidePage PublicHeader={PublicHeader} VideoPlayer={ProtectedVideoPlayer} />} /> {/* ${marker} */}`,
    "Public route"
  );

  const ccoStart = app.indexOf("function CcoMainApplicationPage()");
  const ccoEnd = app.indexOf("\nfunction ", ccoStart + 20);
  if (ccoStart === -1 || ccoEnd === -1) fail("Could not isolate CCO Main page safely.");
  const block = app.slice(ccoStart, ccoEnd);
  const close = block.lastIndexOf("</main></div>;");
  if (close === -1) fail("CCO Main page closing point not found.");
  if (!block.includes("Special Pay ID verify")) fail("Expected Special Pay ID verification UI was not found.");
  const entryCard = fs.readFileSync(path.join(payload, "entry-card.txt"), "utf8");
  const patchedBlock = block.slice(0, close) + entryCard + block.slice(close);
  app = app.slice(0, ccoStart) + patchedBlock + app.slice(ccoEnd);

  server = replaceOnce(
    server,
    serverImportAnchor,
    `${serverImportAnchor}\nimport { ccoSetupGuideRouter } from "./modules/cco-setup-guide/routes"; // ${marker}`,
    "Server import"
  );

  server = replaceOnce(
    server,
    serverMountAnchor,
    `${serverMountAnchor}\napp.use("/api", ccoSetupGuideRouter); // ${marker}`,
    "Server mount"
  );

  schema += fs.readFileSync(path.join(payload, "schema-block.txt"), "utf8");
}

const backupDir = path.join(root, "backup", "cco-setup-guide-v53");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, schemaPath, serverPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v53`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

if (!fs.readFileSync(appPath, "utf8").includes(marker)) fs.writeFileSync(appPath, app);
if (!fs.readFileSync(schemaPath, "utf8").includes(marker)) fs.writeFileSync(schemaPath, schema);
if (!fs.readFileSync(serverPath, "utf8").includes(marker)) fs.writeFileSync(serverPath, server);

for (const relative of [
  "client/src/CcoSetupGuidePage.tsx",
  "client/src/CcoTrainingVideosWorkspace.tsx",
  "client/src/cco-setup-guide.css",
  "server/modules/cco-setup-guide/routes.ts",
  "db/migrations/0024_cco_setup_guide_videos.sql"
]) {
  const source = path.join(payload, relative);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const safeName = relative.replaceAll("/", "__");
    const backup = path.join(backupDir, `${safeName}.before-v53`);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  console.log(`✓ ${relative}`);
}

console.log("\n✅ ADIL ACADEMY CCO Setup Guide v53 source update applied.");
console.log("Existing Special Pay ID verification, payments, Revision, consultant and commission logic were not changed.");

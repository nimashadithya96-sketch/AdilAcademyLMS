import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_STUDENT_TRAINING_ACCESS_V58";
const payload = path.join(root, "__adil_student_training_access_v58_payload");

const schemaPath = path.join(root, "db", "schema.ts");
const featureFiles = [
  "client/src/StudentGettingStartedPage.tsx",
  "client/src/TrainingVideosWorkspace.tsx",
  "client/src/student-training-videos.css",
  "server/modules/student-training/routes.ts"
];
const migrationRel = "db/migrations/0030_student_training_free_paid_access.sql";

function fail(message) {
  console.error(`\n❌ v58 stopped safely: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "package.json"))) fail("package.json not found. Run from the main Replit project folder.");
if (!fs.existsSync(schemaPath)) fail("db/schema.ts not found.");

for (const rel of featureFiles) {
  if (!fs.existsSync(path.join(root, rel))) fail(`${rel} not found. Student Training v55+ must be installed first.`);
  if (!fs.existsSync(path.join(payload, rel))) fail(`Payload file missing: ${rel}`);
}
if (!fs.existsSync(path.join(payload, migrationRel))) fail("v58 migration payload missing.");

const currentStudentPage = fs.readFileSync(path.join(root, featureFiles[0]), "utf8");
const currentAdminPage = fs.readFileSync(path.join(root, featureFiles[1]), "utf8");
const currentRoutes = fs.readFileSync(path.join(root, featureFiles[3]), "utf8");
if (!currentStudentPage.includes("student-training") && !currentStudentPage.includes("Student Getting Started")) {
  fail("Existing Student Training public page was not detected.");
}
if (!currentAdminPage.includes("StudentTrainingVideosManager")) fail("Existing Student Training admin manager was not detected.");
if (!currentRoutes.includes("studentTrainingRouter")) fail("Existing Student Training API router was not detected.");

const backupDir = path.join(root, "backup", "student-training-free-paid-v58");
fs.mkdirSync(backupDir, { recursive: true });

for (const rel of [...featureFiles, "db/schema.ts"]) {
  const source = path.join(root, rel);
  const safeName = rel.replaceAll("/", "__");
  const backup = path.join(backupDir, `${safeName}.before-v58`);
  if (!fs.existsSync(backup)) fs.copyFileSync(source, backup);
}

for (const rel of featureFiles) {
  const source = path.join(payload, rel);
  const target = path.join(root, rel);
  fs.copyFileSync(source, target);
  console.log(`✓ ${rel}`);
}

let schema = fs.readFileSync(schemaPath, "utf8");
if (!schema.includes('accessType: text("access_type")')) {
  const tableMarker = 'export const studentTrainingVideos = pgTable("student_training_videos", {';
  const start = schema.indexOf(tableMarker);
  if (start === -1) fail("studentTrainingVideos schema block not found.");
  const end = schema.indexOf("\n});", start);
  if (end === -1) fail("studentTrainingVideos schema block end not found.");
  const block = schema.slice(start, end + 4);
  const anchor = '  isPublished: boolean("is_published").default(false).notNull(),';
  if (!block.includes(anchor)) fail("studentTrainingVideos isPublished field anchor not found.");
  const updatedBlock = block.replace(
    anchor,
    `  accessType: text("access_type").default("FREE").notNull(), // ${marker}\n${anchor}`
  );
  schema = schema.slice(0, start) + updatedBlock + schema.slice(end + 4);
  fs.writeFileSync(schemaPath, schema);
  console.log("✓ db/schema.ts access_type field");
} else {
  console.log("✓ db/schema.ts already contains access_type");
}

const migrationTarget = path.join(root, migrationRel);
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.copyFileSync(path.join(payload, migrationRel), migrationTarget);
console.log(`✓ ${migrationRel}`);

console.log("\n✅ ADIL ACADEMY Student Training FREE/PAID v58 source update applied.");
console.log("Existing course, Revision, Zoom, Forgot Password, payments, consultants and CCO Training were not changed.");

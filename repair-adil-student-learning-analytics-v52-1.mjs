import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(
  root,
  "server",
  "modules",
  "admin",
  "student-learning-analytics.ts"
);
const source = path.join(
  root,
  "__adil_student_learning_analytics_v52_1_repair_payload",
  "server",
  "modules",
  "admin",
  "student-learning-analytics.ts"
);

function fail(message) {
  console.error(`\n❌ v52.1 repair stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [target, source]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

const current = fs.readFileSync(target, "utf8");

if (!current.includes("adminStudentLearningAnalyticsRouter")) {
  fail("The v52 analytics route is not detected. Apply v52 FIXED first.");
}

const backupDir = path.join(
  root,
  "backup",
  "student-learning-analytics-v52-1-repair"
);
fs.mkdirSync(backupDir, { recursive: true });

const backup = path.join(
  backupDir,
  "student-learning-analytics.ts.before-v52-1"
);
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

fs.copyFileSync(source, target);

console.log("✓ Replaced only the Student Learning Analytics backend route.");
console.log("✓ Fixed strict TypeScript typing around recent-video activity.");
console.log("✓ No UI, database, payment, course, consultant or revision progression logic was changed.");
console.log("\n✅ v52.1 backend TypeScript repair applied.");

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_ADVANCE_REVISION_ZOOM_V56_1";
const checks = [
  ["db/schema.ts", "durationMinutes"],
  ["server/modules/revision/routes.ts", marker],
  ["server/modules/revision/student-routes.ts", "ended links are not exposed to students"],
  ["client/src/RevisionAdminManager.tsx", "zoomTimingStatus"],
  ["client/src/StudentRevisionCenter.tsx", 'status: "UPCOMING" | "LIVE"'],
  ["client/src/revision-admin.css", marker],
  ["client/src/student-revision.css", marker],
  ["db/migrations/0028_advance_revision_zoom_status.sql", "duration_minutes"]
];
let failed = false;
for (const [relative, needle] of checks) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing: ${relative}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.error(`❌ v56.1 marker/content missing in: ${relative}`);
    failed = true;
  } else {
    console.log(`✓ ${relative}`);
  }
}
if (failed) process.exit(1);
console.log("✅ Advance Revision Zoom v56.1 source verification passed.");

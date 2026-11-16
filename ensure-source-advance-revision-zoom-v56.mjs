import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_ADVANCE_REVISION_ZOOM_V56";
const checks = [
  ["db/schema.ts", "revisionZoomSessions"],
  ["server/modules/revision/routes.ts", "/admin/revision/zoom-sessions"],
  ["server/modules/revision/student-routes.ts", "/student/revision/zoom-sessions"],
  ["client/src/RevisionAdminManager.tsx", "Zoom Live Classes"],
  ["client/src/StudentRevisionCenter.tsx", "Join Zoom Live"],
  ["client/src/revision-admin.css", marker],
  ["client/src/student-revision.css", marker],
  ["db/migrations/0027_advance_revision_zoom_live.sql", "revision_zoom_sessions"]
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
    console.error(`❌ v56 marker/content missing in: ${relative}`);
    failed = true;
  } else {
    console.log(`✓ ${relative}`);
  }
}
if (failed) process.exit(1);
console.log("✅ Advance Revision Zoom v56 source verification passed.");

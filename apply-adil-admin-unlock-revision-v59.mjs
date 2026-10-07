import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'server/modules/revision/student-service.ts');
const coursesPath = path.join(root, 'server/modules/courses/routes.ts');
const marker = 'ADIL_ADMIN_UNLOCK_REVISION_V59';

function fail(msg) {
  console.error(`❌ v59 installer stopped: ${msg}`);
  process.exit(1);
}
function read(p) { if (!fs.existsSync(p)) fail(`Missing ${path.relative(root,p)}`); return fs.readFileSync(p,'utf8'); }
function write(p,s){ fs.writeFileSync(p,s); }

let service = read(servicePath);
let courses = read(coursesPath);

if (service.includes(marker) && courses.includes(marker)) {
  console.log('✅ v59 already installed; no source changes needed.');
  process.exit(0);
}

if (!service.includes('revisionStudentAccess') || !service.includes('ensureRevisionEligibilityState')) {
  fail('Revision v46 service markers were not found. Refusing to modify an unexpected file.');
}
if (!courses.includes('ADMIN_VIDEO_UNLOCK_MARKER') || !courses.includes('"/admin/video-unlock"')) {
  fail('Admin video unlock markers were not found. Refusing to modify an unexpected file.');
}

// 1) Add videoAccessOverrides to the revision service schema imports.
if (!service.includes('videoAccessOverrides')) {
  const importNeedle = '  revisionVideoProgress,\n  revisionVideos\n} from "../../../db/schema";';
  if (!service.includes(importNeedle)) fail('Could not locate revision schema import block.');
  service = service.replace(
    importNeedle,
    '  revisionVideoProgress,\n  revisionVideos,\n  videoAccessOverrides\n} from "../../../db/schema";'
  );
}

// 2) Add helpers before ensureRevisionEligibilityState.
if (!service.includes('grantBasicRevisionAccessFromAdminUnlock')) {
  const ensureNeedle = 'export async function ensureRevisionEligibilityState(db: Db, userId: string) {';
  if (!service.includes(ensureNeedle)) fail('Could not locate ensureRevisionEligibilityState().');
  const helper = `// ${marker}\nasync function hasAdminAllVideoUnlock(db: Db, userId: string, courseId: string) {\n  const [override] = await db\n    .select({ unlockAllVideos: videoAccessOverrides.unlockAllVideos })\n    .from(videoAccessOverrides)\n    .where(\n      and(\n        eq(videoAccessOverrides.userId, userId),\n        eq(videoAccessOverrides.courseId, courseId)\n      )\n    )\n    .limit(1);\n  return override?.unlockAllVideos === true;\n}\n\nexport async function grantBasicRevisionAccessFromAdminUnlock(\n  db: Db,\n  userId: string,\n  courseId: string\n) {\n  const [existing] = await db\n    .select()\n    .from(revisionStudentAccess)\n    .where(\n      and(\n        eq(revisionStudentAccess.userId, userId),\n        eq(revisionStudentAccess.courseId, courseId)\n      )\n    )\n    .limit(1);\n  if (existing?.revisionUnlockedAt) return { access: existing, newlyUnlocked: false };\n\n  const now = new Date();\n  const inserted = await db\n    .insert(revisionStudentAccess)\n    .values({\n      userId,\n      courseId,\n      revisionUnlockedAt: now,\n      updatedAt: now\n    })\n    .onConflictDoNothing()\n    .returning();\n\n  if (inserted.length) return { access: inserted[0], newlyUnlocked: true };\n\n  const [access] = await db\n    .select()\n    .from(revisionStudentAccess)\n    .where(\n      and(\n        eq(revisionStudentAccess.userId, userId),\n        eq(revisionStudentAccess.courseId, courseId)\n      )\n    )\n    .limit(1);\n  return { access: access ?? null, newlyUnlocked: false };\n}\n\n`;
  service = service.replace(ensureNeedle, helper + ensureNeedle);
}

// 3) Teach normal revision overview to honor an existing admin video-unlock override.
const oldBlock = `  let newlyUnlocked = false;\n  if (!access && eligibility.eligible) {\n    const now = new Date();\n    const inserted = await db\n      .insert(revisionStudentAccess)\n      .values({\n        userId,\n        courseId: enrollment.courseId,\n        revisionUnlockedAt: now,\n        updatedAt: now\n      })\n      .onConflictDoNothing()\n      .returning();\n    newlyUnlocked = inserted.length > 0;\n    [access] = inserted.length\n      ? inserted\n      : await db\n          .select()\n          .from(revisionStudentAccess)\n          .where(\n            and(\n              eq(revisionStudentAccess.userId, userId),\n              eq(revisionStudentAccess.courseId, enrollment.courseId)\n            )\n          )\n          .limit(1);\n  }`;
const newBlock = `  let newlyUnlocked = false;\n  const adminAllVideosUnlocked = await hasAdminAllVideoUnlock(db, userId, enrollment.courseId); // ${marker}\n  if (!access && (eligibility.eligible || adminAllVideosUnlocked)) {\n    const granted = await grantBasicRevisionAccessFromAdminUnlock(db, userId, enrollment.courseId);\n    access = granted.access ?? undefined;\n    newlyUnlocked = granted.newlyUnlocked;\n  }`;
if (!service.includes(marker + '_ELIGIBILITY')) {
  if (service.includes(oldBlock)) {
    service = service.replace(oldBlock, newBlock + `\n  // ${marker}_ELIGIBILITY`);
  } else if (!service.includes('adminAllVideosUnlocked')) {
    fail('Could not locate the revision eligibility unlock block.');
  }
}

// 4) Import helper into course routes.
const oldImport = 'import { ensureRevisionEligibilityState } from "../revision/student-service"; // ADIL_STUDENT_REVISION_V46';
const newImport = 'import { ensureRevisionEligibilityState, grantBasicRevisionAccessFromAdminUnlock } from "../revision/student-service"; // ADIL_STUDENT_REVISION_V46 // ' + marker;
if (!courses.includes('grantBasicRevisionAccessFromAdminUnlock')) {
  if (!courses.includes(oldImport)) fail('Could not locate revision service import in course routes.');
  courses = courses.replace(oldImport, newImport);
}

// 5) When Admin sets Unlock All Videos=true, immediately grant Basic Revision too.
if (!courses.includes(marker + '_ADMIN_ROUTE')) {
  const auditNeedle = `    await db.insert(auditLogs).values({\n      actorUserId: admin.id,`;
  if (!courses.includes(auditNeedle)) fail('Could not locate admin video unlock audit block.');
  const grantBlock = `    if (input.unlocked) {\n      await grantBasicRevisionAccessFromAdminUnlock(db, input.userId, input.courseId);\n    }\n    // ${marker}_ADMIN_ROUTE\n\n`;
  courses = courses.replace(auditNeedle, grantBlock + auditNeedle);
}

// 6) Make the Admin success message match the new behavior.
courses = courses.replace(
  '? "මෙම studentට සියලු videos unlock කළා."',
  '? "මෙම studentට සියලු videos සහ Basic Revision access unlock කළා."'
);

write(servicePath, service);
write(coursesPath, courses);
console.log('✅ v59 source patch applied.');
console.log('   - Admin Unlock All Videos => Basic Revision access immediately');
console.log('   - Existing admin-unlocked students => Revision unlocks on next Revision request');
console.log('   - Advanced Revision rules unchanged');

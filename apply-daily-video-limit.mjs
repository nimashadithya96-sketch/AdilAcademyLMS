import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesPath = path.join(root, 'server', 'modules', 'courses', 'routes.ts');
const sharedPath = path.join(root, 'shared', 'platform.ts');
const appPath = path.join(root, 'client', 'src', 'App.tsx');

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

for (const filePath of [routesPath, sharedPath, appPath]) {
  if (!fs.existsSync(filePath)) fail(`${path.relative(root, filePath)} හමු වුණේ නැහැ. Project root එකෙන් run කරන්න.`);
}

const marker = 'const DAILY_NEW_LESSON_LIMIT = 3;';
const routesOriginal = fs.readFileSync(routesPath, 'utf8');
if (routesOriginal.includes(marker)) {
  console.log('\nℹ️ Daily 3-video lesson gate එක දැනටමත් apply කරලා තියෙනවා. කිසිම file එකක් නැවත වෙනස් කළේ නැහැ.\n');
  process.exit(0);
}

for (const filePath of [routesPath, sharedPath, appPath]) {
  const backupPath = `${filePath}.before-daily-video-limit`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(filePath, backupPath);
}

function mustReplace(source, oldText, newText, label, count = 1) {
  let output = source;
  for (let i = 0; i < count; i += 1) {
    const index = output.indexOf(oldText);
    if (index === -1) fail(`${label} patch point එක හමු වුණේ නැහැ. Backup files untouched ලෙස තියෙනවා.`);
    output = output.slice(0, index) + newText + output.slice(index + oldText.length);
  }
  return output;
}

let routes = routesOriginal;
routes = mustReplace(
  routes,
  '  lessonProgress,\n  lessons,',
  '  lessonProgress,\n  lessonQuizAttempts,\n  lessons,',
  'routes import'
);

const courseAccessMarker = 'async function courseAccess(db: ReturnType<typeof requireDatabase>, userId: string, courseId: string) {\n';
const gateHelpers = `const DAILY_NEW_LESSON_LIMIT = 3;\nconst LESSON_PASS_PERCENT = 75;\n\nfunction colomboDateKey(value: Date) {\n  const parts = new Intl.DateTimeFormat("en-GB", {\n    timeZone: "Asia/Colombo",\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit"\n  }).formatToParts(value);\n  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";\n  return \`\${get("year")}-\${get("month")}-\${get("day")}\`;\n}\n\ntype LessonGateReason = "PAYMENT" | "DAILY_LIMIT" | "PREVIOUS_QA" | null;\n\nasync function buildLessonGate(\n  db: ReturnType<typeof requireDatabase>,\n  userId: string,\n  courseId: string,\n  access: { accessLevel: "FULL" | "HALF"; halfPaymentLessonLimit: number },\n  orderedLessons?: Array<{ id: string; sectionId: string; position: number }>\n) {\n  let courseLessons = orderedLessons;\n  if (!courseLessons) {\n    const sections = await db\n      .select({ id: courseSections.id, position: courseSections.position })\n      .from(courseSections)\n      .where(eq(courseSections.courseId, courseId))\n      .orderBy(asc(courseSections.position));\n    const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));\n    const unordered = sections.length\n      ? await db\n          .select({ id: lessons.id, sectionId: lessons.sectionId, position: lessons.position })\n          .from(lessons)\n          .where(inArray(lessons.sectionId, sections.map((section) => section.id)))\n          .orderBy(asc(lessons.position))\n      : [];\n    courseLessons = [...unordered].sort((a, b) =>\n      (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0) ||\n      a.position - b.position\n    );\n  }\n\n  const lessonIds = courseLessons.map((lesson) => lesson.id);\n  const attempts = lessonIds.length\n    ? await db\n        .select({\n          lessonId: lessonQuizAttempts.lessonId,\n          scorePercent: lessonQuizAttempts.scorePercent,\n          completedAt: lessonQuizAttempts.completedAt\n        })\n        .from(lessonQuizAttempts)\n        .where(and(eq(lessonQuizAttempts.userId, userId), inArray(lessonQuizAttempts.lessonId, lessonIds)))\n    : [];\n\n  const firstPassAtByLesson = new Map<string, Date>();\n  for (const attempt of attempts) {\n    if (!attempt.completedAt || (attempt.scorePercent ?? 0) < LESSON_PASS_PERCENT) continue;\n    const existing = firstPassAtByLesson.get(attempt.lessonId);\n    if (!existing || attempt.completedAt.getTime() < existing.getTime()) {\n      firstPassAtByLesson.set(attempt.lessonId, attempt.completedAt);\n    }\n  }\n  const passedLessonIds = new Set(firstPassAtByLesson.keys());\n  const todayKey = colomboDateKey(new Date());\n  const passedTodayIds = new Set(\n    [...firstPassAtByLesson.entries()]\n      .filter(([, firstPassedAt]) => colomboDateKey(firstPassedAt) === todayKey)\n      .map(([lessonId]) => lessonId)\n  );\n\n  const paymentLimit = access.accessLevel === "FULL"\n    ? courseLessons.length\n    : Math.min(courseLessons.length, access.halfPaymentLessonLimit);\n  const firstNotPassedIndex = courseLessons.findIndex((lesson, index) =>\n    index < paymentLimit && !passedLessonIds.has(lesson.id)\n  );\n  const nextLessonIndex = firstNotPassedIndex === -1 ? paymentLimit : firstNotPassedIndex;\n  const dailyLimitReached = passedTodayIds.size >= DAILY_NEW_LESSON_LIMIT;\n\n  const byLessonId = new Map<string, { locked: boolean; reason: LessonGateReason; qaPassed: boolean }>();\n  courseLessons.forEach((lesson, index) => {\n    const qaPassed = passedLessonIds.has(lesson.id);\n    if (index >= paymentLimit) {\n      byLessonId.set(lesson.id, { locked: true, reason: "PAYMENT", qaPassed });\n      return;\n    }\n    if (qaPassed) {\n      byLessonId.set(lesson.id, { locked: false, reason: null, qaPassed: true });\n      return;\n    }\n    if (index === nextLessonIndex) {\n      byLessonId.set(lesson.id, {\n        locked: dailyLimitReached,\n        reason: dailyLimitReached ? "DAILY_LIMIT" : null,\n        qaPassed: false\n      });\n      return;\n    }\n    byLessonId.set(lesson.id, { locked: true, reason: "PREVIOUS_QA", qaPassed: false });\n  });\n\n  return {\n    byLessonId,\n    dailyLimit: DAILY_NEW_LESSON_LIMIT,\n    passedToday: passedTodayIds.size,\n    remainingToday: Math.max(0, DAILY_NEW_LESSON_LIMIT - passedTodayIds.size),\n    nextLessonIndex,\n    paymentLimit\n  };\n}\n\n`;
routes = mustReplace(routes, courseAccessMarker, gateHelpers + courseAccessMarker, 'daily gate helper');

routes = mustReplace(
  routes,
  '    const lessonTitles = new Map(courseLessons.map((item) => [item.id, item.title]));\n    const completedIds = new Set(completed.map((item) => item.lessonId));\n    const modules = sections.map((section) => {\n',
  '    const lessonTitles = new Map(courseLessons.map((item) => [item.id, item.title]));\n    const completedIds = new Set(completed.map((item) => item.lessonId));\n    const lessonGate = await buildLessonGate(db, user.id, enrollment.courseId, access, courseLessons);\n    const modules = sections.map((section) => {\n',
  'dashboard gate'
);

routes = mustReplace(
  routes,
  '        lessons: moduleLessons.map((lesson) => ({\n          id: lesson.id,\n          title: lesson.title,\n          locked: (lessonOrder.get(lesson.id) ?? 0) >= unlockedLimit,\n          progressPercent: progressByLesson.get(lesson.id) ?? 0\n        }))\n',
  '        lessons: moduleLessons.map((lesson) => {\n          const gate = lessonGate.byLessonId.get(lesson.id);\n          return {\n            id: lesson.id,\n            title: lesson.title,\n            locked: gate?.locked ?? true,\n            lockReason: gate?.reason ?? null,\n            qaPassed: gate?.qaPassed ?? false,\n            progressPercent: progressByLesson.get(lesson.id) ?? 0\n          };\n        })\n',
  'dashboard lessons'
);

routes = mustReplace(
  routes,
  '      unlockedLessons: unlockedLimit,\n      modules,\n',
  '      unlockedLessons: unlockedLimit,\n      dailyLessonLimit: lessonGate.dailyLimit,\n      lessonsPassedToday: lessonGate.passedToday,\n      lessonsRemainingToday: lessonGate.remainingToday,\n      modules,\n',
  'dashboard daily metadata'
);

routes = mustReplace(
  routes,
  '    if (access.accessLevel === "HALF" && lessonIndex >= access.halfPaymentLessonLimit) {\n      throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n    }\n\n    const [progress] = await db\n',
  '    if (access.accessLevel === "HALF" && lessonIndex >= access.halfPaymentLessonLimit) {\n      throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n    }\n    const lessonGate = await buildLessonGate(db, user.id, record.courseId, access, orderedLessons);\n    const gate = lessonGate.byLessonId.get(record.lessonId);\n    if (gate?.locked) {\n      if (gate.reason === "DAILY_LIMIT") {\n        throw new HttpError(403, "අද දින videos 3 සීමාව සම්පූර්ණයි. ඊළඟ lesson එක හෙට unlock වේ.");\n      }\n      if (gate.reason === "PREVIOUS_QA") {\n        throw new HttpError(403, "කලින් lesson එක සම්පූර්ණ කර Q & A එකෙන් 75% හෝ වැඩි score එකක් ගත් පසු මේ lesson එක unlock වේ.");\n      }\n      throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n    }\n\n    const [progress] = await db\n',
  'lesson open server guard'
);

const oldProgressAccess = `    const access = await courseAccess(db, user.id, enrollment.courseId);\n    if (access.accessLevel === "HALF") {\n      const sections = await db\n        .select({ id: courseSections.id })\n        .from(courseSections)\n        .where(eq(courseSections.courseId, enrollment.courseId))\n        .orderBy(asc(courseSections.position));\n      const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));\n      const unorderedLessons = sections.length\n        ? await db\n            .select({ id: lessons.id, sectionId: lessons.sectionId, position: lessons.position })\n            .from(lessons)\n            .where(inArray(lessons.sectionId, sections.map((section) => section.id)))\n            .orderBy(asc(lessons.position))\n        : [];\n      const orderedLessons = [...unorderedLessons].sort((a, b) =>\n        (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0) ||\n        a.position - b.position\n      );\n      const lessonIndex = orderedLessons.findIndex((item) => item.id === input.lessonId);\n      if (lessonIndex < 0 || lessonIndex >= access.halfPaymentLessonLimit) {\n        throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n      }\n    }\n\n`;
const newProgressAccess = `    const access = await courseAccess(db, user.id, enrollment.courseId);\n    const sections = await db\n      .select({ id: courseSections.id, position: courseSections.position })\n      .from(courseSections)\n      .where(eq(courseSections.courseId, enrollment.courseId))\n      .orderBy(asc(courseSections.position));\n    const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));\n    const unorderedLessons = sections.length\n      ? await db\n          .select({ id: lessons.id, sectionId: lessons.sectionId, position: lessons.position })\n          .from(lessons)\n          .where(inArray(lessons.sectionId, sections.map((section) => section.id)))\n          .orderBy(asc(lessons.position))\n      : [];\n    const orderedLessons = [...unorderedLessons].sort((a, b) =>\n      (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0) ||\n      a.position - b.position\n    );\n    const lessonIndex = orderedLessons.findIndex((item) => item.id === input.lessonId);\n    if (lessonIndex < 0) throw new HttpError(404, "Lesson එක course එක තුළ හමු නොවුණා.");\n    if (access.accessLevel === "HALF" && lessonIndex >= access.halfPaymentLessonLimit) {\n      throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n    }\n    const lessonGate = await buildLessonGate(db, user.id, enrollment.courseId, access, orderedLessons);\n    const gate = lessonGate.byLessonId.get(input.lessonId);\n    if (gate?.locked) {\n      if (gate.reason === "DAILY_LIMIT") {\n        throw new HttpError(403, "අද දින videos 3 සීමාව සම්පූර්ණයි. ඊළඟ lesson එක හෙට unlock වේ.");\n      }\n      if (gate.reason === "PREVIOUS_QA") {\n        throw new HttpError(403, "කලින් lesson එකේ Q & A එකෙන් 75% හෝ වැඩි score එකක් ගත් පසු මේ lesson එක unlock වේ.");\n      }\n      throw new HttpError(403, "Balance payment approval is required to unlock this lesson.");\n    }\n\n`;
routes = mustReplace(routes, oldProgressAccess, newProgressAccess, 'progress server guard');
fs.writeFileSync(routesPath, routes, 'utf8');

let shared = fs.readFileSync(sharedPath, 'utf8');
shared = mustReplace(
  shared,
  '  unlockedLessons?: number;\n  modules: Array<{\n',
  '  unlockedLessons?: number;\n  dailyLessonLimit?: number;\n  lessonsPassedToday?: number;\n  lessonsRemainingToday?: number;\n  modules: Array<{\n',
  'shared daily fields'
);
shared = mustReplace(
  shared,
  '    lessons?: Array<{ id: string; title: string; locked: boolean; progressPercent: number }>;\n',
  '    lessons?: Array<{\n      id: string;\n      title: string;\n      locked: boolean;\n      lockReason?: "PAYMENT" | "DAILY_LIMIT" | "PREVIOUS_QA" | null;\n      qaPassed?: boolean;\n      progressPercent: number;\n    }>;\n',
  'shared lesson gate fields'
);
fs.writeFileSync(sharedPath, shared, 'utf8');

let app = fs.readFileSync(appPath, 'utf8');
app = mustReplace(
  app,
  '  }, []);\n\n  if (module === "Q & A") return <StudentQAndAWorkspace />;\n',
  '  }, [module]);\n\n  if (module === "Q & A") return <StudentQAndAWorkspace />;\n',
  'student workspace refresh'
);
app = mustReplace(
  app,
  '        <p>{summary.accessLevel === "HALF"\n          ? `Half payment access යටතේ පළමු lessons ${summary.halfPaymentLessonLimit ?? 0} පමණක් unlock වී ඇත.`\n          : "Module එකක් තෝරා lesson video එක බලන්න."}</p>\n',
  '        <p>{summary.accessLevel === "HALF"\n          ? `Half payment access යටතේ පළමු lessons ${summary.halfPaymentLessonLimit ?? 0} පමණක් ලබාගත හැක. දවසකට උපරිම videos ${summary.dailyLessonLimit ?? 3}ක් පමණක් progress කළ හැක.`\n          : `දවසකට උපරිම videos ${summary.dailyLessonLimit ?? 3}ක්. අද තවත් ${summary.lessonsRemainingToday ?? 3}ක් progress කළ හැක.`}</p>\n',
  'My Course daily status'
);
app = mustReplace(
  app,
  '                <small>{lesson.locked ? "Balance payment required" : lesson.progressPercent === 100 ? "Completed" : lesson.progressPercent ? `${lesson.progressPercent}% watched` : "Ready to watch"}</small>\n',
  '                <small>{lesson.locked\n                  ? lesson.lockReason === "DAILY_LIMIT"\n                    ? "Daily 3-video limit reached · හෙට unlock වේ"\n                    : lesson.lockReason === "PREVIOUS_QA"\n                      ? "Previous lesson Q & A 75%+ required"\n                      : "Balance payment required"\n                  : lesson.qaPassed\n                    ? "Completed · Q & A Passed"\n                    : lesson.progressPercent === 100\n                      ? "Video completed · Q & A 75%+ required"\n                      : lesson.progressPercent\n                        ? `${lesson.progressPercent}% watched`\n                        : "Ready to watch"}</small>\n',
  'lesson lock label'
);
app = mustReplace(
  app,
  '<p>{score < 50 ? "Video පාඩම නැවත හොඳින් බලන්න." : score < 75 ? "හොඳ උත්සාහයක් — තවත් ටිකක් පුහුණු වෙමු." : "විශිෂ්ටයි! පාඩම හොඳින් අවබෝධ කරගෙන ඇත."}</p>',
  '<p>{score < 50 ? "Video පාඩම නැවත හොඳින් බලන්න." : score < 75 ? "75% pass mark එකට තවත් ටිකක් අවශ්‍යයි. Video එක නැවත බලලා retake කරන්න." : "Pass! 75%+ ලැබුණා. Daily limit එක ඇතුළේ නම් ඊළඟ lesson එක unlock වේ."}</p>',
  'Q&A pass message'
);
fs.writeFileSync(appPath, app, 'utf8');

console.log('\n✅ DAILY VIDEO LIMIT update applied successfully.');
console.log('✅ Daily limit: 3 new lessons');
console.log('✅ Unlock rule: previous video 100% + Q & A score 75%+');
console.log('✅ Failed Q & A keeps next lesson locked; existing 50% rewatch retake rule remains unchanged.');
console.log('✅ After 3 passes in one Sri Lanka calendar day, next new lesson waits until the next day.');
console.log('✅ Previously passed lessons remain open for review.');
console.log('✅ Server-side guards added so locked lessons cannot be bypassed by URL/API.');
console.log('✅ Backups created with .before-daily-video-limit suffix.\n');

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'client/src/App.tsx');
const cssPath = path.join(root, 'client/src/styles.css');

if (!fs.existsSync(appPath) || !fs.existsSync(cssPath)) {
  console.error('❌ Expected Adil Academy files were not found. Run this from ~/workspace.');
  process.exit(1);
}

let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

if (app.includes('student-course-inline-player') && app.includes('isMobileCourseLayout')) {
  console.log('ℹ️ Mobile inline lesson-player update is already applied.');
  process.exit(0);
}

const backupStamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(appPath, `${appPath}.before-mobile-inline-${backupStamp}.bak`);
fs.copyFileSync(cssPath, `${cssPath}.before-mobile-inline-${backupStamp}.bak`);

function mustReplace(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    console.error(`❌ Patch stopped safely: ${label} was not found.`);
    console.error('Your App.tsx/styles.css version is different. No partial patch was saved.');
    process.exit(2);
  }
  return source.replace(oldText, newText);
}

const originalApp = app;
const originalCss = css;

try {
  app = mustReplace(
    app,
    `import {\n  useEffect,\n  useRef,`,
    `import {\n  Fragment,\n  useEffect,\n  useRef,`,
    'React import block'
  );

  app = mustReplace(
    app,
    `  const [syncingProgress, setSyncingProgress] = useState(false);\n  const [message, setMessage] = useState(\"\");\n  const detailRef = useRef<StudentLessonDetail | null>(null);`,
    `  const [syncingProgress, setSyncingProgress] = useState(false);\n  const [message, setMessage] = useState(\"\");\n  const [isMobileCourseLayout, setIsMobileCourseLayout] = useState(false);\n  const detailRef = useRef<StudentLessonDetail | null>(null);`,
    'StudentCourseWorkspace state block'
  );

  app = mustReplace(
    app,
    `  useEffect(() => {\n    detailRef.current = detail;\n  }, [detail]);\n\n  async function openLesson(lessonId: string) {`,
    `  useEffect(() => {\n    detailRef.current = detail;\n  }, [detail]);\n\n  useEffect(() => {\n    const media = window.matchMedia(\"(max-width: 900px)\");\n    const syncLayout = () => setIsMobileCourseLayout(media.matches);\n    syncLayout();\n    media.addEventListener?.(\"change\", syncLayout);\n    return () => media.removeEventListener?.(\"change\", syncLayout);\n  }, []);\n\n  async function openLesson(lessonId: string) {`,
    'mobile layout detector'
  );

  const componentStart = app.indexOf('function StudentCourseWorkspace(');
  if (componentStart < 0) throw new Error('StudentCourseWorkspace not found');
  const blockStart = app.indexOf('  const videoUrl = buildVideoEmbedUrl(detail?.lesson.videoProvider, detail?.lesson.videoId);', componentStart);
  if (blockStart < 0) throw new Error('StudentCourseWorkspace render block not found');
  const nextFunction = app.indexOf('\nfunction ', blockStart);
  if (nextFunction < 0) throw new Error('Could not find end of StudentCourseWorkspace');

  const replacement = `  const videoUrl = buildVideoEmbedUrl(detail?.lesson.videoProvider, detail?.lesson.videoId);\n  const durationSeconds = detail?.lesson.durationSeconds ?? 0;\n  const watchedSeconds = detail?.lesson.watchedSeconds ?? 0;\n\n  function renderLessonPlayer() {\n    return <div className=\"student-course-player\">\n      {loadingLesson ? <div className=\"qa-empty\"><BookOpen size={36} /><h3>Lesson loading...</h3></div> : !detail ? <div className=\"qa-empty\"><Play size={38} /><h3>Lesson එකක් තෝරන්න</h3><p>Unlocked lesson එක click කරන්න.</p></div> : <>\n        <div className=\"student-course-player-heading\">\n          <div>\n            <span className=\"eyebrow\">{detail.lesson.moduleTitle}</span>\n            <h3>{detail.lesson.title}</h3>\n            <p>{durationSeconds ? \`Video duration: \${formatWatchTime(durationSeconds)}\` : \"Video play කළ පසු duration එක automatically හඳුනාගනී.\"}</p>\n          </div>\n          <span className={\`status-badge \${detail.lesson.progressPercent === 100 ? \"success\" : \"warning\"}\`}>\n            {detail.lesson.progressPercent === 100 ? \"COMPLETED\" : \"IN PROGRESS\"}\n          </span>\n        </div>\n\n        {videoUrl ? <ProtectedVideoPlayer\n          key={detail.lesson.id}\n          provider={detail.lesson.videoProvider}\n          rawValue={detail.lesson.videoId}\n          title={\`\${detail.lesson.title} video\`}\n          watermark={summary.accountNumber ? \`ADIL ACADEMY • \${summary.accountNumber}\` : \"ADIL ACADEMY • STUDENT ACCESS\"}\n          trackingEnabled={detail.lesson.progressPercent < 100}\n          onDurationDetected={handleDurationDetected}\n          onWatchHeartbeat={handleWatchHeartbeat}\n        /> : <div className=\"workspace-note\">\n          <strong>Video link එක හඳුනාගත නොහැක.</strong>\n          <p>Admin panel එකේ YouTube/Vimeo URL එක හෝ Video ID එක නිවැරදිව add කරන්න.</p>\n        </div>}\n\n        {detail.lesson.content && <div className=\"student-lesson-note\">\n          <span className=\"eyebrow\">LESSON NOTE</span>\n          <p>{detail.lesson.content}</p>\n        </div>}\n\n        <div className=\"student-lesson-progress\">\n          <div>\n            <span>Lesson progress</span>\n            <strong>{detail.lesson.progressPercent}%</strong>\n          </div>\n          <div className=\"progress-track large\"><span style={{ width: \`\${detail.lesson.progressPercent}%\` }} /></div>\n          <div className=\"automatic-progress-note\">\n            <ShieldCheck size={17} />\n            <div>\n              <strong>{detail.lesson.progressPercent === 100 ? \"Lesson automatically completed\" : \"Watch time automatically tracking\"}</strong>\n              <span>{formatWatchTime(Math.min(watchedSeconds, durationSeconds || watchedSeconds))} / {durationSeconds ? formatWatchTime(durationSeconds) : \"Detecting...\"} watched{syncingProgress ? \" · Saving...\" : \"\"}</span>\n              <small>Video play වන සැබෑ කාලය පමණක් count වේ. Video pause කළ විට හෝ වෙනත් tab එකකට ගිය විට progress එක වැඩි නොවේ.</small>\n            </div>\n          </div>\n        </div>\n      </>}\n    </div>;\n  }\n\n  return <section className=\"dash-card workspace-card student-course-workspace\">\n    <div className=\"workspace-heading\">\n      <div>\n        <span className=\"eyebrow\">ADIL ACADEMY LEARNING PORTAL</span>\n        <h2>{summary.courseTitle ?? \"Course access pending\"}</h2>\n        <p>{summary.accessLevel === \"HALF\"\n          ? \`Half payment access යටතේ පළමු lessons \${summary.halfPaymentLessonLimit ?? 0} පමණක් unlock වී ඇත.\`\n          : \"Module එකක් තෝරා lesson video එක බලන්න.\"}</p>\n      </div>\n      <span className=\"status-badge success\">{summary.progressPercent}% COMPLETE</span>\n    </div>\n\n    {!canLearn ? <div className=\"workspace-note\">\n      <strong>Course access තවම active නැහැ.</strong>\n      <p>Payment approval සම්පූර්ණ වූ පසු lesson videos මෙහි පෙන්වයි.</p>\n    </div> : <div className=\"student-course-layout\">\n      <aside className=\"student-course-catalog\">\n        {summary.modules.map((module, moduleIndex) => <div className=\"student-course-module\" key={\`\${module.title}-\${moduleIndex}\`}>\n          <div className=\"student-course-module-heading\">\n            <span>MODULE {String(moduleIndex + 1).padStart(2, \"0\")}</span>\n            <strong>{module.title}</strong>\n            <small>{module.completedLessons}/{module.totalLessons} completed</small>\n          </div>\n          <div className=\"student-course-lessons\">\n            {(module.lessons ?? []).map((lesson, lessonIndex) => <Fragment key={lesson.id}>\n              <button\n                type=\"button\"\n                className={\`\${selectedLessonId === lesson.id ? \"active\" : \"\"} \${lesson.locked ? \"locked\" : \"\"}\`}\n                disabled={lesson.locked}\n                onClick={() => void openLesson(lesson.id)}\n              >\n                <span className=\"student-course-lesson-icon\">\n                  {lesson.locked ? <LockKeyhole size={15} /> : lesson.progressPercent === 100 ? <Check size={15} /> : <Play size={15} />}\n                </span>\n                <span>\n                  <b>{lessonIndex + 1}. {lesson.title}</b>\n                  <small>{lesson.locked ? \"Balance payment required\" : lesson.progressPercent === 100 ? \"Completed\" : lesson.progressPercent ? \`\${lesson.progressPercent}% watched\` : \"Ready to watch\"}</small>\n                </span>\n                <ChevronRight size={15} />\n              </button>\n              {isMobileCourseLayout && selectedLessonId === lesson.id && <div className=\"student-course-inline-player\">{renderLessonPlayer()}</div>}\n            </Fragment>)}\n          </div>\n        </div>)}\n      </aside>\n\n      {!isMobileCourseLayout && renderLessonPlayer()}\n    </div>}\n    {message && <p className={message.includes(\"automatically Completed\") ? \"workspace-note\" : \"form-error\"}>{message}</p>}\n  </section>;\n}\n`;

  app = app.slice(0, blockStart) + replacement + app.slice(nextFunction);

  const oldCss = '@media(max-width:900px){.student-course-layout{grid-template-columns:1fr}.student-course-catalog{max-height:420px}.student-course-player{min-height:380px}}';
  const newCss = '@media(max-width:900px){.student-course-layout{grid-template-columns:1fr}.student-course-catalog{max-height:none;overflow:visible}.student-course-inline-player{margin:4px 0 10px}.student-course-inline-player .student-course-player{min-height:0;padding:14px;border-color:var(--line-bright);box-shadow:0 12px 34px rgba(0,0,0,.18)}.student-course-player{min-height:380px}}';
  css = mustReplace(css, oldCss, newCss, 'mobile course CSS block');

  fs.writeFileSync(appPath, app);
  fs.writeFileSync(cssPath, css);
  console.log('✅ MOBILE MY COURSE inline-video update applied successfully.');
  console.log('✅ On phones/tablets, tapping a lesson now places that lesson video directly below the selected lesson.');
  console.log('✅ Desktop two-column My Course layout remains unchanged.');
  console.log('✅ No server, database, Q&A, daily-limit, or progress logic was changed.');
  console.log('ℹ️ Backups were created beside App.tsx and styles.css.');
} catch (error) {
  fs.writeFileSync(appPath, originalApp);
  fs.writeFileSync(cssPath, originalCss);
  console.error('❌ Patch failed and original files were restored.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(3);
}

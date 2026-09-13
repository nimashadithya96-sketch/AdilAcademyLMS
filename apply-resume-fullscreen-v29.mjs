import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'client/src/App.tsx');
const routesPath = path.join(root, 'server/modules/courses/routes.ts');
const schemaPath = path.join(root, 'db/schema.ts');

for (const p of [appPath, routesPath, schemaPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ Required file not found: ${p}`);
    process.exit(1);
  }
}

let app = fs.readFileSync(appPath, 'utf8');
let routes = fs.readFileSync(routesPath, 'utf8');
let schema = fs.readFileSync(schemaPath, 'utf8');

if (app.includes('ADIL_RESUME_FULLSCREEN_V29') && routes.includes('ADIL_RESUME_POSITION_V29')) {
  console.log('ℹ️ V29 resume/fullscreen update is already applied.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(appPath, `${appPath}.before-resume-v29-${stamp}.bak`);
fs.copyFileSync(routesPath, `${routesPath}.before-resume-v29-${stamp}.bak`);
fs.copyFileSync(schemaPath, `${schemaPath}.before-resume-v29-${stamp}.bak`);

const original = { app, routes, schema };

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`Could not find expected code for: ${label}`);
  return source.replace(oldText, newText);
}

try {
  // 1) DB schema: persistent current playback position, separate from genuine watched seconds.
  schema = replaceOnce(
    schema,
    `    watchedSeconds: integer("watched_seconds").default(0).notNull(),\n    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),`,
    `    watchedSeconds: integer("watched_seconds").default(0).notNull(),\n    // ADIL_RESUME_FULLSCREEN_V29: exact playback position for Resume Learning.\n    resumeSeconds: integer("resume_seconds").default(0).notNull(),\n    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),`,
    'lesson_progress resumeSeconds schema field'
  );

  // 2) API validation for position-only saves.
  routes = replaceOnce(
    routes,
    `const progressInput = z.object({\n  enrollmentId: z.string().uuid(),\n  lessonId: z.string().uuid(),\n  elapsedSeconds: z.coerce.number().int().min(1).max(15),\n  durationSeconds: z.coerce.number().int().min(10).max(86400)\n});`,
    `const progressInput = z.object({\n  enrollmentId: z.string().uuid(),\n  lessonId: z.string().uuid(),\n  elapsedSeconds: z.coerce.number().int().min(1).max(15),\n  durationSeconds: z.coerce.number().int().min(10).max(86400)\n});\n\n// ADIL_RESUME_POSITION_V29\nconst resumePositionInput = z.object({\n  enrollmentId: z.string().uuid(),\n  lessonId: z.string().uuid(),\n  currentTimeSeconds: z.coerce.number().min(0).max(86400),\n  durationSeconds: z.coerce.number().int().min(0).max(86400).optional()\n});`,
    'resume position input schema'
  );

  // 3) Lesson detail query must return resume seconds.
  routes = replaceOnce(
    routes,
    `        progressPercent: lessonProgress.progressPercent,\n        watchedSeconds: lessonProgress.watchedSeconds,\n        detectedDurationSeconds: lessonProgress.detectedDurationSeconds`,
    `        progressPercent: lessonProgress.progressPercent,\n        watchedSeconds: lessonProgress.watchedSeconds,\n        resumeSeconds: lessonProgress.resumeSeconds,\n        detectedDurationSeconds: lessonProgress.detectedDurationSeconds`,
    'lesson detail progress select'
  );

  routes = replaceOnce(
    routes,
    `        watchedSeconds: progress?.watchedSeconds ?? 0,\n        progressPercent: progress?.progressPercent ?? 0`,
    `        watchedSeconds: progress?.watchedSeconds ?? 0,\n        resumeSeconds: progress?.resumeSeconds ?? 0,\n        progressPercent: progress?.progressPercent ?? 0`,
    'lesson detail response resumeSeconds'
  );

  // 4) Dedicated position-save route. It never adds watched progress.
  const progressRouteMarker = `courseRouter.post(\n  "/student/progress",`;
  const progressRouteIndex = routes.indexOf(progressRouteMarker);
  if (progressRouteIndex < 0) throw new Error('Could not find /student/progress route');
  const quizMarker = `\ncourseRouter.get(\n  "/student/quizzes/:id",`;
  const quizIndex = routes.indexOf(quizMarker, progressRouteIndex);
  if (quizIndex < 0) throw new Error('Could not find insertion point after /student/progress route');

  const resumeRoute = `\n\n// ADIL_RESUME_POSITION_V29\ncourseRouter.post(\n  "/student/resume-position",\n  asyncRoute(async (request, response) => {\n    const user = await requireAuthenticatedUser(request);\n    const input = resumePositionInput.parse(request.body);\n    const db = requireDatabase();\n\n    const [enrollment] = await db\n      .select({ id: enrollments.id, courseId: enrollments.courseId })\n      .from(enrollments)\n      .where(and(\n        eq(enrollments.id, input.enrollmentId),\n        eq(enrollments.userId, user.id),\n        inArray(enrollments.status, ["ACTIVE", "COMPLETED"])\n      ))\n      .limit(1);\n    if (!enrollment) throw new HttpError(403, "Active enrollment required.");\n\n    const [lesson] = await db\n      .select({ id: lessons.id, courseId: courseSections.courseId, durationSeconds: lessons.durationSeconds })\n      .from(lessons)\n      .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))\n      .where(eq(lessons.id, input.lessonId))\n      .limit(1);\n    if (!lesson || lesson.courseId !== enrollment.courseId) {\n      throw new HttpError(400, "Lesson is not in this course.");\n    }\n\n    const duration = Math.max(0, lesson.durationSeconds || input.durationSeconds || 0);\n    const safePosition = Math.max(0, Math.floor(\n      duration > 0 ? Math.min(input.currentTimeSeconds, duration) : input.currentTimeSeconds\n    ));\n    const now = new Date();\n\n    const [saved] = await db\n      .insert(lessonProgress)\n      .values({\n        enrollmentId: input.enrollmentId,\n        lessonId: input.lessonId,\n        resumeSeconds: safePosition,\n        detectedDurationSeconds: duration,\n        updatedAt: now\n      })\n      .onConflictDoUpdate({\n        target: [lessonProgress.enrollmentId, lessonProgress.lessonId],\n        set: { resumeSeconds: safePosition, updatedAt: now }\n      })\n      .returning({ resumeSeconds: lessonProgress.resumeSeconds });\n\n    response.json({ resumeSeconds: saved?.resumeSeconds ?? safePosition });\n  })\n);\n`;
  routes = routes.slice(0, quizIndex) + resumeRoute + routes.slice(quizIndex);

  // 5) Player props: initial resume position and a throttled position callback.
  app = replaceOnce(
    app,
    `  trackingEnabled = false,\n  initialWatchedSeconds = 0,\n  onDurationDetected,\n  onWatchHeartbeat\n}: {\n  provider: string | null | undefined;\n  rawValue: string | null | undefined;\n  title: string;\n  watermark?: string;\n  trackingEnabled?: boolean;\n  initialWatchedSeconds?: number;\n  onDurationDetected?: (durationSeconds: number) => void;\n  onWatchHeartbeat?: (elapsedSeconds: number, durationSeconds: number) => void;\n}) {`,
    `  trackingEnabled = false,\n  initialWatchedSeconds = 0,\n  initialPositionSeconds = 0,\n  onDurationDetected,\n  onWatchHeartbeat,\n  onPositionChange\n}: {\n  provider: string | null | undefined;\n  rawValue: string | null | undefined;\n  title: string;\n  watermark?: string;\n  trackingEnabled?: boolean;\n  initialWatchedSeconds?: number;\n  initialPositionSeconds?: number;\n  onDurationDetected?: (durationSeconds: number) => void;\n  onWatchHeartbeat?: (elapsedSeconds: number, durationSeconds: number) => void;\n  onPositionChange?: (currentTimeSeconds: number, durationSeconds: number, force?: boolean) => void;\n}) {`,
    'ProtectedVideoPlayer props'
  );

  app = replaceOnce(
    app,
    `  const durationCallbackRef = useRef(onDurationDetected);\n  const heartbeatCallbackRef = useRef(onWatchHeartbeat);`,
    `  // ADIL_RESUME_FULLSCREEN_V29\n  const durationCallbackRef = useRef(onDurationDetected);\n  const heartbeatCallbackRef = useRef(onWatchHeartbeat);\n  const positionCallbackRef = useRef(onPositionChange);\n  const initialSeekDoneRef = useRef(false);\n  const lastPositionReportRef = useRef({ at: 0, seconds: -1 });`,
    'player callback refs'
  );

  app = replaceOnce(
    app,
    `  useEffect(() => {\n    heartbeatCallbackRef.current = onWatchHeartbeat;\n  }, [onWatchHeartbeat]);`,
    `  useEffect(() => {\n    heartbeatCallbackRef.current = onWatchHeartbeat;\n  }, [onWatchHeartbeat]);\n\n  useEffect(() => {\n    positionCallbackRef.current = onPositionChange;\n  }, [onPositionChange]);`,
    'position callback effect'
  );

  // Add a helper after seekPlayer.
  app = replaceOnce(
    app,
    `  function rewindTenSeconds() {\n    showControls();`,
    `  function reportPlaybackPosition(force = false) {\n    const durationSeconds = Math.round(durationRef.current || 0);\n    const currentTimeSeconds = Math.max(0, currentTimeRef.current || 0);\n    if (durationSeconds <= 0) return;\n    const now = Date.now();\n    const last = lastPositionReportRef.current;\n    if (!force && now - last.at < 5000 && Math.abs(currentTimeSeconds - last.seconds) < 5) return;\n    lastPositionReportRef.current = { at: now, seconds: currentTimeSeconds };\n    positionCallbackRef.current?.(currentTimeSeconds, durationSeconds, force);\n  }\n\n  function applyInitialResumePosition() {\n    if (initialSeekDoneRef.current) return;\n    const target = Math.max(0, Number(initialPositionSeconds) || 0);\n    if (target < 1) {\n      initialSeekDoneRef.current = true;\n      return;\n    }\n    initialSeekDoneRef.current = true;\n    window.setTimeout(() => seekPlayer(target), 120);\n  }\n\n  function rewindTenSeconds() {\n    showControls();`,
    'position helper insertion'
  );

  // Ensure normal samples report current position at a safe rate.
  app = replaceOnce(
    app,
    `    currentTimeRef.current = currentTime;\n    tracker.lastCurrentTime = currentTime;\n    tracker.lastWallTime = now;\n    if (ended) flushPending(true);`,
    `    currentTimeRef.current = currentTime;\n    tracker.lastCurrentTime = currentTime;\n    tracker.lastWallTime = now;\n    reportPlaybackPosition(ended);\n    if (ended) flushPending(true);`,
    'playback sample position report'
  );

  // Vimeo ready: restore saved timestamp.
  app = replaceOnce(
    app,
    `          postToPlayer({ method: "getDuration" });\n          return;`,
    `          postToPlayer({ method: "getDuration" });\n          applyInitialResumePosition();\n          return;`,
    'Vimeo initial resume seek'
  );

  // YouTube onReady event can accept seek reliably.
  app = replaceOnce(
    app,
    `      if (data.event === "onStateChange" && Number.isFinite(Number(data.info))) {`,
    `      if (data.event === "onReady") {\n        applyInitialResumePosition();\n        return;\n      }\n      if (data.event === "onStateChange" && Number.isFinite(Number(data.info))) {`,
    'YouTube onReady resume seek'
  );

  // Save exact position on pause/ended and tab changes.
  app = replaceOnce(
    app,
    `        if (data.event === "pause") {\n          playingRef.current = false;\n          setPlaying(false);\n          flushPending(true);\n          resetPlaybackSample();`,
    `        if (data.event === "pause") {\n          playingRef.current = false;\n          setPlaying(false);\n          flushPending(true);\n          reportPlaybackPosition(true);\n          resetPlaybackSample();`,
    'Vimeo pause position save'
  );

  app = replaceOnce(
    app,
    `        if (state === 2 || state === 0) {\n          flushPending(true);\n          resetPlaybackSample();`,
    `        if (state === 2 || state === 0) {\n          flushPending(true);\n          reportPlaybackPosition(true);\n          resetPlaybackSample();`,
    'YouTube pause position save'
  );

  app = replaceOnce(
    app,
    `    function handleVisibilityChange() {\n      if (document.hidden) flushPending(true);\n      resetPlaybackSample();\n    }`,
    `    function handleVisibilityChange() {\n      if (document.hidden) {\n        flushPending(true);\n        reportPlaybackPosition(true);\n      }\n      resetPlaybackSample();\n    }`,
    'visibility position save'
  );

  app = replaceOnce(
    app,
    `    return () => {\n      flushPending(true);\n      window.clearInterval(timer);`,
    `    return () => {\n      flushPending(true);\n      reportPlaybackPosition(true);\n      window.clearInterval(timer);`,
    'unmount position save'
  );

  // Fallback seek retries after iframe load for mobile/webview timing differences.
  app = replaceOnce(
    app,
    `        window.setTimeout(() => {\n          if (provider === "vimeo") {\n            postToPlayer({ method: "getDuration" });\n          } else {\n            postToPlayer({ event: "listening" });\n            postToPlayer({ event: "command", func: "getDuration", args: [] });\n          }\n        }, 350);`,
    `        window.setTimeout(() => {\n          if (provider === "vimeo") {\n            postToPlayer({ method: "getDuration" });\n          } else {\n            postToPlayer({ event: "listening" });\n            postToPlayer({ event: "command", func: "getDuration", args: [] });\n          }\n          applyInitialResumePosition();\n        }, 350);`,
    'iframe load resume fallback'
  );

  // Play tap on mobile requests fullscreen while we still have a direct user gesture.
  app = replaceOnce(
    app,
    `  function togglePlayback() {\n    if (!loaded) return;\n    showControls();\n    const nextPlaying = !playing;\n    if (!nextPlaying) flushPending(true);\n    resetPlaybackSample();\n    sendPlayerCommand(nextPlaying ? "play" : "pause");`,
    `  function togglePlayback() {\n    if (!loaded) return;\n    showControls();\n    const nextPlaying = !playing;\n    if (!nextPlaying) {\n      flushPending(true);\n      reportPlaybackPosition(true);\n    }\n    // On phones/tablets, request fullscreen directly from the Play tap.\n    if (nextPlaying && window.matchMedia("(max-width: 900px)").matches && !document.fullscreenElement) {\n      void shellRef.current?.requestFullscreen?.().catch(() => undefined);\n    }\n    resetPlaybackSample();\n    sendPlayerCommand(nextPlaying ? "play" : "pause");`,
    'mobile play fullscreen'
  );

  // 6) Dashboard Resume Learning: request fullscreen from the dashboard tap itself.
  app = replaceOnce(
    app,
    `    if (resumeLesson) {\n      window.sessionStorage.setItem("adil-resume-lesson-id", resumeLesson.id);\n    }\n    onOpen("My Course");`,
    `    if (resumeLesson) {\n      window.sessionStorage.setItem("adil-resume-lesson-id", resumeLesson.id);\n      window.sessionStorage.setItem("adil-resume-fullscreen", "1");\n    }\n    // Preserve the mobile user gesture so the My Course player can open inside fullscreen.\n    if (window.matchMedia("(max-width: 900px)").matches && !document.fullscreenElement) {\n      void document.documentElement.requestFullscreen?.().catch(() => undefined);\n    }\n    onOpen("My Course");`,
    'dashboard continueLearning fullscreen request'
  );

  // 7) Frontend detail/response types.
  app = replaceOnce(
    app,
    `    watchedSeconds: number;\n    progressPercent: number;`,
    `    watchedSeconds: number;\n    resumeSeconds: number;\n    progressPercent: number;`,
    'StudentLessonDetail resumeSeconds type'
  );

  // 8) StudentCourseWorkspace: position save function and player props.
  const heartbeatFunction = `  function handleWatchHeartbeat(elapsedSeconds: number, durationSeconds: number) {\n    const currentDetail = detailRef.current;\n    if (!currentDetail || currentDetail.lesson.progressPercent >= 100) return;\n    detectedDurationRef.current = durationSeconds;\n    queuedWatchSecondsRef.current += elapsedSeconds;\n    void flushProgressQueue();\n  }`;
  if (!app.includes(heartbeatFunction)) throw new Error('Could not find handleWatchHeartbeat');
  app = app.replace(heartbeatFunction, heartbeatFunction + `\n\n  async function handlePlaybackPosition(currentTimeSeconds: number, durationSeconds: number) {\n    const currentDetail = detailRef.current;\n    const lessonId = activeLessonIdRef.current;\n    if (!currentDetail || currentDetail.lesson.id !== lessonId || durationSeconds <= 0) return;\n    try {\n      const response = await fetch("/api/student/resume-position", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        keepalive: true,\n        body: JSON.stringify({\n          enrollmentId: currentDetail.enrollmentId,\n          lessonId,\n          currentTimeSeconds: Math.max(0, Math.floor(currentTimeSeconds)),\n          durationSeconds: Math.max(0, Math.round(durationSeconds))\n        })\n      });\n      if (response.ok) {\n        const nextDetail = {\n          ...currentDetail,\n          lesson: { ...currentDetail.lesson, resumeSeconds: Math.max(0, Math.floor(currentTimeSeconds)) }\n        };\n        detailRef.current = nextDetail;\n        setDetail(nextDetail);\n      }\n    } catch {\n      // Resume position is best-effort; normal watch progress continues independently.\n    }\n  }`);

  // v27 renderLessonPlayer does not pass initialWatchedSeconds, so patch its current exact call.
  app = replaceOnce(
    app,
    `          trackingEnabled={detail.lesson.progressPercent < 100}\n          onDurationDetected={handleDurationDetected}\n          onWatchHeartbeat={handleWatchHeartbeat}`,
    `          trackingEnabled={detail.lesson.progressPercent < 100}\n          initialWatchedSeconds={detail.lesson.watchedSeconds}\n          initialPositionSeconds={detail.lesson.resumeSeconds}\n          onDurationDetected={handleDurationDetected}\n          onWatchHeartbeat={handleWatchHeartbeat}\n          onPositionChange={handlePlaybackPosition}`,
    'My Course protected player resume props'
  );

  // Clear the one-shot resume fullscreen marker after the lesson has loaded.
  app = replaceOnce(
    app,
    `      detailRef.current = data;\n      setDetail(data);\n    }\n    setLoadingLesson(false);`,
    `      detailRef.current = data;\n      setDetail(data);\n      if (window.sessionStorage.getItem("adil-resume-fullscreen") === "1") {\n        window.sessionStorage.removeItem("adil-resume-fullscreen");\n      }\n    }\n    setLoadingLesson(false);`,
    'resume fullscreen marker cleanup'
  );

  fs.writeFileSync(appPath, app);
  fs.writeFileSync(routesPath, routes);
  fs.writeFileSync(schemaPath, schema);

  console.log('✅ V29 Resume Learning + mobile fullscreen update applied successfully.');
  console.log('✅ Exact playback position is now stored separately from watched-progress seconds.');
  console.log('✅ Dashboard Continue Learning restores the same lesson and saved timestamp.');
  console.log('✅ Mobile Play requests fullscreen from the user tap.');
  console.log('✅ Existing daily limits, Q&A and genuine watch-progress logic were not intentionally changed.');
} catch (error) {
  fs.writeFileSync(appPath, original.app);
  fs.writeFileSync(routesPath, original.routes);
  fs.writeFileSync(schemaPath, original.schema);
  console.error('❌ V29 patch stopped safely and restored the original files.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

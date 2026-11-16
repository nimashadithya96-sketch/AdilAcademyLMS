import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  app: path.join(root, 'client/src/App.tsx'),
  styles: path.join(root, 'client/src/styles.css'),
  routes: path.join(root, 'server/modules/courses/routes.ts'),
  schema: path.join(root, 'db/schema.ts'),
  platform: path.join(root, 'shared/platform.ts'),
};

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Required ${label} file not found: ${file}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
for (const file of Object.values(files)) {
  fs.copyFileSync(file, `${file}.before-resume-fullscreen-v28-${stamp}.bak`);
}

function replaceOnce(text, find, replacement, label) {
  if (!text.includes(find)) {
    throw new Error(`Could not find expected code for: ${label}`);
  }
  return text.replace(find, replacement);
}

let app = fs.readFileSync(files.app, 'utf8');
if (!app.includes('requestFullscreenWhenReady')) {
  app = replaceOnce(app,
`function buildVideoEmbedUrl(provider: string | null | undefined, rawValue: string | null | undefined) {
  const id = extractVideoId(provider, rawValue);
  if (!id) return "";
  if (provider === "vimeo") {
    return \`https://player.vimeo.com/video/\${encodeURIComponent(id)}?controls=0&title=0&byline=0&portrait=0&dnt=1&api=1\`;
  }
  const origin = typeof window === "undefined" ? "" : \`&origin=\${encodeURIComponent(window.location.origin)}\`;
  return \`https://www.youtube-nocookie.com/embed/\${encodeURIComponent(id)}?rel=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1&modestbranding=1\${origin}\`;
}`,
`function buildVideoEmbedUrl(
  provider: string | null | undefined,
  rawValue: string | null | undefined,
  startSeconds = 0
) {
  const id = extractVideoId(provider, rawValue);
  if (!id) return "";
  const safeStartSeconds = Math.max(0, Math.floor(Number(startSeconds) || 0));
  if (provider === "vimeo") {
    return \`https://player.vimeo.com/video/\${encodeURIComponent(id)}?controls=0&title=0&byline=0&portrait=0&dnt=1&api=1\`;
  }
  const origin = typeof window === "undefined" ? "" : \`&origin=\${encodeURIComponent(window.location.origin)}\`;
  const start = safeStartSeconds > 0 ? \`&start=\${safeStartSeconds}\` : "";
  return \`https://www.youtube-nocookie.com/embed/\${encodeURIComponent(id)}?rel=0&controls=0&disablekb=1&fs=1&iv_load_policy=3&playsinline=1&enablejsapi=1&modestbranding=1\${start}\${origin}\`;
}`,
'video URL builder');

  app = replaceOnce(app,
`  trackingEnabled = false,
  onDurationDetected,
  onWatchHeartbeat
}: {
  provider: string | null | undefined;
  rawValue: string | null | undefined;
  title: string;
  watermark?: string;
  trackingEnabled?: boolean;
  onDurationDetected?: (durationSeconds: number) => void;
  onWatchHeartbeat?: (elapsedSeconds: number, durationSeconds: number) => void;
}) {`,
`  trackingEnabled = false,
  startSeconds = 0,
  fullscreenOnMobileStart = false,
  requestFullscreenWhenReady = false,
  onDurationDetected,
  onWatchHeartbeat
}: {
  provider: string | null | undefined;
  rawValue: string | null | undefined;
  title: string;
  watermark?: string;
  trackingEnabled?: boolean;
  startSeconds?: number;
  fullscreenOnMobileStart?: boolean;
  requestFullscreenWhenReady?: boolean;
  onDurationDetected?: (durationSeconds: number) => void;
  onWatchHeartbeat?: (elapsedSeconds: number, durationSeconds: number, playbackPositionSeconds: number) => void;
}) {`,
'ProtectedVideoPlayer props');

  app = replaceOnce(app,
`  const durationCallbackRef = useRef(onDurationDetected);
  const heartbeatCallbackRef = useRef(onWatchHeartbeat);
  const trackingRef = useRef({
    lastCurrentTime: null as number | null,
    lastWallTime: 0,
    pendingSeconds: 0
  });
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoUrl = buildVideoEmbedUrl(provider, rawValue);`,
`  const durationCallbackRef = useRef(onDurationDetected);
  const heartbeatCallbackRef = useRef(onWatchHeartbeat);
  const resumeAppliedRef = useRef(false);
  const trackingRef = useRef({
    lastCurrentTime: null as number | null,
    lastWallTime: 0,
    pendingSeconds: 0
  });
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const normalizedStartSeconds = Math.max(0, Math.floor(Number(startSeconds) || 0));
  const videoUrl = buildVideoEmbedUrl(provider, rawValue, provider === "vimeo" ? 0 : normalizedStartSeconds);`,
'player resume refs');

  app = replaceOnce(app,
`    trackingRef.current.pendingSeconds = Math.max(0, pending - elapsedSeconds);
    heartbeatCallbackRef.current?.(elapsedSeconds, durationSeconds);
  }`,
`    trackingRef.current.pendingSeconds = Math.max(0, pending - elapsedSeconds);
    const playbackPositionSeconds = Math.max(
      0,
      Math.floor(Number(trackingRef.current.lastCurrentTime) || normalizedStartSeconds || 0)
    );
    heartbeatCallbackRef.current?.(elapsedSeconds, durationSeconds, playbackPositionSeconds);
  }`,
'heartbeat playback position');

  app = replaceOnce(app,
`        if (data.event === "ready") {
          for (const eventName of ["play", "pause", "ended", "timeupdate"]) {
            postToPlayer({ method: "addEventListener", value: eventName });
          }
          postToPlayer({ method: "getDuration" });
          return;
        }`,
`        if (data.event === "ready") {
          for (const eventName of ["play", "pause", "ended", "timeupdate"]) {
            postToPlayer({ method: "addEventListener", value: eventName });
          }
          postToPlayer({ method: "getDuration" });
          if (!resumeAppliedRef.current && normalizedStartSeconds > 0) {
            resumeAppliedRef.current = true;
            postToPlayer({ method: "setCurrentTime", value: normalizedStartSeconds });
            resetPlaybackSample(normalizedStartSeconds);
          }
          return;
        }`,
'Vimeo resume seek');

  app = replaceOnce(app,
`  function togglePlayback() {
    if (!loaded) return;
    const nextPlaying = !playing;
    if (!nextPlaying) flushPending(true);
    resetPlaybackSample();
    sendPlayerCommand(nextPlaying ? "play" : "pause");
    playingRef.current = nextPlaying;
    setPlaying(nextPlaying);
  }`,
`  function togglePlayback() {
    if (!loaded) return;
    const nextPlaying = !playing;
    if (!nextPlaying) flushPending(true);
    if (
      nextPlaying &&
      fullscreenOnMobileStart &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 900px)").matches
    ) {
      void openFullscreen();
    }
    resetPlaybackSample(trackingRef.current.lastCurrentTime ?? normalizedStartSeconds);
    sendPlayerCommand(nextPlaying ? "play" : "pause");
    playingRef.current = nextPlaying;
    setPlaying(nextPlaying);
  }`,
'mobile fullscreen on play');

  app = replaceOnce(app,
`  async function openFullscreen() {
    try {
      await shellRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen may be blocked by the browser; normal playback remains available.
    }
  }`,
`  async function openFullscreen() {
    const shell = shellRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    if (!shell) return;
    try {
      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (shell.webkitRequestFullscreen) {
        await shell.webkitRequestFullscreen();
      }
    } catch {
      // Some mobile browsers require fullscreen to be triggered by a direct tap.
      // Playback still works inline and the player's fullscreen button remains available.
    }
  }`,
'fullscreen fallback');

  app = replaceOnce(app,
`          } else {
            postToPlayer({ event: "listening" });
            postToPlayer({ event: "command", func: "getDuration", args: [] });
          }
        }, 350);`,
`          } else {
            postToPlayer({ event: "listening" });
            postToPlayer({ event: "command", func: "getDuration", args: [] });
            if (!resumeAppliedRef.current && normalizedStartSeconds > 0) {
              resumeAppliedRef.current = true;
              postToPlayer({ event: "command", func: "seekTo", args: [normalizedStartSeconds, true] });
              resetPlaybackSample(normalizedStartSeconds);
            }
          }
          if (requestFullscreenWhenReady) void openFullscreen();
        }, 350);`,
'YouTube resume seek');

  app = replaceOnce(app,
`  function continueLearning() {
    if (!enrolled) return;
    const lessons = summary!.modules.flatMap((module) => module.lessons ?? []);
    const resumeLesson =
      lessons.find((lesson) => !lesson.locked && lesson.progressPercent > 0 && lesson.progressPercent < 100) ??
      lessons.find((lesson) => !lesson.locked && lesson.progressPercent < 100) ??
      lessons.find((lesson) => !lesson.locked);

    if (resumeLesson) {
      window.sessionStorage.setItem("adil-resume-lesson-id", resumeLesson.id);
    }
    onOpen("My Course");
  }`,
`  function continueLearning() {
    if (!enrolled) return;
    const lessons = summary!.modules.flatMap((module) => module.lessons ?? []);
    const serverResumeLessonId = summary!.resumeLessonId ?? null;
    const serverResumeLesson = serverResumeLessonId
      ? lessons.find((lesson) => lesson.id === serverResumeLessonId && !lesson.locked)
      : undefined;
    const resumeLesson =
      serverResumeLesson ??
      lessons.find((lesson) => !lesson.locked && lesson.progressPercent > 0 && lesson.progressPercent < 100) ??
      lessons.find((lesson) => !lesson.locked && lesson.progressPercent < 100) ??
      lessons.find((lesson) => !lesson.locked);

    if (resumeLesson) {
      window.sessionStorage.setItem("adil-resume-lesson-id", resumeLesson.id);
      window.sessionStorage.setItem("adil-resume-fullscreen", "1");
    }
    onOpen("My Course");
  }`,
'dashboard resume selection');

  app = replaceOnce(app,
`    durationSeconds: number;
    watchedSeconds: number;
    progressPercent: number;`,
`    durationSeconds: number;
    watchedSeconds: number;
    resumeSeconds: number;
    progressPercent: number;`,
'lesson detail resume type');

  app = replaceOnce(app,
`    progressPercent: number;
    watchedSeconds: number;
    detectedDurationSeconds: number;`,
`    progressPercent: number;
    watchedSeconds: number;
    resumeSeconds: number;
    detectedDurationSeconds: number;`,
'progress response resume type');

  app = replaceOnce(app,
`  const resumeLessonId = window.sessionStorage.getItem("adil-resume-lesson-id");
  const firstUnlockedLesson =`,
`  const resumeLessonId = window.sessionStorage.getItem("adil-resume-lesson-id");
  const resumeFullscreenRequested = window.sessionStorage.getItem("adil-resume-fullscreen") === "1";
  const firstUnlockedLesson =`,
'resume fullscreen flag');

  app = replaceOnce(app,
`  async function openLesson(lessonId: string) {
    window.sessionStorage.removeItem("adil-resume-lesson-id");
    activeLessonIdRef.current = lessonId;`,
`  async function openLesson(lessonId: string) {
    const isResumeOpen = window.sessionStorage.getItem("adil-resume-lesson-id") === lessonId;
    if (!isResumeOpen) {
      window.sessionStorage.removeItem("adil-resume-fullscreen");
    }
    window.sessionStorage.removeItem("adil-resume-lesson-id");
    window.localStorage.setItem("adil-last-learning-lesson-id", lessonId);
    activeLessonIdRef.current = lessonId;`,
'open lesson resume state');

  app = replaceOnce(app,
`      detailRef.current = data;
      setDetail(data);
    }
    setLoadingLesson(false);`,
`      detailRef.current = data;
      setDetail(data);
      if (isResumeOpen) {
        window.setTimeout(() => window.sessionStorage.removeItem("adil-resume-fullscreen"), 1500);
      }
    }
    setLoadingLesson(false);`,
'clear resume fullscreen flag');

  app = replaceOnce(app,
`            lessonId,
            elapsedSeconds,
            durationSeconds
          })`,
`            lessonId,
            elapsedSeconds,
            durationSeconds,
            playbackPositionSeconds: Math.max(
              0,
              Math.floor(currentDetail.lesson.resumeSeconds ?? 0)
            )
          })`,
'send resume position');

  app = replaceOnce(app,
`            watchedSeconds: data.progress.watchedSeconds,
            progressPercent: data.progress.progressPercent`,
`            watchedSeconds: data.progress.watchedSeconds,
            resumeSeconds: data.progress.resumeSeconds ?? currentDetail.lesson.resumeSeconds ?? 0,
            progressPercent: data.progress.progressPercent`,
'load saved resume position');

  app = replaceOnce(app,
`  function handleWatchHeartbeat(elapsedSeconds: number, durationSeconds: number) {
    const currentDetail = detailRef.current;
    if (!currentDetail || currentDetail.lesson.progressPercent >= 100) return;
    detectedDurationRef.current = durationSeconds;
    queuedWatchSecondsRef.current += elapsedSeconds;
    void flushProgressQueue();
  }`,
`  function handleWatchHeartbeat(
    elapsedSeconds: number,
    durationSeconds: number,
    playbackPositionSeconds: number
  ) {
    const currentDetail = detailRef.current;
    if (!currentDetail || currentDetail.lesson.progressPercent >= 100) return;
    detectedDurationRef.current = durationSeconds;
    const normalizedPosition = Math.max(0, Math.min(durationSeconds, Math.floor(playbackPositionSeconds || 0)));
    const nextDetail = {
      ...currentDetail,
      lesson: { ...currentDetail.lesson, resumeSeconds: normalizedPosition }
    };
    detailRef.current = nextDetail;
    setDetail(nextDetail);
    queuedWatchSecondsRef.current += elapsedSeconds;
    void flushProgressQueue();
  }`,
'watch heartbeat position');

  app = replaceOnce(app,
`          trackingEnabled={detail.lesson.progressPercent < 100}
          onDurationDetected={handleDurationDetected}
          onWatchHeartbeat={handleWatchHeartbeat}`, 
`          trackingEnabled={detail.lesson.progressPercent < 100}
          startSeconds={detail.lesson.resumeSeconds ?? 0}
          fullscreenOnMobileStart={isMobileCourseLayout}
          requestFullscreenWhenReady={resumeFullscreenRequested && isMobileCourseLayout}
          onDurationDetected={handleDurationDetected}
          onWatchHeartbeat={handleWatchHeartbeat}`,
'player resume props');

  fs.writeFileSync(files.app, app);
}

let routes = fs.readFileSync(files.routes, 'utf8');
if (!routes.includes('playbackPositionSeconds')) {
  routes = replaceOnce(routes,
`  elapsedSeconds: z.coerce.number().int().min(1).max(15),
  durationSeconds: z.coerce.number().int().min(10).max(86400)
});`,
`  elapsedSeconds: z.coerce.number().int().min(1).max(15),
  durationSeconds: z.coerce.number().int().min(10).max(86400),
  playbackPositionSeconds: z.coerce.number().int().min(0).max(86400).optional()
});`,
'progress input');

  routes = replaceOnce(routes,
`    const recentActivity = [...progress].reverse().slice(0, 3).map((item) => ({
      title: lessonTitles.get(item.lessonId) ?? "Course lesson",
      detail: item.progressPercent === 100 ? "Completed" : \`\${item.progressPercent}% watched\`
    }));

    response.json({`,
`    const recentActivity = [...progress].reverse().slice(0, 3).map((item) => ({
      title: lessonTitles.get(item.lessonId) ?? "Course lesson",
      detail: item.progressPercent === 100 ? "Completed" : \`\${item.progressPercent}% watched\`
    }));
    const latestInProgress = [...progress]
      .reverse()
      .find((item) =>
        item.progressPercent > 0 &&
        item.progressPercent < 100 &&
        (lessonOrder.get(item.lessonId) ?? Number.MAX_SAFE_INTEGER) < unlockedLimit
      );

    response.json({`,
'latest resume lesson');

  routes = replaceOnce(routes,
`      unlockedLessons: unlockedLimit,
      modules,
      recentActivity`,
`      unlockedLessons: unlockedLimit,
      resumeLessonId: latestInProgress?.lessonId ?? null,
      modules,
      recentActivity`,
'resume lesson summary');

  routes = replaceOnce(routes,
`        progressPercent: lessonProgress.progressPercent,
        watchedSeconds: lessonProgress.watchedSeconds,
        detectedDurationSeconds: lessonProgress.detectedDurationSeconds`,
`        progressPercent: lessonProgress.progressPercent,
        watchedSeconds: lessonProgress.watchedSeconds,
        resumeSeconds: lessonProgress.resumeSeconds,
        detectedDurationSeconds: lessonProgress.detectedDurationSeconds`,
'lesson resume select');

  routes = replaceOnce(routes,
`        watchedSeconds: progress?.watchedSeconds ?? 0,
        progressPercent: progress?.progressPercent ?? 0`,
`        watchedSeconds: progress?.watchedSeconds ?? 0,
        resumeSeconds: progress?.resumeSeconds ?? 0,
        progressPercent: progress?.progressPercent ?? 0`,
'lesson resume response');

  routes = replaceOnce(routes,
`    const completedAt = completed
      ? current?.completedAt ?? now
      : null;

    const [saved] = await db`,
`    const completedAt = completed
      ? current?.completedAt ?? now
      : null;
    const resumeSeconds = completed
      ? 0
      : Math.max(
          0,
          Math.min(
            effectiveDurationSeconds,
            input.playbackPositionSeconds ?? current?.resumeSeconds ?? 0
          )
        );

    const [saved] = await db`,
'compute resume seconds');

  routes = replaceOnce(routes,
`        progressPercent,
        watchedSeconds,
        detectedDurationSeconds: effectiveDurationSeconds,`,
`        progressPercent,
        watchedSeconds,
        resumeSeconds,
        detectedDurationSeconds: effectiveDurationSeconds,`,
'insert resume seconds');

  routes = replaceOnce(routes,
`          progressPercent,
          watchedSeconds,
          detectedDurationSeconds: effectiveDurationSeconds,`,
`          progressPercent,
          watchedSeconds,
          resumeSeconds,
          detectedDurationSeconds: effectiveDurationSeconds,`,
'update resume seconds');

  fs.writeFileSync(files.routes, routes);
}

let schema = fs.readFileSync(files.schema, 'utf8');
if (!schema.includes('resumeSeconds: integer("resume_seconds")')) {
  schema = replaceOnce(schema,
`    watchedSeconds: integer("watched_seconds").default(0).notNull(),
    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),`,
`    watchedSeconds: integer("watched_seconds").default(0).notNull(),
    resumeSeconds: integer("resume_seconds").default(0).notNull(),
    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),`,
'DB schema resume column');
  fs.writeFileSync(files.schema, schema);
}

let platform = fs.readFileSync(files.platform, 'utf8');
if (!platform.includes('resumeLessonId?: string | null;')) {
  platform = replaceOnce(platform,
`  unlockedLessons?: number;
  modules: Array<{`,
`  unlockedLessons?: number;
  resumeLessonId?: string | null;
  modules: Array<{`,
'summary type resume lesson');
  fs.writeFileSync(files.platform, platform);
}

let styles = fs.readFileSync(files.styles, 'utf8');
if (!styles.includes('v28 — mobile fullscreen + precise resume')) {
  styles += `\n\n/* v28 — mobile fullscreen + precise resume */\n.protected-video-shell:fullscreen,\n.protected-video-shell:-webkit-full-screen{\n  width:100vw;\n  height:100vh;\n  max-width:none;\n  aspect-ratio:auto;\n  border-radius:0;\n  background:#000;\n}\n.protected-video-shell:fullscreen iframe,\n.protected-video-shell:-webkit-full-screen iframe{\n  width:100%;\n  height:100%;\n}\n@media(max-width:900px){\n  .protected-video-shell{touch-action:manipulation}\n}\n`;
  fs.writeFileSync(files.styles, styles);
}

console.log('✅ V28 RESUME + MOBILE FULLSCREEN update applied successfully.');
console.log('✅ Dashboard Continue Learning now selects the latest in-progress lesson.');
console.log('✅ Playback position is persisted and restored near the exact saved timestamp.');
console.log('✅ Mobile Play requests fullscreen; Resume also attempts fullscreen when the player becomes ready.');
console.log('ℹ️ Run ensure-resume-position-v28.mjs once before starting the app.');

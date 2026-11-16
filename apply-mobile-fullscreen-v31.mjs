import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const appPath = path.join(ROOT, "client", "src", "App.tsx");
const stylesPath = path.join(ROOT, "client", "src", "styles.css");

if (!fs.existsSync(appPath)) {
  throw new Error("client/src/App.tsx not found. Run this patch from the project root.");
}

const originalApp = fs.readFileSync(appPath, "utf8");
const originalStyles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, "utf8") : "";

const appBackup = appPath + ".before-fullscreen-v31";
const stylesBackup = stylesPath + ".before-fullscreen-v31";

if (!fs.existsSync(appBackup)) fs.copyFileSync(appPath, appBackup);
if (fs.existsSync(stylesPath) && !fs.existsSync(stylesBackup)) fs.copyFileSync(stylesPath, stylesBackup);

let app = originalApp;
let styles = originalStyles;

function replaceOnce(label, from, to) {
  const idx = app.indexOf(from);
  if (idx === -1) throw new Error(`Could not find expected code for: ${label}`);
  if (app.indexOf(from, idx + from.length) !== -1) {
    throw new Error(`Expected a unique match for: ${label}`);
  }
  app = app.slice(0, idx) + to + app.slice(idx + from.length);
}

try {
  // 1) Explicitly allow fullscreen in the embedded player.
  replaceOnce(
    "iframe fullscreen allow permissions",
    'allow="autoplay; encrypted-media; gyroscope; picture-in-picture"',
    'allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"'
  );

  // 2) Add fullscreen state alongside the existing controls state.
  replaceOnce(
    "fullscreen state",
    `  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimerRef = useRef<number | null>(null);`,
    `  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimerRef = useRef<number | null>(null);

  // ADIL_MOBILE_FULLSCREEN_TOGGLE_V31
  // Native fullscreen is preferred. iOS/in-app browsers that reject the
  // Fullscreen API fall back to a CSS viewport mode.
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);`
  );

  // 3) Add fullscreen change listeners before togglePlayback.
  replaceOnce(
    "fullscreen listener insertion point",
    `  function togglePlayback() {
    if (!loaded) return;`,
    `  useEffect(() => {
    function syncFullscreenState() {
      const nativeActive =
        document.fullscreenElement === shellRef.current ||
        (document as any).webkitFullscreenElement === shellRef.current;
      setNativeFullscreen(Boolean(nativeActive));
      if (nativeActive) setPseudoFullscreen(false);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange" as any, syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange" as any, syncFullscreenState as EventListener);
    };
  }, []);

  function togglePlayback() {
    if (!loaded) return;`
  );

  // 4) Replace the old one-way fullscreen function with a real toggle.
  replaceOnce(
    "one-way openFullscreen function",
    `  async function openFullscreen() {
    showControls();
    try {
      await shellRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen may be blocked by the browser; normal playback remains available.
    }
  }`,
    `  async function toggleFullscreen() {
    showControls();

    const shell = shellRef.current;
    if (!shell) return;

    const docAny = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const shellAny = shell as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      webkitEnterFullscreen?: () => void;
    };

    const activeElement = document.fullscreenElement ?? docAny.webkitFullscreenElement ?? null;
    const nativeActive = activeElement === shell;

    // FULLSCREEN OUT
    if (nativeActive) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (docAny.webkitExitFullscreen) {
          await docAny.webkitExitFullscreen();
        }
      } catch {
        // If the browser refuses native exit, fall back to restoring CSS mode.
      } finally {
        setNativeFullscreen(false);
        setPseudoFullscreen(false);
      }
      return;
    }

    // CSS/iOS FALLBACK OUT
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }

    // FULLSCREEN IN
    try {
      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
        setNativeFullscreen(true);
        setPseudoFullscreen(false);
        return;
      }
      if (shellAny.webkitRequestFullscreen) {
        await shellAny.webkitRequestFullscreen();
        setNativeFullscreen(true);
        setPseudoFullscreen(false);
        return;
      }
    } catch {
      // Some mobile/in-app browsers reject native fullscreen.
    }

    // Reliable fallback: occupy the full phone viewport.
    setNativeFullscreen(false);
    setPseudoFullscreen(true);
  }`
  );

  // 5) Make the shell reflect pseudo fullscreen state.
  replaceOnce(
    "video shell className",
    `    className="protected-video-shell"`,
    `    className={\`protected-video-shell\${pseudoFullscreen ? " protected-video-shell-pseudo-fullscreen" : ""}\`}`
  );

  // 6) Make the button toggle both directions and expose correct label/icon state.
  replaceOnce(
    "fullscreen button",
    `      <button
        type="button"
        onClick={() => void openFullscreen()}
        aria-label="Open fullscreen"
      >
        <Maximize2 size={18} />
      </button>`,
    `      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={(nativeFullscreen || pseudoFullscreen) ? "Exit fullscreen" : "Open fullscreen"}
        title={(nativeFullscreen || pseudoFullscreen) ? "Fullscreen ඉවත් කරන්න" : "Fullscreen කරන්න"}
      >
        <Maximize2
          size={18}
          style={{
            transform: (nativeFullscreen || pseudoFullscreen) ? "rotate(180deg) scale(0.92)" : "none",
            transition: "transform 160ms ease"
          }}
        />
      </button>`
  );

  // 7) Ensure playing on mobile does not repeatedly force fullscreen if fallback/native is already active.
  replaceOnce(
    "mobile autoplay fullscreen guard",
    `    if (nextPlaying && window.matchMedia("(max-width: 900px)").matches && !document.fullscreenElement) {
      void shellRef.current?.requestFullscreen?.().catch(() => undefined);
    }`,
    `    if (
      nextPlaying &&
      window.matchMedia("(max-width: 900px)").matches &&
      !document.fullscreenElement &&
      !(document as any).webkitFullscreenElement &&
      !pseudoFullscreen
    ) {
      const shell = shellRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
      if (shell?.requestFullscreen) {
        void shell.requestFullscreen().catch(() => setPseudoFullscreen(true));
      } else if (shell?.webkitRequestFullscreen) {
        try {
          void shell.webkitRequestFullscreen();
        } catch {
          setPseudoFullscreen(true);
        }
      } else {
        setPseudoFullscreen(true);
      }
    }`
  );

  const cssBlock = `

/* ADIL_MOBILE_FULLSCREEN_TOGGLE_V31
   Used only when the browser rejects the native Fullscreen API. */
.protected-video-shell.protected-video-shell-pseudo-fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  z-index: 2147483000 !important;
  background: #000 !important;
}

.protected-video-shell.protected-video-shell-pseudo-fullscreen iframe {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
}

.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-controls {
  z-index: 2147483002 !important;
}

.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-watermark,
.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-start {
  z-index: 2147483001 !important;
}

@supports not (height: 100dvh) {
  .protected-video-shell.protected-video-shell-pseudo-fullscreen {
    height: 100vh !important;
  }
}
`;

  if (!styles.includes("ADIL_MOBILE_FULLSCREEN_TOGGLE_V31")) {
    styles += cssBlock;
  }

  fs.writeFileSync(appPath, app, "utf8");
  if (fs.existsSync(stylesPath)) fs.writeFileSync(stylesPath, styles, "utf8");

  console.log("✅ V31 Mobile Fullscreen IN/OUT fix applied successfully.");
  console.log("✅ Native fullscreen now toggles IN and OUT with the same button.");
  console.log("✅ Mobile/iOS fallback fullscreen can also be entered and exited.");
  console.log("✅ Existing Resume/Q&A/Daily Limit/progress logic was not intentionally changed.");
  console.log(`✅ Backup: ${path.relative(ROOT, appBackup)}`);
  if (fs.existsSync(stylesPath)) console.log(`✅ Backup: ${path.relative(ROOT, stylesBackup)}`);
} catch (error) {
  // Restore original files if any expected structure changed.
  fs.writeFileSync(appPath, originalApp, "utf8");
  if (fs.existsSync(stylesPath)) fs.writeFileSync(stylesPath, originalStyles, "utf8");
  console.error("❌ V31 patch stopped for safety and restored the original files.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
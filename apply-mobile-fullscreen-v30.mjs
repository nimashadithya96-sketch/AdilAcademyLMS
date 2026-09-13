import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'client/src/App.tsx');
const stylesPath = path.join(root, 'client/src/styles.css');

for (const p of [appPath, stylesPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ Required file not found: ${p}`);
    process.exit(1);
  }
}

let app = fs.readFileSync(appPath, 'utf8');
let styles = fs.readFileSync(stylesPath, 'utf8');

if (app.includes('ADIL_MOBILE_FULLSCREEN_V30')) {
  console.log('ℹ️ V30 mobile fullscreen update is already applied.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(appPath, `${appPath}.before-mobile-fullscreen-v30-${stamp}.bak`);
fs.copyFileSync(stylesPath, `${stylesPath}.before-mobile-fullscreen-v30-${stamp}.bak`);
const original = { app, styles };

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`Could not find expected code for: ${label}`);
  return source.replace(oldText, newText);
}

try {
  // YouTube had fullscreen explicitly disabled (fs=0). Enable it.
  app = replaceOnce(
    app,
    'controls=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1',
    'controls=0&disablekb=1&fs=1&iv_load_policy=3&playsinline=1&enablejsapi=1',
    'YouTube fs=0 setting'
  );

  // Track native or fallback fullscreen mode.
  app = replaceOnce(
    app,
    `  const [controlsVisible, setControlsVisible] = useState(true);\n  const controlsHideTimerRef = useRef<number | null>(null);`,
    `  const [controlsVisible, setControlsVisible] = useState(true);\n  const controlsHideTimerRef = useRef<number | null>(null);\n\n  // ADIL_MOBILE_FULLSCREEN_V30\n  // Native Fullscreen API when available; fixed full-viewport fallback on mobile Safari/webviews.\n  const [fullscreenActive, setFullscreenActive] = useState(false);\n  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);`,
    'fullscreen state'
  );

  // Add listeners and fallback scroll lock before togglePlayback.
  app = replaceOnce(
    app,
    `  function togglePlayback() {`,
    `  useEffect(() => {\n    const doc = document as Document & { webkitFullscreenElement?: Element | null };\n    const syncFullscreenState = () => {\n      const nativeActive = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);\n      setFullscreenActive(nativeActive || pseudoFullscreen);\n    };\n    document.addEventListener("fullscreenchange", syncFullscreenState);\n    document.addEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);\n    syncFullscreenState();\n    return () => {\n      document.removeEventListener("fullscreenchange", syncFullscreenState);\n      document.removeEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);\n    };\n  }, [pseudoFullscreen]);\n\n  useEffect(() => {\n    if (!pseudoFullscreen) return;\n    const previousOverflow = document.body.style.overflow;\n    document.body.style.overflow = "hidden";\n    return () => {\n      document.body.style.overflow = previousOverflow;\n    };\n  }, [pseudoFullscreen]);\n\n  function togglePlayback() {`,
    'fullscreen listeners'
  );

  // Replace one-way fullscreen function with true toggle + iOS/webview fallback.
  app = replaceOnce(
    app,
    `  async function openFullscreen() {\n    showControls();\n    try {\n      await shellRef.current?.requestFullscreen?.();\n    } catch {\n      // Fullscreen may be blocked by the browser; normal playback remains available.\n    }\n  }`,
    `  async function toggleFullscreen() {\n    showControls();\n\n    const doc = document as Document & {\n      webkitFullscreenElement?: Element | null;\n      webkitExitFullscreen?: () => Promise<void> | void;\n    };\n    const shell = shellRef.current as (HTMLDivElement & {\n      webkitRequestFullscreen?: () => Promise<void> | void;\n    }) | null;\n\n    const nativeFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;\n\n    // Same button exits either native fullscreen or the mobile fallback.\n    if (nativeFullscreen) {\n      try {\n        if (document.exitFullscreen) {\n          await document.exitFullscreen();\n        } else if (doc.webkitExitFullscreen) {\n          await doc.webkitExitFullscreen();\n        }\n      } catch {\n        // Keep the player usable even if the browser refuses the exit call.\n      } finally {\n        setPseudoFullscreen(false);\n        setFullscreenActive(false);\n      }\n      return;\n    }\n\n    if (pseudoFullscreen) {\n      setPseudoFullscreen(false);\n      setFullscreenActive(false);\n      return;\n    }\n\n    // Prefer real browser fullscreen. Android Chrome and standalone desktop browsers use this path.\n    try {\n      if (shell?.requestFullscreen) {\n        await shell.requestFullscreen();\n        setFullscreenActive(true);\n        return;\n      }\n      if (shell?.webkitRequestFullscreen) {\n        await shell.webkitRequestFullscreen();\n        setFullscreenActive(true);\n        return;\n      }\n    } catch {\n      // iPhone Safari / embedded webviews may reject element fullscreen. Use fallback below.\n    }\n\n    // Fallback: make the protected player occupy the full visual viewport.\n    // This also gives the same button a reliable way to exit on browsers without Fullscreen API.\n    setPseudoFullscreen(true);\n    setFullscreenActive(true);\n  }`,
    'fullscreen toggle function'
  );

  // Apply fallback fullscreen class to the player shell.
  app = replaceOnce(
    app,
    `    className="protected-video-shell"`,
    `    className={\`protected-video-shell${pseudoFullscreen ? " protected-video-shell-pseudo-fullscreen" : ""}\`}`,
    'player shell fullscreen class'
  );

  // Explicit fullscreen permissions on the embedded player.
  app = replaceOnce(
    app,
    `      allow="autoplay; encrypted-media; gyroscope; picture-in-picture"`,
    `      allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"`,
    'iframe fullscreen permission'
  );

  // Fullscreen button toggles IN and OUT.
  app = replaceOnce(
    app,
    `        onClick={() => void openFullscreen()}\n        aria-label="Open fullscreen"\n      >\n        <Maximize2 size={18} />`,
    `        onClick={() => void toggleFullscreen()}\n        aria-label={fullscreenActive ? "Exit fullscreen" : "Open fullscreen"}\n        title={fullscreenActive ? "Exit fullscreen" : "Fullscreen"}\n      >\n        <Maximize2 size={18} style={{ transform: fullscreenActive ? "rotate(45deg)" : "none" }} />`,
    'fullscreen toggle button'
  );

  // Fallback class for iPhone Safari, in-app browsers and embedded webviews that reject native fullscreen.
  if (!styles.includes('protected-video-shell-pseudo-fullscreen')) {
    styles += `\n\n/* ADIL_MOBILE_FULLSCREEN_V30 */\n.protected-video-shell.protected-video-shell-pseudo-fullscreen{\n  position:fixed!important;\n  inset:0!important;\n  z-index:2147483000!important;\n  width:100vw!important;\n  height:100dvh!important;\n  max-width:none!important;\n  aspect-ratio:auto!important;\n  border-radius:0!important;\n  background:#000!important;\n}\n.protected-video-shell.protected-video-shell-pseudo-fullscreen iframe{\n  width:100%!important;\n  height:100%!important;\n}\n.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-controls{\n  bottom:max(12px, env(safe-area-inset-bottom));\n}\n`;
  }

  fs.writeFileSync(appPath, app);
  fs.writeFileSync(stylesPath, styles);

  console.log('✅ V30 Mobile Fullscreen IN/OUT update applied successfully.');
  console.log('✅ YouTube fullscreen is enabled (fs=1 + iframe fullscreen permission).');
  console.log('✅ The same fullscreen button now enters AND exits fullscreen.');
  console.log('✅ Mobile Safari/webview fallback fills the visual viewport when native fullscreen is blocked.');
  console.log('ℹ️ Replit Preview itself may still block native browser fullscreen because it runs inside an iframe. Test the standalone app URL on phone/Chrome/Safari.');
} catch (error) {
  fs.writeFileSync(appPath, original.app);
  fs.writeFileSync(stylesPath, original.styles);
  console.error('❌ V30 patch stopped safely and restored the original files.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

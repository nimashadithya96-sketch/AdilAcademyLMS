import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const appPath = path.join(ROOT, "client", "src", "App.tsx");
const stylesPath = path.join(ROOT, "client", "src", "styles.css");

if (!fs.existsSync(appPath)) throw new Error("client/src/App.tsx not found");
if (!fs.existsSync(stylesPath)) throw new Error("client/src/styles.css not found");

const originalApp = fs.readFileSync(appPath, "utf8");
const originalStyles = fs.readFileSync(stylesPath, "utf8");

const appBackup = appPath + ".before-player-controls-v33";
const stylesBackup = stylesPath + ".before-player-controls-v33";

if (!fs.existsSync(appBackup)) fs.copyFileSync(appPath, appBackup);
if (!fs.existsSync(stylesBackup)) fs.copyFileSync(stylesPath, stylesBackup);

let app = originalApp;
let styles = originalStyles;

function replaceOnce(label, from, to) {
  const index = app.indexOf(from);
  if (index === -1) throw new Error(`Could not find expected code for: ${label}`);
  if (app.indexOf(from, index + from.length) !== -1) {
    throw new Error(`Expected unique match for: ${label}`);
  }
  app = app.slice(0, index) + to + app.slice(index + from.length);
}

try {
  // Remove the old large "start" button and replace it with:
  // 1) an invisible tap layer that reveals controls
  // 2) a premium center Play/Pause control
  replaceOnce(
    "old protected-video-start block",
`    {!playing && <button
      type="button"
      className="protected-video-start"
      onClick={togglePlayback}
      disabled={!loaded}
      aria-label={loaded ? "Play lesson video" : "Video loading"}
    >
      <Play size={30} />
      <span>{loaded ? "පාඩම ආරම්භ කරන්න" : "Video loading..."}</span>
    </button>}`,
`    <button
      type="button"
      className="protected-video-tap-layer"
      onClick={() => showControls()}
      aria-label="Show video controls"
      tabIndex={-1}
    />

    <button
      type="button"
      className={\`protected-video-center-toggle\${controlsVisible ? " is-visible" : ""}\`}
      onClick={(event) => {
        event.stopPropagation();
        togglePlayback();
      }}
      disabled={!loaded}
      aria-label={playing ? "Pause video" : "Play video"}
      title={playing ? "Pause" : "Play"}
    >
      {playing
        ? <Pause size={34} strokeWidth={2.2} />
        : <Play size={34} strokeWidth={2.2} fill="currentColor" />}
    </button>`
  );

  // Remove Play/Pause from the bottom bar.
  replaceOnce(
    "bottom bar play pause button",
`      <button
        type="button"
        onClick={togglePlayback}
        disabled={!loaded}
        aria-label={playing ? "Pause video" : "Play video"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>

`,
``
  );

  // Add a class hook to the secure tracking label for cleaner mobile styling.
  replaceOnce(
    "tracking label span",
`      <span>
        <ShieldCheck size={14} />
        {trackingEnabled ? "WATCH TIME AUTO TRACKING" : "ADIL ACADEMY SECURE PLAYER"}
      </span>`,
`      <span className="protected-video-tracking-label">
        <ShieldCheck size={14} />
        {trackingEnabled ? "WATCH TIME AUTO TRACKING" : "ADIL ACADEMY SECURE PLAYER"}
      </span>`
  );

  const css = `

/* =========================================================
   ADIL ACADEMY — PREMIUM MOBILE VIDEO CONTROLS v33
   ========================================================= */

.protected-video-shell {
  position: relative;
  overflow: hidden;
}

/* Invisible layer: first tap reveals the controls without
   accidentally starting/stopping the embedded provider. */
.protected-video-tap-layer {
  position: absolute !important;
  inset: 0 !important;
  z-index: 3 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: inherit !important;
  background: transparent !important;
  box-shadow: none !important;
  cursor: pointer !important;
  -webkit-tap-highlight-color: transparent !important;
}

/* Premium center Play/Pause control. */
.protected-video-center-toggle {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  z-index: 7 !important;
  width: 70px !important;
  height: 70px !important;
  transform: translate(-50%, -50%) scale(.9) !important;
  display: grid !important;
  place-items: center !important;
  padding: 0 !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255,255,255,.34) !important;
  color: #fff !important;
  background: rgba(5, 9, 12, .56) !important;
  -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
  backdrop-filter: blur(18px) saturate(150%) !important;
  box-shadow:
    0 12px 38px rgba(0,0,0,.38),
    inset 0 0 0 1px rgba(255,255,255,.06) !important;
  opacity: 0 !important;
  pointer-events: none !important;
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    background 180ms ease !important;
  -webkit-tap-highlight-color: transparent !important;
}

.protected-video-center-toggle.is-visible {
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: translate(-50%, -50%) scale(1) !important;
}

.protected-video-center-toggle:active {
  transform: translate(-50%, -50%) scale(.94) !important;
  background: rgba(12, 20, 24, .72) !important;
}

.protected-video-center-toggle:disabled {
  opacity: .45 !important;
}

/* Replace the heavy black rectangle with a glass/blur control dock. */
.protected-video-controls {
  z-index: 6 !important;
  left: 14px !important;
  right: 14px !important;
  bottom: 14px !important;
  width: auto !important;
  min-height: 58px !important;
  padding: 9px 11px !important;
  gap: 8px !important;
  border-radius: 18px !important;
  border: 1px solid rgba(255,255,255,.14) !important;
  background: rgba(9, 14, 17, .44) !important;
  -webkit-backdrop-filter: blur(18px) saturate(145%) !important;
  backdrop-filter: blur(18px) saturate(145%) !important;
  box-shadow:
    0 14px 42px rgba(0,0,0,.28),
    inset 0 1px 0 rgba(255,255,255,.07) !important;
}

.protected-video-controls button {
  min-width: 44px !important;
  height: 44px !important;
  padding: 0 11px !important;
  border-radius: 13px !important;
  border: 1px solid rgba(255,255,255,.10) !important;
  background: rgba(255,255,255,.075) !important;
  color: #fff !important;
  box-shadow: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

.protected-video-controls button:active {
  transform: scale(.94) !important;
  background: rgba(255,255,255,.14) !important;
}

.protected-video-tracking-label {
  min-width: 0 !important;
  opacity: .78 !important;
  font-size: 10px !important;
  line-height: 1.25 !important;
  letter-spacing: .04em !important;
}

/* Keep controls usable in the v31/v32 pseudo-fullscreen fallback. */
.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-tap-layer {
  z-index: 2147483001 !important;
}

.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-center-toggle {
  z-index: 2147483003 !important;
}

.protected-video-shell.protected-video-shell-pseudo-fullscreen .protected-video-controls {
  z-index: 2147483002 !important;
}

/* Mobile: compact glass dock + larger center control. */
@media (max-width: 900px) {
  .protected-video-center-toggle {
    width: 68px !important;
    height: 68px !important;
  }

  .protected-video-controls {
    left: 10px !important;
    right: 10px !important;
    bottom: max(10px, env(safe-area-inset-bottom)) !important;
    min-height: 56px !important;
    padding: 8px 9px !important;
    border-radius: 17px !important;
  }

  .protected-video-controls button {
    min-width: 42px !important;
    height: 42px !important;
    padding: 0 9px !important;
  }

  .protected-video-tracking-label {
    flex: 1 1 auto !important;
    font-size: 9px !important;
  }
}

@media (max-width: 430px) {
  .protected-video-controls {
    gap: 6px !important;
  }

  .protected-video-controls button {
    min-width: 40px !important;
    height: 40px !important;
    padding: 0 8px !important;
    font-size: 12px !important;
  }

  .protected-video-tracking-label {
    font-size: 8px !important;
  }
}
`;

  if (!styles.includes("ADIL ACADEMY — PREMIUM MOBILE VIDEO CONTROLS v33")) {
    styles += css;
  }

  fs.writeFileSync(appPath, app, "utf8");
  fs.writeFileSync(stylesPath, styles, "utf8");

  console.log("✅ V33 Premium video controls update applied successfully.");
  console.log("✅ Play/Pause removed from the bottom control bar.");
  console.log("✅ Center Play/Pause control added.");
  console.log("✅ First tap reveals controls; controls still auto-hide using the existing timer.");
  console.log("✅ Bottom controls changed to a glass/blur design.");
  console.log("✅ 10s Back, Restart, tracking label and Fullscreen remain available.");
  console.log("✅ Resume, Q&A, Daily Limit and progress logic were not intentionally changed.");
  console.log(`✅ Backup: ${path.relative(ROOT, appBackup)}`);
  console.log(`✅ Backup: ${path.relative(ROOT, stylesBackup)}`);
} catch (error) {
  fs.writeFileSync(appPath, originalApp, "utf8");
  fs.writeFileSync(stylesPath, originalStyles, "utf8");
  console.error("❌ V33 patch stopped for safety and restored the original files.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
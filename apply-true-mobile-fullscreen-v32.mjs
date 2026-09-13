import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const appPath = path.join(ROOT, "client", "src", "App.tsx");

if (!fs.existsSync(appPath)) throw new Error("client/src/App.tsx not found");

const original = fs.readFileSync(appPath, "utf8");
const backup = appPath + ".before-true-fullscreen-v32";
if (!fs.existsSync(backup)) fs.copyFileSync(appPath, backup);

let app = original;

function replaceOnce(label, from, to) {
  const i = app.indexOf(from);
  if (i === -1) throw new Error(`Could not find expected code for: ${label}`);
  if (app.indexOf(from, i + from.length) !== -1) throw new Error(`Expected unique match for: ${label}`);
  app = app.slice(0, i) + to + app.slice(i + from.length);
}

try {
  const start = app.indexOf("  async function toggleFullscreen() {");
  const end = app.indexOf("\n  }\n\n", start);
  if (start === -1 || end === -1) throw new Error("toggleFullscreen() not found");

  const oldBlock = app.slice(start, end + 4);

  const newBlock = `  async function toggleFullscreen() {
    showControls();

    const shell = shellRef.current;
    const frame = frameRef.current;
    if (!shell) return;

    const docAny = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    const frameAny = frame as (HTMLIFrameElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    const shellAny = shell as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const activeElement =
      document.fullscreenElement ??
      docAny.webkitFullscreenElement ??
      null;

    // FULLSCREEN OUT
    if (activeElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (docAny.webkitExitFullscreen) {
          await docAny.webkitExitFullscreen();
        }
      } catch {
        // Browser may reject the exit request.
      } finally {
        setNativeFullscreen(false);
        setPseudoFullscreen(false);
      }
      return;
    }

    // Exit CSS fallback if it is currently active.
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }

    // TRUE FULLSCREEN IN:
    // Prefer the actual video iframe. This gives mobile browsers the best
    // chance to enter real browser fullscreen and hide URL/tool bars.
    try {
      if (frame?.requestFullscreen) {
        await frame.requestFullscreen();
        setNativeFullscreen(true);
        setPseudoFullscreen(false);
        return;
      }

      if (frameAny?.webkitRequestFullscreen) {
        await frameAny.webkitRequestFullscreen();
        setNativeFullscreen(true);
        setPseudoFullscreen(false);
        return;
      }

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
      // Continue to fallback below.
    }

    // Some iPhone/iOS browser contexts do not permit webpage/iframe fullscreen.
    // CSS fallback fills the viewport, but browser chrome can remain visible.
    setNativeFullscreen(false);
    setPseudoFullscreen(true);
  }`;

  app = app.slice(0, start) + newBlock + app.slice(end + 4);

  fs.writeFileSync(appPath, app, "utf8");
  console.log("✅ V32 TRUE fullscreen patch applied.");
  console.log("✅ Fullscreen now prefers the video iframe before the outer shell.");
  console.log("✅ Fullscreen OUT still uses the same button.");
  console.log("ℹ️ If iPhone WebKit rejects native fullscreen, browser URL/tool bars cannot be hidden by webpage CSS.");
  console.log(`✅ Backup: ${path.relative(ROOT, backup)}`);
} catch (e) {
  fs.writeFileSync(appPath, original, "utf8");
  console.error("❌ V32 patch stopped for safety and restored the original file.");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(message) {
  console.error("❌ v44 stopped safely:", message);
  process.exit(1);
}

const candidates = [
  path.join(root, "client/src/main.tsx"),
  path.join(root, "client/src/main.jsx"),
  path.join(root, "client/src/main.ts"),
  path.join(root, "client/src/main.js"),
];
const mainPath = candidates.find((item) => fs.existsSync(item));
if (!mainPath) fail("Could not find client/src/main.tsx (or main.jsx/main.ts/main.js).");

const payloadDir = path.join(root, "__adil_loader_v44_payload");
const tsPayload = path.join(payloadDir, "adilWarpLoader.ts");
const cssPayload = path.join(payloadDir, "adilWarpLoader.css");
const logoPayload = path.join(payloadDir, "adil-loader-logo.png");

for (const file of [tsPayload, cssPayload, logoPayload]) {
  if (!fs.existsSync(file)) fail(`Missing update payload file: ${path.basename(file)}`);
}

const backupDir = path.join(root, "backup", "global-loader-v44");
fs.mkdirSync(backupDir, { recursive: true });

const mainOriginal = fs.readFileSync(mainPath, "utf8");
fs.writeFileSync(path.join(backupDir, `${path.basename(mainPath)}.before-v44`), mainOriginal);

const targetTs = path.join(root, "client/src/adilWarpLoader.ts");
const targetCss = path.join(root, "client/src/adilWarpLoader.css");
const publicDir = path.join(root, "client/public");
const targetLogo = path.join(publicDir, "adil-loader-logo.png");

fs.mkdirSync(publicDir, { recursive: true });

for (const target of [targetTs, targetCss, targetLogo]) {
  if (fs.existsSync(target)) {
    fs.copyFileSync(target, path.join(backupDir, `${path.basename(target)}.before-v44`));
  }
}

fs.copyFileSync(tsPayload, targetTs);
fs.copyFileSync(cssPayload, targetCss);
fs.copyFileSync(logoPayload, targetLogo);

let main = mainOriginal;
const importLine = 'import "./adilWarpLoader";';

if (!main.includes(importLine)) {
  main = `${importLine}\n${main}`;
  fs.writeFileSync(mainPath, main);
  console.log(`✓ Added loader import to ${path.relative(root, mainPath)}`);
} else {
  console.log("• Loader import already exists");
}

console.log("✓ Added client/src/adilWarpLoader.ts");
console.log("✓ Added client/src/adilWarpLoader.css");
console.log("✓ Added client/public/adil-loader-logo.png");
console.log("");
console.log("✅ ADIL ACADEMY 3D Warped Global Loader v44 applied successfully.");
console.log("This update did NOT modify App.tsx, backend, database, payments, OTP, CCO, payout, or course logic.");
console.log("");
console.log("Next:");
console.log("  npm run check");
console.log("  npm run build");
console.log("  npm start");

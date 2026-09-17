import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "client", "src", "App.tsx");
const cssPath = path.join(root, "client", "src", "styles.css");
const payload = path.join(root, "__adil_home_v49_payload");
const imageSource = path.join(payload, "client", "public", "adil-home-hero-v49.jpg");
const imageTarget = path.join(root, "client", "public", "adil-home-hero-v49.jpg");

function fail(message) {
  console.error(`\n❌ v49 stopped safely: ${message}\n`);
  process.exit(1);
}

for (const file of [appPath, cssPath, imageSource]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const marker = "ADIL_HOME_V49_UI_ONLY";
const cssMarker = "ADIL ACADEMY — PREMIUM COLORFUL HOME UI v49";

if (!app.includes(marker)) {
  const homeStart = app.indexOf("function HomePage()");
  if (homeStart === -1) fail("HomePage() was not found.");

  const heroStart = app.indexOf('        <section className="academy-hero">', homeStart);
  if (heroStart === -1) fail("Existing homepage hero section was not found.");

  const coursesStart = app.indexOf(
    '        <section className="academy-section academy-courses-section" id="available-courses">',
    heroStart
  );
  if (coursesStart === -1) fail("Course catalog section was not found.");

  const heroMarkup = fs.readFileSync(
    path.join(payload, "hero-v49.fragment.txt"),
    "utf8"
  );

  app = app.slice(0, heroStart) + heroMarkup + app.slice(coursesStart);

  app = app.replace(
    '<span className="academy-eyebrow">COURSE CATALOG</span>\n                <h2>ඔබට ගැළපෙන පාඨමාලාව සොයාගන්න</h2>\n                <p>Admin විසින් publish කරන සියලු පාඨමාලා මෙහි ස්වයංක්‍රීයව පෙන්වයි.</p>',
    '<span className="academy-eyebrow">OUR COURSES</span>\n                <h2>Popular Learning Categories</h2>\n                <p>Explore the courses currently published by Adil Academy and choose the learning path that matches your goals.</p>'
  );
}

if (!css.includes(cssMarker)) {
  const addition = fs.readFileSync(
    path.join(payload, "home-v49.css"),
    "utf8"
  );
  css += `\n\n${addition}\n`;
}

const backupDir = path.join(root, "backup", "home-ui-v49");
fs.mkdirSync(backupDir, { recursive: true });

for (const file of [appPath, cssPath]) {
  const backup = path.join(backupDir, `${path.basename(file)}.before-v49`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
fs.copyFileSync(imageSource, imageTarget);

console.log("✓ client/src/App.tsx — homepage UI only");
console.log("✓ client/src/styles.css — homepage theme only");
console.log("✓ client/public/adil-home-hero-v49.jpg — hero visual");
console.log("\n✅ ADIL ACADEMY Premium Colorful Home UI v49 applied.");
console.log("No server, database, payment, course-access, CCO, consultant, payout or Revision logic was modified.");

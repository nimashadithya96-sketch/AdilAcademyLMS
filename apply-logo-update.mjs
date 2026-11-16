import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'client', 'src', 'App.tsx');
const cssPath = path.join(root, 'client', 'src', 'styles.css');
const logoPath = path.join(root, 'client', 'public', 'branding', 'adil-academy-logo.png');

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(appPath)) fail('client/src/App.tsx හමු වුණේ නැහැ. මේ command එක project root එකෙන් run කරන්න.');
if (!fs.existsSync(cssPath)) fail('client/src/styles.css හමු වුණේ නැහැ.');
if (!fs.existsSync(logoPath)) fail('Logo file එක package එකෙන් extract වෙලා නැහැ.');

const appBackup = `${appPath}.before-logo-update`;
const cssBackup = `${cssPath}.before-logo-update`;
if (!fs.existsSync(appBackup)) fs.copyFileSync(appPath, appBackup);
if (!fs.existsSync(cssBackup)) fs.copyFileSync(cssPath, cssBackup);

let app = fs.readFileSync(appPath, 'utf8');
const logoStart = app.indexOf('function Logo() {');
const headerStart = app.indexOf('\nfunction PublicHeader()', logoStart);
if (logoStart === -1 || headerStart === -1) {
  fail('Logo component එක හඳුනාගන්න බැරි වුණා. App.tsx වෙනස් version එකක් විය හැක.');
}

const newLogo = `function Logo() {\n  return (\n    <Link className="brand" to="/" aria-label="Adil Academy home">\n      <img\n        className="brand-logo-image"\n        src="/branding/adil-academy-logo.png"\n        alt="Adil Academy"\n        draggable={false}\n      />\n    </Link>\n  );\n}\n`;

app = app.slice(0, logoStart) + newLogo + app.slice(headerStart + 1);
fs.writeFileSync(appPath, app, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const logoCss = `/* ADIL ACADEMY - ORIGINAL BRAND LOGO */\n.brand-logo-image {\n  display: block;\n  width: auto;\n  height: 54px;\n  max-width: 220px;\n  object-fit: contain;\n  object-position: left center;\n  flex: 0 0 auto;\n  filter: drop-shadow(0 7px 16px rgba(220, 182, 89, 0.14));\n}\n\n.academy-brand .brand-logo-image {\n  height: 58px;\n  max-width: 235px;\n}\n\n.panel-sidebar .brand-logo-image,\n.sidebar-top .brand-logo-image {\n  height: 52px;\n}\n\n.academy-preview-topbar .brand-logo-image {\n  height: 50px;\n}\n\n@media (max-width: 650px) {\n  .brand-logo-image {\n    height: 44px;\n    max-width: 180px;\n  }\n\n  .academy-brand .brand-logo-image {\n    height: 47px;\n    max-width: 190px;\n  }\n}\n\n`;

const marker = '/* ADIL ACADEMY - ORIGINAL BRAND LOGO */';
const navIndex = css.indexOf('.nav-links {');
if (navIndex === -1) fail('styles.css එකේ .nav-links section එක හමු වුණේ නැහැ.');

const markerIndex = css.indexOf(marker);
if (markerIndex !== -1 && markerIndex < navIndex) {
  css = css.slice(0, markerIndex) + logoCss + css.slice(navIndex);
} else {
  css = css.slice(0, navIndex) + logoCss + css.slice(navIndex);
}
fs.writeFileSync(cssPath, css, 'utf8');

console.log('\n✅ ADIL ACADEMY original logo update applied successfully.');
console.log('✅ App.tsx backup: client/src/App.tsx.before-logo-update');
console.log('✅ styles.css backup: client/src/styles.css.before-logo-update');
console.log('✅ Logo: client/public/branding/adil-academy-logo.png\n');

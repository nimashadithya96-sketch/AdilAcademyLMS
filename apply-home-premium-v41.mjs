import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "client/src/App.tsx");
const cssPath = path.join(root, "client/src/styles.css");

function fail(message) {
  console.error("❌ v41 stopped safely:", message);
  process.exit(1);
}

if (!fs.existsSync(appPath) || !fs.existsSync(cssPath)) {
  fail("Expected client/src/App.tsx and client/src/styles.css were not found.");
}

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

for (const marker of ['className="academy-home"', 'className="academy-hero"', 'className="academy-faq-section"']) {
  if (!app.includes(marker) && !(marker === 'className="academy-home"' && app.includes('className="academy-home academy-home-v41"'))) {
    fail(`Current Home Page marker not found: ${marker}`);
  }
}
if (!css.includes(".academy-home") || !css.includes(".academy-course-card")) {
  fail("Current academy Home Page CSS markers were not found.");
}

const backupDir = path.join(root, "backup", "home-v41");
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, "App.tsx.before-v41"), app);
fs.writeFileSync(path.join(backupDir, "styles.css.before-v41"), css);

let changes = 0;

function replaceOnce(source, find, replacement, label) {
  if (source.includes(find)) {
    changes++;
    console.log(`✓ ${label}`);
    return source.replace(find, replacement);
  }
  console.log(`• ${label}: already changed or wording differs`);
  return source;
}

// HERO — keep the existing proven layout and live course hub, only refresh public positioning/copy.
{
  const heroStart = app.indexOf('className="academy-hero"');
  const coursesStart = app.indexOf('className="academy-section academy-courses-section"', heroStart);
  if (heroStart >= 0 && coursesStart > heroStart) {
    let hero = app.slice(heroStart, coursesStart);
    const originalHero = hero;

    hero = hero.replace(
      /(<span className="academy-kicker">)[\s\S]*?(<\/span>)/,
      '$1PRACTICAL ONLINE EDUCATION • SRI LANKA$2'
    );
    hero = hero.replace(
      /(<h1>)[\s\S]*?(<\/h1>)/,
      '$1Build Skills.<span>Shape Your Future.</span>$2'
    );
    hero = hero.replace(
      /(<div className="academy-hero-copy">[\s\S]*?<p>)[\s\S]*?(<\/p>)/,
      '$1Practical, structured online learning designed to build real-world skills in technology, digital finance, ICT and Korean language.$2'
    );

    if (hero !== originalHero) {
      app = app.slice(0, heroStart) + hero + app.slice(coursesStart);
      changes++;
      console.log("✓ Premium English hero messaging");
    } else {
      console.log("• Hero messaging: already changed or structure differs");
    }
  }
}

// Known public Home Sinhala copy -> polished English. Does NOT touch LMS/dashboard Sinhala content.
const copyReplacements = [
  [
    "Course එක තෝරා, application එක submit කර, approval ලැබුණු පසු secure student portal එකෙන් ඉගෙනීම අරඹන්න.",
    "Choose your course, submit your application, complete verification, and begin learning through your secure student portal.",
    "Learning journey copy"
  ],
  [
    "<h2>ඔබට අවශ්‍ය පිළිතුරු</h2>",
    "<h2>Everything You Need to Know</h2>",
    "FAQ heading"
  ],
  [
    "<p>Enrollment කිරීමට පෙර වැදගත් මූලික තොරතුරු මෙතැනින් බලන්න.</p>",
    "<p>Clear answers to the most important questions before you begin your learning journey.</p>",
    "FAQ introduction"
  ],
  [
    "<p>Course card එකේ Apply now හෝ Admission Form button එක භාවිත කර details සහ payment proof submit කරන්න.</p>",
    "<p>Use Apply Now or the Admission Form to submit your details and payment proof securely.</p>",
    "FAQ admission answer"
  ],
  [
    "ඔබට ගැලපෙන පාඨමාලාව තෝරන්න",
    "Choose the Course That Fits Your Goals",
    "Public course heading"
  ],
  [
    "ඔබේ ඉගෙනීම අදම ආරම්භ කරන්න",
    "Start Your Learning Journey Today",
    "Public CTA heading"
  ]
];

for (const [find, replacement, label] of copyReplacements) {
  app = replaceOnce(app, find, replacement, label);
}

if (app.includes('<div className="academy-home">')) {
  app = replaceOnce(
    app,
    '<div className="academy-home">',
    '<div className="academy-home academy-home-v41">',
    "Home v41 scope class"
  );
}

const styleMarker = "/* ===== ADIL ACADEMY HOME V41 PREMIUM ENGLISH ===== */";
if (!css.includes(styleMarker)) {
  css += `

${styleMarker}
.academy-home-v41{
  --aa-green:#8bff55;
  --aa-green-2:#49dc86;
  --aa-gold:#ddb85d;
  --aa-ink:#030805;
  --aa-panel:#09150e;
  --aa-soft:#a9bbb0;
  background:
    radial-gradient(circle at 12% 3%,rgba(221,184,93,.075),transparent 24%),
    radial-gradient(circle at 90% 16%,rgba(139,255,85,.075),transparent 25%),
    #030805;
}
.academy-home-v41 .academy-public-header{
  position:fixed;
  background:rgba(3,9,6,.82);
  border-color:rgba(255,255,255,.075);
  box-shadow:0 12px 40px rgba(0,0,0,.18);
  backdrop-filter:blur(22px) saturate(135%);
}
.academy-home-v41 .academy-nav-links>a:not(.button){position:relative;letter-spacing:.02em}
.academy-home-v41 .academy-nav-links>a:not(.button)::after{
  content:"";position:absolute;left:0;right:100%;bottom:-11px;height:2px;border-radius:99px;
  background:linear-gradient(90deg,var(--aa-gold),var(--aa-green));transition:right .25s ease;
}
.academy-home-v41 .academy-nav-links>a:not(.button):hover::after{right:0}

.academy-home-v41 .academy-hero{
  min-height:830px;padding-top:190px;
  background:
    radial-gradient(circle at 74% 22%,rgba(139,255,85,.14),transparent 25%),
    radial-gradient(circle at 14% 74%,rgba(221,184,93,.09),transparent 26%),
    linear-gradient(145deg,#020704 0%,#07140b 48%,#06180d 100%);
}
.academy-home-v41 .academy-hero:after{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(115deg,transparent 18%,rgba(255,255,255,.022) 48%,transparent 71%);
  background-size:220% 100%;animation:aaHomeShine 12s linear infinite;
}
.academy-home-v41 .academy-kicker{
  color:#dfffd3;border-color:rgba(139,255,85,.34);
  background:linear-gradient(90deg,rgba(139,255,85,.10),rgba(221,184,93,.06));
  box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 35px rgba(0,0,0,.15);
}
.academy-home-v41 .academy-hero h1{max-width:760px;text-wrap:balance;font-size:clamp(50px,6vw,84px)}
.academy-home-v41 .academy-hero h1 span{
  background:linear-gradient(90deg,var(--aa-green) 0%,#b8ff9a 48%,var(--aa-gold) 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.academy-home-v41 .academy-hero-copy>p{max-width:690px;color:#b2c1b7;font-size:17px}
.academy-home-v41 .academy-hero-actions .button-primary{
  border-color:var(--aa-green);background:linear-gradient(135deg,#91ff61,#64ed7e);
  box-shadow:0 15px 45px rgba(100,237,126,.18);
}
.academy-home-v41 .academy-hero-actions .button-primary:hover{
  transform:translateY(-2px);box-shadow:0 20px 55px rgba(100,237,126,.26);
}
.academy-home-v41 .academy-trust-row{gap:10px}
.academy-home-v41 .academy-trust-row span{
  padding:9px 12px;border:1px solid rgba(255,255,255,.08);border-radius:999px;
  background:rgba(255,255,255,.025);backdrop-filter:blur(10px);
}

.academy-home-v41 .academy-hub-card{
  border-color:rgba(139,255,85,.3);
  background:radial-gradient(circle at 88% 12%,rgba(221,184,93,.10),transparent 29%),linear-gradient(145deg,rgba(14,48,26,.98),rgba(4,16,9,.98));
  box-shadow:0 40px 120px rgba(0,0,0,.46),0 0 0 1px rgba(255,255,255,.025) inset;
  animation:aaHomeFloat 7s ease-in-out infinite;
}
.academy-home-v41 .academy-hub-course{backdrop-filter:blur(8px)}
.academy-home-v41 .academy-hub-course:hover{transform:translateX(5px) translateY(-1px);border-color:rgba(221,184,93,.42)}

.academy-home-v41 .academy-section{padding:116px 0}
.academy-home-v41 .academy-section-heading h2,
.academy-home-v41 .academy-journey-copy h2,
.academy-home-v41 .academy-platform-copy h2,
.academy-home-v41 .academy-faq-intro h2{ text-wrap:balance;font-size:clamp(36px,4.2vw,56px) }
.academy-home-v41 .academy-eyebrow{color:#a8ff83}

.academy-home-v41 .academy-courses-section{
  background:radial-gradient(circle at 0 0,rgba(139,255,85,.06),transparent 27%),linear-gradient(180deg,#07130c,#050d08);
}
.academy-home-v41 .academy-course-grid{gap:22px}
.academy-home-v41 .academy-course-card{
  border-color:rgba(255,255,255,.095);border-radius:24px;background:linear-gradient(165deg,#0b1a11,#07110b);
  box-shadow:0 20px 60px rgba(0,0,0,.22);
}
.academy-home-v41 .academy-course-card:hover{
  transform:translateY(-8px);border-color:rgba(139,255,85,.38);
  box-shadow:0 32px 85px rgba(0,0,0,.38),0 0 45px rgba(139,255,85,.045);
}
.academy-home-v41 .academy-course-image{height:220px}
.academy-home-v41 .academy-course-icon{border:1px solid rgba(221,184,93,.2)}
.academy-home-v41 .academy-course-meta strong{color:#b7ff9b}
.academy-home-v41 .academy-course-search{min-height:56px;border-radius:16px;background:rgba(9,23,14,.86)}

.academy-home-v41 .academy-benefit-card{
  min-height:270px;border-radius:22px;
  background:radial-gradient(circle at 90% 5%,rgba(139,255,85,.055),transparent 30%),linear-gradient(145deg,#0b1911,#06100a);
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.academy-home-v41 .academy-benefit-card:hover{
  transform:translateY(-6px);border-color:rgba(221,184,93,.27);box-shadow:0 24px 65px rgba(0,0,0,.28);
}
.academy-home-v41 .academy-benefit-card>span{color:rgba(221,184,93,.18)}
.academy-home-v41 .academy-benefit-card>div{box-shadow:0 10px 32px rgba(139,255,85,.05)}

.academy-home-v41 .academy-journey-section{
  position:relative;background:radial-gradient(circle at 17% 40%,rgba(221,184,93,.07),transparent 28%),linear-gradient(140deg,#0d2a18,#06140c);
}
.academy-home-v41 .academy-step{
  min-height:290px;border-radius:22px;background:linear-gradient(160deg,rgba(7,23,13,.84),rgba(2,11,6,.7));transition:.25s ease;
}
.academy-home-v41 .academy-step:hover{transform:translateY(-5px);border-color:rgba(139,255,85,.3)}
.academy-home-v41 .academy-step>span{color:var(--aa-gold)}

.academy-home-v41 .academy-platform-preview{
  border-radius:28px;border-color:rgba(139,255,85,.28);
  box-shadow:0 36px 100px rgba(0,0,0,.34),0 0 65px rgba(139,255,85,.035);
}
.academy-home-v41 .academy-preview-progress span{background:linear-gradient(90deg,var(--aa-green),var(--aa-green-2),var(--aa-gold))}

.academy-home-v41 .academy-faq-section{
  background:radial-gradient(circle at 80% 30%,rgba(139,255,85,.045),transparent 27%),#040b07;
}
.academy-home-v41 .academy-faq-list details{
  border-radius:18px;background:linear-gradient(145deg,#09170f,#06100a);box-shadow:0 14px 40px rgba(0,0,0,.10);
}
.academy-home-v41 .academy-faq-list details[open]{border-color:rgba(139,255,85,.34);box-shadow:0 18px 55px rgba(0,0,0,.20)}
.academy-home-v41 .academy-faq-list summary{min-height:74px;font-size:14px}

.academy-home-v41 .academy-cta-card{
  padding:56px;border-radius:30px;border-color:rgba(139,255,85,.3);
  background:radial-gradient(circle at 82% 10%,rgba(139,255,85,.22),transparent 28%),radial-gradient(circle at 10% 100%,rgba(221,184,93,.10),transparent 28%),linear-gradient(140deg,#123520,#06150c);
  box-shadow:0 28px 85px rgba(0,0,0,.28);
}
.academy-home-v41 .academy-footer{background:radial-gradient(circle at 15% 0,rgba(221,184,93,.045),transparent 24%),#020805}

@keyframes aaHomeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes aaHomeShine{from{background-position:130% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){
  .academy-home-v41 .academy-hub-card,.academy-home-v41 .academy-hero:after{animation:none}
  .academy-home-v41 *{scroll-behavior:auto!important}
}
@media (max-width:980px){
  .academy-home-v41 .academy-public-header{position:absolute}
  .academy-home-v41 .academy-hero{min-height:auto;padding-top:148px}
  .academy-home-v41 .academy-hub-card{animation:none}
  .academy-home-v41 .academy-section{padding:88px 0}
  .academy-home-v41 .academy-cta-card{padding:38px}
}
@media (max-width:680px){
  .academy-home-v41 .section-shell{width:min(100% - 28px,1180px)}
  .academy-home-v41 .academy-hero{padding-top:132px;padding-bottom:76px}
  .academy-home-v41 .academy-hero h1{font-size:clamp(42px,13vw,60px)}
  .academy-home-v41 .academy-hero-copy>p{font-size:15px;line-height:1.7}
  .academy-home-v41 .academy-trust-row span{font-size:10px}
  .academy-home-v41 .academy-course-image{height:195px}
  .academy-home-v41 .academy-section{padding:72px 0}
  .academy-home-v41 .academy-cta-card{padding:30px 24px;border-radius:23px}
}
/* ===== END ADIL ACADEMY HOME V41 ===== */
`;
  changes++;
  console.log("✓ Premium responsive Home Page visual layer");
} else {
  console.log("• Premium visual layer already present");
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);

console.log("");
console.log("✅ ADIL ACADEMY Home Page v41 applied successfully.");
console.log("Modified only:");
console.log("  client/src/App.tsx");
console.log("  client/src/styles.css");
console.log(`Changes applied: ${changes}`);
console.log("");
console.log("Next:");
console.log("  npm run check");
console.log("  npm run build");
console.log("  npm start");

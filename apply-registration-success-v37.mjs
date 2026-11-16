import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const appPath = path.join(ROOT, "client", "src", "App.tsx");
const stylesPath = path.join(ROOT, "client", "src", "styles.css");
const routePath = path.join(ROOT, "server", "modules", "platform", "routes.ts");

for (const p of [appPath, stylesPath, routePath]) {
  if (!fs.existsSync(p)) throw new Error(`${path.relative(ROOT, p)} not found`);
}

const originalApp = fs.readFileSync(appPath, "utf8");
const originalStyles = fs.readFileSync(stylesPath, "utf8");
const originalRoute = fs.readFileSync(routePath, "utf8");

const backups = [
  [appPath, `${appPath}.before-registration-success-v37`],
  [stylesPath, `${stylesPath}.before-registration-success-v37`],
  [routePath, `${routePath}.before-registration-success-v37`]
];
for (const [src, backup] of backups) {
  if (!fs.existsSync(backup)) fs.copyFileSync(src, backup);
}

function getComponentBounds(source) {
  const startToken = "function AdminStudentRegistrationWorkspace(";
  const start = source.indexOf(startToken);
  if (start === -1) throw new Error("AdminStudentRegistrationWorkspace was not found in client/src/App.tsx");

  const rest = source.slice(start + startToken.length);
  const nextFunctionMatch = rest.match(/\nfunction\s+[A-Za-z0-9_]+\s*\(/);
  if (!nextFunctionMatch || nextFunctionMatch.index == null) {
    throw new Error("Could not safely determine the end of AdminStudentRegistrationWorkspace");
  }
  const end = start + startToken.length + nextFunctionMatch.index;
  return { start, end };
}

function replaceComponent(source, updater) {
  const { start, end } = getComponentBounds(source);
  const before = source.slice(0, start);
  const component = source.slice(start, end);
  const after = source.slice(end);
  return before + updater(component) + after;
}

try {
  let app = originalApp;
  let styles = originalStyles;
  let route = originalRoute;

  // ----------------------------------------------------------
  // FRONTEND: Admin -> Students -> Register New Student only
  // ----------------------------------------------------------
  app = replaceComponent(app, (component) => {
    let c = component;

    // 1. Success modal state.
    if (!c.includes("const [registrationSuccess, setRegistrationSuccess]")) {
      const stateAnchor = /(^\s*const \[error, setError\] = useState\(""\);\s*$)/m;
      if (!stateAnchor.test(c)) throw new Error("Could not locate registration error state safely");
      c = c.replace(stateAnchor, `$1\n  const [registrationSuccess, setRegistrationSuccess] = useState<{\n    studentName: string;\n    payId: string;\n    expiresAt: string;\n  } | null>(null);`);
    }

    // 2. Replace only the success response handling in this component.
    if (!c.includes("setRegistrationSuccess({")) {
      const startAnchor = "    const data = await response.json().catch(() => ({}))";
      const responseStart = c.indexOf(startAnchor);
      if (responseStart === -1) throw new Error("Could not locate admin registration response handling");

      const responseEndToken = "    setBusy(false);";
      const responseEndAt = c.indexOf(responseEndToken, responseStart);
      if (responseEndAt === -1) throw new Error("Could not locate the end of admin registration response handling");
      const responseEnd = responseEndAt + responseEndToken.length;

      const replacement = `    const data = await response.json().catch(() => ({})) as {\n      message?: string;\n      payId?: string;\n      expiresAt?: string;\n    };\n\n    if (response.ok) {\n      const studentName = [\n        String(form.get("firstName") ?? "").trim(),\n        String(form.get("lastName") ?? "").trim()\n      ].filter(Boolean).join(" ") || "Student";\n\n      setMessage("");\n      setRegistrationSuccess({\n        studentName,\n        payId: String(data.payId ?? "").trim() || "Pay ID generated",\n        expiresAt: String(data.expiresAt ?? "").trim()\n      });\n    } else {\n      setError(data.message ?? \`Registration failed (HTTP \${response.status}).\`);\n    }\n\n    setBusy(false);`;

      c = c.slice(0, responseStart) + replacement + c.slice(responseEnd);
    }

    // 3. Exact expiry formatter in Sri Lanka time.
    if (!c.includes("function formatRegistrationExpiry")) {
      const returnAnchor = '  return <section className="dash-card workspace-card consultant-registration admin-student-registration">';
      const returnAt = c.indexOf(returnAnchor);
      if (returnAt === -1) throw new Error("Could not locate Admin Student Registration render section");

      const formatter = `  function formatRegistrationExpiry(value: string) {\n    if (!value) return "Expiry time unavailable";\n\n    const date = new Date(value);\n    if (Number.isNaN(date.getTime())) return value;\n\n    return new Intl.DateTimeFormat("en-LK", {\n      timeZone: "Asia/Colombo",\n      year: "numeric",\n      month: "long",\n      day: "2-digit",\n      hour: "numeric",\n      minute: "2-digit",\n      second: "2-digit",\n      hour12: true\n    }).format(date);\n  }\n\n`;
      c = c.slice(0, returnAt) + formatter + c.slice(returnAt);
    }

    // 4. Professional popup. It stays open until Admin presses OK.
    if (!c.includes("registration-success-overlay-v37")) {
      const loadingAnchor = '    {loading && <p className="registration-note">Courses සහ active consultant accounts load වෙමින් පවතී...</p>}';
      const loadingAt = c.indexOf(loadingAnchor);
      if (loadingAt === -1) throw new Error("Could not locate safe modal insertion point");

      const modal = `    {registrationSuccess && <div\n      className="registration-success-overlay-v37"\n      role="dialog"\n      aria-modal="true"\n      aria-labelledby="registration-success-title-v37"\n    >\n      <div className="registration-success-modal-v37">\n        <div className="registration-success-tick-v37" aria-hidden="true">✓</div>\n\n        <h3 id="registration-success-title-v37">Student Registration Successful!</h3>\n\n        <div className="registration-success-info-v37">\n          <div className="registration-success-row-v37">\n            <span>Student Name</span>\n            <strong>{registrationSuccess.studentName}</strong>\n          </div>\n\n          <div className="registration-success-row-v37">\n            <span>Pay ID</span>\n            <strong className="registration-success-payid-v37">{registrationSuccess.payId}</strong>\n          </div>\n        </div>\n\n        <div className="registration-success-expiry-v37">\n          <p>The student registration will expire if payment is not made by the student on or before:</p>\n          <strong>{formatRegistrationExpiry(registrationSuccess.expiresAt)}</strong>\n          <small>Sri Lanka Time (Asia/Colombo)</small>\n        </div>\n\n        <button\n          type="button"\n          className="registration-success-ok-v37"\n          onClick={() => {\n            setRegistrationSuccess(null);\n            void onCreated();\n          }}\n          autoFocus\n        >\n          OK\n        </button>\n      </div>\n    </div>}\n\n`;
      c = c.slice(0, loadingAt) + modal + c.slice(loadingAt);
    }

    return c;
  });

  // ----------------------------------------------------------
  // BACKEND: return existing generated Pay ID + expiresAt.
  // Robustly target the response immediately after sendPayId().
  // ----------------------------------------------------------
  const sendAnchor = "await sendPayId(email, code, expiresAt);";
  const sendAt = route.indexOf(sendAnchor);
  if (sendAt === -1) throw new Error("Could not locate the Admin registration sendPayId call");

  const responseAnchor = "response.status(201).json({";
  const responseAt = route.indexOf(responseAnchor, sendAt);
  if (responseAt === -1) throw new Error("Could not locate the Admin registration 201 response after sendPayId");

  const responseCloseToken = "\n    });";
  const responseCloseAt = route.indexOf(responseCloseToken, responseAt);
  if (responseCloseAt === -1) throw new Error("Could not safely determine the Admin registration response block");

  const responseEnd = responseCloseAt + responseCloseToken.length;
  let responseBlock = route.slice(responseAt, responseEnd);

  if (!responseBlock.includes("registration:") || !responseBlock.includes("expiresAt")) {
    throw new Error("Located 201 response did not look like the expected Admin registration response");
  }

  if (!/\bpayId\s*:/.test(responseBlock)) {
    const payIdSentPattern = /(\n\s*)payIdSent\s*:\s*true\s*,/;
    if (!payIdSentPattern.test(responseBlock)) {
      throw new Error("Could not locate payIdSent in the Admin registration API response");
    }
    responseBlock = responseBlock.replace(payIdSentPattern, `$1payId: code,$1payIdSent: true,`);
    route = route.slice(0, responseAt) + responseBlock + route.slice(responseEnd);
  }

  // ----------------------------------------------------------
  // CSS: popup only
  // ----------------------------------------------------------
  const cssMarker = "ADIL_REGISTRATION_SUCCESS_MODAL_V37";
  if (!styles.includes(cssMarker)) {
    styles += `\n\n/* ==========================================================\n   ${cssMarker}\n   Admin -> Students -> Register New Student\n   ========================================================== */\n\n.registration-success-overlay-v37 {\n  position: fixed;\n  inset: 0;\n  z-index: 2147482500;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  background: rgba(5, 12, 8, .68);\n  -webkit-backdrop-filter: blur(8px);\n  backdrop-filter: blur(8px);\n}\n\n.registration-success-modal-v37 {\n  width: min(520px, 100%);\n  max-height: calc(100dvh - 32px);\n  overflow: auto;\n  padding: 30px 28px 26px;\n  border: 1px solid rgba(19, 137, 64, .16);\n  border-radius: 24px;\n  background: #ffffff;\n  color: #142018;\n  text-align: center;\n  box-shadow: 0 34px 100px rgba(0, 0, 0, .38), 0 8px 26px rgba(35, 150, 77, .08);\n}\n\n.registration-success-tick-v37 {\n  width: 72px;\n  height: 72px;\n  margin: 0 auto 18px;\n  display: grid;\n  place-items: center;\n  border-radius: 999px;\n  background: #16a34a;\n  color: #ffffff;\n  font-size: 42px;\n  font-weight: 900;\n  line-height: 1;\n  box-shadow: 0 12px 32px rgba(22, 163, 74, .26);\n}\n\n.registration-success-modal-v37 h3 {\n  margin: 0 0 22px;\n  color: #101d15;\n  font-size: clamp(22px, 4vw, 29px);\n  line-height: 1.2;\n  letter-spacing: -.02em;\n}\n\n.registration-success-info-v37 {\n  display: grid;\n  gap: 10px;\n  margin-bottom: 18px;\n}\n\n.registration-success-row-v37 {\n  display: grid;\n  grid-template-columns: 130px 1fr;\n  gap: 14px;\n  align-items: center;\n  padding: 13px 15px;\n  border: 1px solid #e6eee8;\n  border-radius: 14px;\n  background: #f8fbf9;\n  text-align: left;\n}\n\n.registration-success-row-v37 span {\n  color: #65736a;\n  font-size: 13px;\n  font-weight: 800;\n  text-transform: uppercase;\n  letter-spacing: .05em;\n}\n\n.registration-success-row-v37 strong {\n  color: #17251c;\n  overflow-wrap: anywhere;\n}\n\n.registration-success-payid-v37 {\n  display: inline-block;\n  color: #08742f !important;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n  font-size: 15px;\n  letter-spacing: .03em;\n}\n\n.registration-success-expiry-v37 {\n  margin: 0 0 22px;\n  padding: 17px 16px;\n  border: 1px solid #dce9df;\n  border-radius: 16px;\n  background: #f5faf6;\n}\n\n.registration-success-expiry-v37 p {\n  margin: 0 0 10px;\n  color: #506058;\n  font-size: 14px;\n  line-height: 1.55;\n}\n\n.registration-success-expiry-v37 strong {\n  display: block;\n  color: #126b32;\n  font-size: 18px;\n  line-height: 1.35;\n}\n\n.registration-success-expiry-v37 small {\n  display: block;\n  margin-top: 5px;\n  color: #78847d;\n}\n\n.registration-success-ok-v37 {\n  width: 100%;\n  min-height: 48px;\n  border: 0;\n  border-radius: 13px;\n  background: #159447;\n  color: #ffffff;\n  font: inherit;\n  font-weight: 850;\n  cursor: pointer;\n  box-shadow: 0 10px 24px rgba(21, 148, 71, .20);\n}\n\n.registration-success-ok-v37:hover {\n  filter: brightness(.95);\n}\n\n.registration-success-ok-v37:focus-visible {\n  outline: 3px solid rgba(21, 148, 71, .24);\n  outline-offset: 3px;\n}\n\n@media (max-width: 560px) {\n  .registration-success-overlay-v37 { padding: 14px; }\n  .registration-success-modal-v37 { padding: 24px 18px 20px; border-radius: 20px; }\n  .registration-success-row-v37 { grid-template-columns: 1fr; gap: 5px; }\n}\n`;
  }

  // Write only after every safety check has passed.
  fs.writeFileSync(appPath, app);
  fs.writeFileSync(stylesPath, styles);
  fs.writeFileSync(routePath, route);

  console.log("✅ v37 applied successfully.");
  console.log("Modified only:");
  console.log("  client/src/App.tsx");
  console.log("  client/src/styles.css");
  console.log("  server/modules/platform/routes.ts");
  console.log("Next: npm run check");
} catch (error) {
  // Restore originals from memory so a partial patch can never remain.
  fs.writeFileSync(appPath, originalApp);
  fs.writeFileSync(stylesPath, originalStyles);
  fs.writeFileSync(routePath, originalRoute);
  console.error("❌ v37 stopped for safety and restored the original files.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

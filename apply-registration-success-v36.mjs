import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const appPath = path.join(ROOT, "client", "src", "App.tsx");
const stylesPath = path.join(ROOT, "client", "src", "styles.css");
const routesPath = path.join(ROOT, "server", "modules", "platform", "routes.ts");

for (const p of [appPath, stylesPath, routesPath]) {
  if (!fs.existsSync(p)) throw new Error(`${path.relative(ROOT, p)} not found`);
}

const originalApp = fs.readFileSync(appPath, "utf8");
const originalStyles = fs.readFileSync(stylesPath, "utf8");
const originalRoutes = fs.readFileSync(routesPath, "utf8");

const backups = [
  [appPath, appPath + ".before-registration-success-v36"],
  [stylesPath, stylesPath + ".before-registration-success-v36"],
  [routesPath, routesPath + ".before-registration-success-v36"]
];

for (const [src, dest] of backups) {
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}

let app = originalApp;
let styles = originalStyles;
let routes = originalRoutes;

function replaceOnceInText(text, label, from, to) {
  const idx = text.indexOf(from);
  if (idx === -1) throw new Error(`Could not find expected code for: ${label}`);
  if (text.indexOf(from, idx + from.length) !== -1) {
    throw new Error(`Expected unique match for: ${label}`);
  }
  return text.slice(0, idx) + to + text.slice(idx + from.length);
}

function getAdminComponentRange(text) {
  const start = text.indexOf("function AdminStudentRegistrationWorkspace(");
  const end = text.indexOf("\nfunction ConsultantStudentRegistration()", start);
  if (start === -1 || end === -1) throw new Error("AdminStudentRegistrationWorkspace range not found");
  return { start, end };
}

try {
  // --- BACKEND: include actual generated Pay ID in success response ---
  routes = replaceOnceInText(
    routes,
    "admin registration API response",
`    response.status(201).json({
      registration: { id: result.registration.id, status: result.registration.status, source: result.registration.registrationSource },
      payIdSent: true,
      expiresAt
    });`,
`    response.status(201).json({
      registration: { id: result.registration.id, status: result.registration.status, source: result.registration.registrationSource },
      payId: code,
      payIdSent: true,
      expiresAt
    });`
  );

  // Work only inside AdminStudentRegistrationWorkspace.
  const range = getAdminComponentRange(app);
  let before = app.slice(0, range.start);
  let component = app.slice(range.start, range.end);
  let after = app.slice(range.end);

  component = replaceOnceInText(
    component,
    "admin registration modal state",
`  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [withoutNic, setWithoutNic] = useState(false);`,
`  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    studentName: string;
    payId: string;
    expiresAt: string;
  } | null>(null);
  const [withoutNic, setWithoutNic] = useState(false);`
  );

  component = replaceOnceInText(
    component,
    "admin registration submit response handling",
`    const data = await response.json().catch(() => ({})) as { message?: string; payId?: string };
    if (response.ok) {
      setMessage(\`Registration saved. \${data.payId ?? "Pay ID"} studentගේ email එකට යවා ඇත.\`);
      await onCreated();
    } else {
      setError(data.message ?? \`Registration failed (HTTP \${response.status}).\`);
    }
    setBusy(false);`,
`    const data = await response.json().catch(() => ({})) as {
      message?: string;
      payId?: string;
      expiresAt?: string;
    };
    if (response.ok) {
      const firstName = String(form.get("firstName") ?? "").trim();
      const lastName = String(form.get("lastName") ?? "").trim();
      const studentName = [firstName, lastName].filter(Boolean).join(" ") || "Student";

      setMessage("");
      setRegistrationSuccess({
        studentName,
        payId: String(data.payId ?? "").trim() || "Pay ID generated",
        expiresAt: String(data.expiresAt ?? "").trim()
      });

      await onCreated();
    } else {
      setError(data.message ?? \`Registration failed (HTTP \${response.status}).\`);
    }
    setBusy(false);`
  );

  component = replaceOnceInText(
    component,
    "admin registration formatter insertion",
`  return <section className="dash-card workspace-card consultant-registration admin-student-registration">`,
`  function formatRegistrationExpiry(value: string) {
    if (!value) return "48 hours from registration";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-LK", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  return <section className="dash-card workspace-card consultant-registration admin-student-registration">`
  );

  component = replaceOnceInText(
    component,
    "admin registration success modal",
`    </div>
    {loading && <p className="registration-note">Courses සහ active consultant accounts load වෙමින් පවතී...</p>}
    {message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}`,
`    </div>

    {registrationSuccess && <div
      className="registration-success-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-success-title"
    >
      <div className="registration-success-modal">
        <div className="registration-success-icon" aria-hidden="true">✓</div>

        <h3 id="registration-success-title">Student Registration Successful!</h3>

        <div className="registration-success-details">
          <div>
            <span>Student Name</span>
            <strong>{registrationSuccess.studentName}</strong>
          </div>
          <div>
            <span>Pay ID</span>
            <strong className="registration-success-payid">{registrationSuccess.payId}</strong>
          </div>
        </div>

        <div className="registration-success-expiry">
          <p>The student registration will expire if payment is not made by the student on or before:</p>
          <strong>{formatRegistrationExpiry(registrationSuccess.expiresAt)}</strong>
          <small>Sri Lanka Time (Asia/Colombo)</small>
        </div>

        <button
          type="button"
          className="registration-success-ok"
          onClick={() => setRegistrationSuccess(null)}
          autoFocus
        >
          OK
        </button>
      </div>
    </div>}

    {loading && <p className="registration-note">Courses සහ active consultant accounts load වෙමින් පවතී...</p>}
    {message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}`
  );

  app = before + component + after;

  const marker = "ADIL_REGISTRATION_SUCCESS_MODAL_V36";
  if (!styles.includes(marker)) {
    styles += `

/* ==========================================================
   ADIL_REGISTRATION_SUCCESS_MODAL_V36
   Admin -> Students -> Register New Student
   ========================================================== */

.registration-success-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147482000;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(0, 8, 4, .72);
  -webkit-backdrop-filter: blur(9px);
  backdrop-filter: blur(9px);
}

.registration-success-modal {
  width: min(520px, 100%);
  max-height: calc(100dvh - 28px);
  overflow: auto;
  padding: 30px 28px 25px;
  border: 1px solid rgba(20, 120, 55, .15);
  border-radius: 24px;
  background: #ffffff;
  color: #142018;
  text-align: center;
  box-shadow:
    0 32px 90px rgba(0,0,0,.34),
    0 10px 30px rgba(22,135,61,.10);
}

.registration-success-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #66f45b, #20be55);
  color: #fff;
  font-size: 39px;
  font-weight: 900;
  box-shadow:
    0 14px 32px rgba(32,190,85,.25),
    inset 0 1px 0 rgba(255,255,255,.5);
}

.registration-success-modal h3 {
  margin: 0 0 22px;
  color: #102117;
  font-size: clamp(23px, 4vw, 30px);
  line-height: 1.18;
  letter-spacing: -.025em;
}

.registration-success-details {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  text-align: left;
}

.registration-success-details > div {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #e1e9e3;
  border-radius: 14px;
  background: #f8fbf9;
}

.registration-success-details span {
  color: #758178;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.registration-success-details strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #17221b;
  font-size: 15px;
}

.registration-success-payid {
  color: #10883d !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  letter-spacing: .02em;
}

.registration-success-expiry {
  margin: 16px 0 22px;
  padding: 18px 16px;
  border: 1px solid #d8eadd;
  border-radius: 16px;
  background: linear-gradient(180deg, #f5fff7, #eefaf1);
}

.registration-success-expiry p {
  margin: 0 0 9px;
  color: #58665d;
  font-size: 13px;
  line-height: 1.55;
}

.registration-success-expiry strong {
  display: block;
  color: #0f7f38;
  font-size: 18px;
  line-height: 1.35;
}

.registration-success-expiry small {
  display: block;
  margin-top: 5px;
  color: #839088;
  font-size: 11px;
}

.registration-success-ok {
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(90deg, #5af05d, #2fd36a);
  color: #06170c;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(47,211,106,.22);
  transition: transform 150ms ease, filter 150ms ease;
}

.registration-success-ok:hover {
  filter: brightness(1.03);
}

.registration-success-ok:active {
  transform: scale(.985);
}

@media (max-width: 600px) {
  .registration-success-overlay {
    padding: 14px;
  }

  .registration-success-modal {
    padding: 25px 18px 20px;
    border-radius: 21px;
  }

  .registration-success-icon {
    width: 64px;
    height: 64px;
    font-size: 34px;
  }

  .registration-success-details > div {
    grid-template-columns: 1fr;
    gap: 5px;
    padding: 13px 14px;
  }

  .registration-success-expiry strong {
    font-size: 17px;
  }
}

/* END ADIL_REGISTRATION_SUCCESS_MODAL_V36 */
`;
  }

  fs.writeFileSync(appPath, app, "utf8");
  fs.writeFileSync(stylesPath, styles, "utf8");
  fs.writeFileSync(routesPath, routes, "utf8");

  console.log("✅ V36 Student Registration Success popup applied successfully.");
  console.log("✅ Backend now returns the actual generated Pay ID.");
  console.log("✅ Admin popup shows Student Name, Pay ID and exact 48-hour expiry.");
  console.log("✅ Expiry is formatted in Asia/Colombo time.");
  console.log("✅ White responsive modal + green success tick + OK button added.");
  console.log("✅ No database migration required.");
  console.log("✅ Existing email/payment/consultant logic was not intentionally changed.");
} catch (error) {
  fs.writeFileSync(appPath, originalApp, "utf8");
  fs.writeFileSync(stylesPath, originalStyles, "utf8");
  fs.writeFileSync(routesPath, originalRoutes, "utf8");
  console.error("❌ V36 patch stopped for safety and restored the original files.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
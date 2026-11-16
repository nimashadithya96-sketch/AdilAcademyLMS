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
  [appPath, appPath + ".before-registration-success-v35"],
  [stylesPath, stylesPath + ".before-registration-success-v35"],
  [routePath, routePath + ".before-registration-success-v35"]
];

for (const [src, dest] of backups) {
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}

let app = originalApp;
let styles = originalStyles;
let route = originalRoute;

function replaceUnique(source, label, from, to) {
  const index = source.indexOf(from);
  if (index === -1) throw new Error(`Could not find expected code for: ${label}`);
  if (source.indexOf(from, index + from.length) !== -1) {
    throw new Error(`Expected unique match for: ${label}`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

try {
  // Backend: return the generated Pay ID itself as well as the expiry.
  route = replaceUnique(
    route,
    "admin registration response",
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

  // Frontend: add success modal state in AdminStudentRegistrationWorkspace.
  app = replaceUnique(
    app,
    "admin registration state",
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

  // Replace response handling only in admin registration submit.
  app = replaceUnique(
    app,
    "admin registration success handling",
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
      const payId = String(data.payId ?? "").trim();
      const expiresAt = String(data.expiresAt ?? "").trim();

      setMessage("");
      setRegistrationSuccess({
        studentName,
        payId: payId || "Pay ID generated",
        expiresAt
      });

      event.currentTarget.reset();
      setWithoutNic(false);
      setProvince("");
      setDistrict("");
      setSelectedCourseId("");
      setPaymentPlan("FULL");
      setAssignmentType("DIRECT");

      await onCreated();
    } else {
      setError(data.message ?? \`Registration failed (HTTP \${response.status}).\`);
    }
    setBusy(false);`
  );

  // Add formatter before return in this component.
  app = replaceUnique(
    app,
    "admin registration return insertion",
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

  // Insert modal after heading, before loading status.
  app = replaceUnique(
    app,
    "admin registration modal insertion",
`    </div>
    {loading && <p className="registration-note">Courses සහ active consultant accounts load වෙමින් පවතී...</p>}`,
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
        <p className="registration-success-intro">
          Student registration එක සාර්ථකව save කර Pay ID එක යවා ඇත.
        </p>

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

    {loading && <p className="registration-note">Courses සහ active consultant accounts load වෙමින් පවතී...</p>}`
  );

  const cssMarker = "ADIL_REGISTRATION_SUCCESS_MODAL_V35";
  if (!styles.includes(cssMarker)) {
    styles += `

/* ==========================================================
   ADIL_REGISTRATION_SUCCESS_MODAL_V35
   Admin -> Students -> Register New Student
   ========================================================== */

.registration-success-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147482000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(1, 8, 5, .72);
  -webkit-backdrop-filter: blur(9px);
  backdrop-filter: blur(9px);
}

.registration-success-modal {
  width: min(520px, 100%);
  max-height: min(760px, calc(100dvh - 32px));
  overflow: auto;
  padding: 30px 28px 26px;
  border: 1px solid rgba(20, 120, 55, .16);
  border-radius: 24px;
  background: #ffffff;
  color: #122017;
  text-align: center;
  box-shadow:
    0 30px 90px rgba(0, 0, 0, .32),
    0 8px 28px rgba(15, 95, 45, .10);
}

.registration-success-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(145deg, #62f65b, #20bf55);
  color: #ffffff;
  font-size: 38px;
  font-weight: 900;
  line-height: 1;
  box-shadow:
    0 14px 30px rgba(32, 191, 85, .24),
    inset 0 1px 0 rgba(255,255,255,.45);
}

.registration-success-modal h3 {
  margin: 0;
  color: #102217;
  font-size: clamp(23px, 4vw, 30px);
  line-height: 1.15;
  letter-spacing: -.025em;
}

.registration-success-intro {
  margin: 10px auto 22px;
  max-width: 420px;
  color: #617067;
  font-size: 14px;
  line-height: 1.6;
}

.registration-success-details {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
  text-align: left;
}

.registration-success-details > div {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #e2e9e4;
  border-radius: 14px;
  background: #f8fbf9;
}

.registration-success-details span {
  color: #718078;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.registration-success-details strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #17231b;
  font-size: 15px;
}

.registration-success-payid {
  color: #0f8b3c !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 15px !important;
  letter-spacing: .02em;
}

.registration-success-expiry {
  margin: 16px 0 22px;
  padding: 18px 16px;
  border: 1px solid #d9eadf;
  border-radius: 16px;
  background: linear-gradient(180deg, #f5fff7, #effaf2);
}

.registration-success-expiry p {
  margin: 0 0 9px;
  color: #55645b;
  font-size: 13px;
  line-height: 1.55;
}

.registration-success-expiry strong {
  display: block;
  color: #107d37;
  font-size: 18px;
  line-height: 1.35;
}

.registration-success-expiry small {
  display: block;
  margin-top: 4px;
  color: #819087;
  font-size: 11px;
}

.registration-success-ok {
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(90deg, #56ee59, #2fd66a);
  color: #07170d;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 25px rgba(47, 214, 106, .20);
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
    align-items: center;
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
/* END ADIL_REGISTRATION_SUCCESS_MODAL_V35 */
`;
  }

  fs.writeFileSync(appPath, app, "utf8");
  fs.writeFileSync(stylesPath, styles, "utf8");
  fs.writeFileSync(routePath, route, "utf8");

  console.log("✅ V35 Student Registration Success popup update applied successfully.");
  console.log("✅ Generated Pay ID is now returned to the admin screen after successful registration.");
  console.log("✅ Popup shows Student Name, Pay ID and exact 48-hour expiry date/time.");
  console.log("✅ Expiry is displayed in Asia/Colombo time.");
  console.log("✅ White responsive success card, green tick and OK close button added.");
  console.log("✅ Existing registration/email/payment workflow was preserved.");
  console.log("✅ No database migration required.");
} catch (error) {
  fs.writeFileSync(appPath, originalApp, "utf8");
  fs.writeFileSync(stylesPath, originalStyles, "utf8");
  fs.writeFileSync(routePath, originalRoute, "utf8");
  console.error("❌ V35 patch stopped for safety and restored the original files.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
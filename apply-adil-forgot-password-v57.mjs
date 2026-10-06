import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_FORGOT_PASSWORD_V57";
const payload = path.join(root, "__adil_forgot_password_v57_payload");
const appPath = path.join(root, "client", "src", "App.tsx");
const cssPath = path.join(root, "client", "src", "styles.css");
const schemaPath = path.join(root, "db", "schema.ts");
const serverPath = path.join(root, "server", "index.ts");
const emailPath = path.join(root, "server", "services", "email.ts");
const routerTarget = path.join(root, "server", "modules", "password-reset", "routes.ts");
const migrationTarget = path.join(root, "db", "migrations", "0029_password_reset_codes.sql");

function fail(message) { console.error(`\n❌ v57 stopped safely: ${message}\n`); process.exit(1); }
function mustExist(file) { if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`); }
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. Existing source was left unchanged.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) fail(`${label} patch point is ambiguous. Existing source was left unchanged.`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}
function insertAfterRegex(source, regex, addition, label) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const matches = [...source.matchAll(new RegExp(regex.source, flags))];
  if (matches.length !== 1) fail(`${label} patch point ${matches.length ? "is ambiguous" : "was not found"}.`);
  const match = matches[0];
  const end = (match.index ?? 0) + match[0].length;
  return source.slice(0, end) + addition + source.slice(end);
}

for (const file of [appPath, cssPath, schemaPath, serverPath, emailPath,
  path.join(payload, "routes.ts"), path.join(payload, "schema-block.txt"),
  path.join(payload, "db", "migrations", "0029_password_reset_codes.sql")]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");
let email = fs.readFileSync(emailPath, "utf8");

if ([app, css, schema, server, email].every((text) => text.includes(marker)) && fs.existsSync(routerTarget)) {
  if (!fs.existsSync(migrationTarget)) fs.copyFileSync(path.join(payload, "db", "migrations", "0029_password_reset_codes.sql"), migrationTarget);
  console.log("✅ v57 is already present. Source files were not changed again.");
  process.exit(0);
}
if ([app, css, schema, server, email].some((text) => text.includes(marker))) fail("A partial v57 marker was detected. Restore from backup before retrying.");

const backupDir = path.join(root, "backup", "forgot-password-v57");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, cssPath, schemaPath, serverPath, emailPath]) {
  const name = path.relative(root, file).replaceAll(path.sep, "__");
  const backup = path.join(backupDir, `${name}.before-v57`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

// Validate all stable login/auth anchors before writing any source file.
const anchors = {
  mode: `const [mode, setMode] = useState<"login" | "register" | "verify">(\n    "login"\n  );`,
  notice: `  const [notice, setNotice] = useState("");`,
  submitStart: `    try {\n      if (mode === "register") {`,
  modeEmail: `{mode !== "register" && <label>\n                  Email`,
  otp: `{mode === "verify" && <label className="auth-wide">OTP code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\\D/g, "") })} placeholder="6-digit OTP" /></label>}`,
  password: `{mode !== "register" && <label>\n                  Password`,
  hint: `{mode === "verify" && (\n                  <small className="password-hint">`,
  resend: `{mode === "verify" && <button className="otp-resend" type="button" onClick={() => void resendOtp()}>OTP එක නැවත යවන්න</button>}`,
  submitText: `: mode === "verify" ? "Verify කර Login වෙන්න" : "Login"}`
};
for (const [label, anchor] of Object.entries(anchors)) if (!app.includes(anchor)) fail(`Login UI anchor '${label}' not found.`);
if (!/import \{ ccoMainRouter \} from "\.\/modules\/cco-main\/routes";[^\n]*/.test(server)) fail("Server router import anchor not found.");
if (!/app\.use\("\/api", ccoMainRouter\);[^\n]*/.test(server)) fail("Server router mount anchor not found.");
if (!email.includes(`export async function sendVerificationCode(email: string, code: string) {`)) fail("Email service anchor not found.");

schema += fs.readFileSync(path.join(payload, "schema-block.txt"), "utf8");

server = insertAfterRegex(server, /import \{ ccoMainRouter \} from "\.\/modules\/cco-main\/routes";[^\n]*/, `\nimport { passwordResetRouter } from "./modules/password-reset/routes"; // ${marker}`, "Server password-reset import");
server = insertAfterRegex(server, /app\.use\("\/api", ccoMainRouter\);[^\n]*/, `\napp.use("/api", passwordResetRouter); // ${marker}`, "Server password-reset mount");

email += `\n\n// ${marker}\nexport async function sendPasswordResetCode(email: string, name: string, code: string) {\n  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");\n  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");\n  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: senderEmail, pass: password } });\n  await transporter.sendMail({\n    from: \`Adil Academy <\${senderEmail}>\`,\n    to: email,\n    subject: "Adil Academy password reset code",\n    text: \`Hello \${name}, your Adil Academy password reset code is \${code}. It expires in 10 minutes. Do not share this code. If you did not request a password reset, ignore this email.\`,\n    html: \`<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>Password Reset</h2><p>ආයුබෝවන් \${name}, ඔබගේ Adil Academy password එක reset කිරීමට පහත code එක භාවිත කරන්න.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;margin:24px 0;color:#7cff4f">\${code}</div><p style="color:#9aa59f">මෙම code එක විනාඩි 10කින් expire වේ. Code එක කිසිවෙකුට share කරන්න එපා.</p><p style="color:#9aa59f">ඔබ password reset එකක් request කළේ නැත්නම් මෙම email එක ignore කරන්න.</p></div>\`\n  });\n}\n`;

app = replaceOnce(app, anchors.mode, `const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot">(\n    "login"\n  ); // ${marker}`, "Login mode");
app = replaceOnce(app, anchors.notice, `  const [notice, setNotice] = useState("");\n  const [resetRequested, setResetRequested] = useState(false); // ${marker}\n  const [confirmPassword, setConfirmPassword] = useState("");`, "Forgot password state");

app = replaceOnce(app, anchors.submitStart, `    try {\n      if (mode === "forgot") { // ${marker}\n        if (!resetRequested) {\n          const response = await fetch("/api/auth/forgot-password", {\n            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email })\n          });\n          const data = await response.json() as { message?: string };\n          if (!response.ok) throw new Error(data.message || "Reset code request failed.");\n          setResetRequested(true);\n          setForm((current) => ({ ...current, otp: "", password: "" }));\n          setConfirmPassword("");\n          setShowPassword(false);\n          setNotice(data.message || "Reset code එක email කර ඇත.");\n          return;\n        }\n        if (form.password !== confirmPassword) throw new Error("Passwords දෙක සමාන විය යුතුයි.");\n        const response = await fetch("/api/auth/reset-password", {\n          method: "POST", headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ email: form.email, code: form.otp, password: form.password })\n        });\n        const data = await response.json() as { user?: DemoUser; message?: string };\n        if (!response.ok || !data.user) throw new Error(data.message || "Password reset failed.");\n        onLogin(data.user);\n        navigate("/dashboard");\n        return;\n      }\n      if (mode === "register") {`, "Forgot password submit flow");

app = replaceOnce(app,
`                  setMode(value as typeof mode);\n                  setForm((current) => ({ ...current, password: "", otp: "" }));\n                  setShowPassword(false);`,
`                  setMode(value as typeof mode);\n                  setResetRequested(false); // ${marker}\n                  setConfirmPassword("");\n                  setForm((current) => ({ ...current, password: "", otp: "" }));\n                  setShowPassword(false);`, "Auth tab reset state");

app = replaceOnce(app,
`{mode === "register" ? "STUDENT ADMISSION" : mode === "verify" ? "EMAIL VERIFICATION" : "WELCOME BACK"}`,
`{mode === "register" ? "STUDENT ADMISSION" : mode === "verify" ? "EMAIL VERIFICATION" : mode === "forgot" ? "PASSWORD RECOVERY" : "WELCOME BACK"}`,
"Forgot header eyebrow");
app = replaceOnce(app,
`{mode === "register" ? "Admission form එක" : mode === "verify" ? "OTP verify කරන්න" : "Login වෙන්න"}`,
`{mode === "register" ? "Admission form එක" : mode === "verify" ? "OTP verify කරන්න" : mode === "forgot" ? (resetRequested ? "නව Password එක සකස් කරන්න" : "Password එක අමතකද?") : "Login වෙන්න"}`,
"Forgot header title");
app = replaceOnce(app,
`{mode === "register"
                  ? "Details සහ payment proof submit කරන්න. Admin approval පසු OTP email එක ලැබේ."
                  : mode === "verify"
                    ? "Payment approve වූ පසු email එකට ලැබුණු OTP එක දමා permanent password එක සකස් කරන්න."
                  : "ඔබගේ Adil Academy account එකට secure ලෙස ඇතුළු වෙන්න."}`,
`{mode === "register"
                  ? "Details සහ payment proof submit කරන්න. Admin approval පසු OTP email එක ලැබේ."
                  : mode === "verify"
                    ? "Payment approve වූ පසු email එකට ලැබුණු OTP එක දමා permanent password එක සකස් කරන්න."
                    : mode === "forgot"
                      ? (resetRequested ? "Email එකට ලැබුණු 6-digit reset code එක සහ නව password එක ඇතුළත් කරන්න." : "ඔබගේ account email එක දාන්න. Password reset code එක email එකට යවන්නම්.")
                      : "ඔබගේ Adil Academy account එකට secure ලෙස ඇතුළු වෙන්න."}`,
"Forgot header description");

app = replaceOnce(app, anchors.modeEmail,
`{mode !== "register" && <label>\n                  Email`, "Forgot email visibility");
app = replaceOnce(app,
`                    autoComplete="email"\n                  />\n                </label>}`,
`                    autoComplete="email"\n                    readOnly={mode === "forgot" && resetRequested} // ${marker}\n                  />\n                </label>}`,
"Forgot email readonly");

app = replaceOnce(app, anchors.otp,
`{(mode === "verify" || (mode === "forgot" && resetRequested)) && <label className="auth-wide">OTP code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\\D/g, "") })} placeholder={mode === "forgot" ? "6-digit reset code" : "6-digit OTP"} /></label>} {/* ${marker} */}`,
"Forgot OTP input");

app = replaceOnce(app, anchors.password,
`{(mode === "login" || mode === "verify" || (mode === "forgot" && resetRequested)) && <label>\n                  Password`, "Forgot password input");
app = replaceOnce(app,
`                      autoComplete={mode === "verify" ? "new-password" : "current-password"}\n                      data-lpignore={mode === "verify" ? "true" : undefined}\n                      data-1p-ignore={mode === "verify" ? "true" : undefined}`,
`                      autoComplete={mode === "verify" || mode === "forgot" ? "new-password" : "current-password"}\n                      data-lpignore={mode === "verify" || mode === "forgot" ? "true" : undefined}\n                      data-1p-ignore={mode === "verify" || mode === "forgot" ? "true" : undefined}`,
"Forgot password autocomplete");

app = replaceOnce(app,
`                </label>}\n                {mode === "verify" && (`,
`                </label>}\n                {mode === "login" && <button className="forgot-password-link" type="button" onClick={() => { setMode("forgot"); setResetRequested(false); setConfirmPassword(""); setForm((current) => ({ ...current, password: "", otp: "" })); setShowPassword(false); setError(""); setNotice(""); }}>Forgot password?</button>} {/* ${marker} */}\n                {mode === "forgot" && resetRequested && <label className="auth-wide">Confirm new password<input required minLength={8} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" /></label>}\n                {(mode === "verify" || (mode === "forgot" && resetRequested)) && (`,
"Forgot password link and confirmation");

app = replaceOnce(app, anchors.resend,
`{mode === "verify" && <button className="otp-resend" type="button" onClick={() => void resendOtp()}>OTP එක නැවත යවන්න</button>}\n                {mode === "forgot" && resetRequested && <button className="otp-resend" type="button" onClick={async () => { setError(""); try { const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) }); const data = await response.json() as { message?: string }; if (!response.ok) throw new Error(data.message || "Reset code resend failed."); setNotice(data.message || "Reset code එක නැවත email කර ඇත."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Reset code resend failed."); } }}>Reset code එක නැවත යවන්න</button>} {/* ${marker} */}\n                {mode === "forgot" && <button className="forgot-password-back" type="button" onClick={() => { setMode("login"); setResetRequested(false); setConfirmPassword(""); setForm((current) => ({ ...current, password: "", otp: "" })); setShowPassword(false); setError(""); setNotice(""); }}>← Login වෙත ආපසු</button>}`,
"Forgot resend/back controls");

app = replaceOnce(app, anchors.submitText,
`: mode === "verify" ? "Verify කර Login වෙන්න" : mode === "forgot" ? (resetRequested ? "Reset Password & Login" : "Send Reset Code") : "Login"}`,
"Forgot submit button");

css += `\n\n/* ${marker} — secure forgot-password flow */\n.forgot-password-link,.forgot-password-back{grid-column:1/-1;width:max-content;border:0;background:transparent;color:var(--green);padding:0;cursor:pointer;font:inherit;font-size:9px;font-weight:800}.forgot-password-link{justify-self:end;margin-top:-5px}.forgot-password-back{justify-self:start;margin-top:2px;color:#91a39a}.forgot-password-link:hover,.forgot-password-back:hover{color:#fff;text-decoration:underline}.auth-form input[readonly]{opacity:.72;cursor:not-allowed}@media(max-width:620px){.forgot-password-link{justify-self:start}}\n`;

fs.mkdirSync(path.dirname(routerTarget), { recursive: true });
fs.copyFileSync(path.join(payload, "routes.ts"), routerTarget);
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.copyFileSync(path.join(payload, "db", "migrations", "0029_password_reset_codes.sql"), migrationTarget);

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
fs.writeFileSync(schemaPath, schema);
fs.writeFileSync(serverPath, server);
fs.writeFileSync(emailPath, email);

console.log("✓ Login page — Forgot password flow added");
console.log("✓ Password reset OTP email service added");
console.log("✓ Secure password-reset API router added");
console.log("✓ password_reset_codes schema + migration added");
console.log("✓ Existing Login / Apply / Verify OTP flows were preserved");
console.log("\n✅ ADIL ACADEMY Forgot Password v57 source update applied.");

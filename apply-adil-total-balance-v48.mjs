import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "client", "src", "App.tsx");
const cssPath = path.join(root, "client", "src", "styles.css");
const platformPath = path.join(root, "server", "modules", "platform", "routes.ts");
const marker = "ADIL_TOTAL_AVAILABLE_BALANCE_V48";

function fail(message) {
  console.error(`\n❌ v48 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
for (const file of [appPath, cssPath, platformPath]) mustExist(file);

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
let platform = fs.readFileSync(platformPath, "utf8");

if (app.includes(marker) && platform.includes(marker)) {
  console.log("✓ v48 is already applied. Re-running checks only.");
  process.exit(0);
}

// Validate every patch point BEFORE any write.
const schemaImportAnchor = `  commissionCycles,\n  consultantApplications,`;
if (!platform.includes(schemaImportAnchor)) fail("Platform schema import patch point not found.");

const oldOverviewPromise = `      [{ activeAccounts }],\n      [{ commissionCycleCount }]\n    ] = await Promise.all([\n      db.select({ students: count() }).from(users).where(eq(users.role, "student")),\n      db\n        .select({ consultants: count() })\n        .from(users)\n        .where(eq(users.role, "consultant")),\n      db\n        .select({ pendingPayments: count() })\n        .from(paymentRequests)\n        .where(\n          inArray(paymentRequests.status, [\n            "PENDING",\n            "UNDER_REVIEW",\n            "PARTIAL"\n          ])\n        ),\n      db\n        .select({ pendingApplications: count() })\n        .from(consultantApplications)\n        .where(\n          inArray(consultantApplications.status, ["PENDING", "INTERVIEW"])\n        ),\n      db\n        .select({ activeAccounts: count() })\n        .from(networkAccounts)\n        .where(eq(networkAccounts.status, "ACTIVE")),\n      db.select({ commissionCycleCount: count() }).from(commissionCycles)\n    ]);`;
if (!platform.includes(oldOverviewPromise)) fail("Admin overview query block not found.");

const oldOverviewResponse = `    response.json({\n      students,\n      consultants,\n      pendingPayments,\n      pendingApplications,\n      activeAccounts,\n      commissionCycleCount\n    });`;
if (!platform.includes(oldOverviewResponse)) fail("Admin overview response block not found.");

const oldOverviewType = `type AdminOverviewData = {\n  students: number;\n  consultants: number;\n  pendingPayments: number;\n  pendingApplications: number;\n  activeAccounts: number;\n  commissionCycleCount: number;\n};`;
if (!app.includes(oldOverviewType)) fail("AdminOverviewData type block not found.");

const dashboardMetricsAnchor = `      <div className="metrics-grid">\n        <MetricCard label="Total Students" value={String(overview.students)} note="Click to view & search" icon={<Users />} onClick={() => onOpen("Students")} />`;
if (!app.includes(dashboardMetricsAnchor)) fail("Admin Dashboard metrics patch point not found.");

if (!css.includes(`.metrics-grid {`)) fail("Dashboard CSS patch point not found.");

const backupDir = path.join(root, "backup", "total-available-balance-v48");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [appPath, cssPath, platformPath]) {
  const target = path.join(backupDir, `${path.basename(file)}.before-v48`);
  if (!fs.existsSync(target)) fs.copyFileSync(file, target);
}

platform = platform.replace(
  schemaImportAnchor,
  `  commissionCycles,\n  ccoActivationRequests,\n  ccoMainApplications,\n  ccoMainPayIds,\n  consultantApplications,`
);

const newOverviewPromise = `      [{ activeAccounts }],\n      [{ commissionCycleCount }],\n      [{ coursePaymentTotal }],\n      [{ ccoMainPaymentTotal }],\n      [{ ccoAccountPaymentTotal }],\n      [{ consultantPayoutTotal }]\n    ] = await Promise.all([\n      db.select({ students: count() }).from(users).where(eq(users.role, "student")),\n      db\n        .select({ consultants: count() })\n        .from(users)\n        .where(eq(users.role, "consultant")),\n      db\n        .select({ pendingPayments: count() })\n        .from(paymentRequests)\n        .where(\n          inArray(paymentRequests.status, [\n            "PENDING",\n            "UNDER_REVIEW",\n            "PARTIAL"\n          ])\n        ),\n      db\n        .select({ pendingApplications: count() })\n        .from(consultantApplications)\n        .where(\n          inArray(consultantApplications.status, ["PENDING", "INTERVIEW"])\n        ),\n      db\n        .select({ activeAccounts: count() })\n        .from(networkAccounts)\n        .where(eq(networkAccounts.status, "ACTIVE")),\n      db.select({ commissionCycleCount: count() }).from(commissionCycles),\n      db\n        .select({\n          coursePaymentTotal: sql<string>\`COALESCE(SUM(\${paymentRequests.paidAmount}), 0)\`\n        })\n        .from(paymentRequests)\n        .where(inArray(paymentRequests.status, ["PARTIAL", "APPROVED"])),\n      db\n        .select({\n          ccoMainPaymentTotal: sql<string>\`COALESCE(SUM(\${ccoMainPayIds.amount}), 0)\`\n        })\n        .from(ccoMainApplications)\n        .innerJoin(ccoMainPayIds, eq(ccoMainPayIds.id, ccoMainApplications.payIdId))\n        .where(eq(ccoMainApplications.status, "APPROVED")),\n      db\n        .select({\n          ccoAccountPaymentTotal: sql<string>\`COALESCE(SUM(\${ccoActivationRequests.amount}), 0)\`\n        })\n        .from(ccoActivationRequests)\n        .where(inArray(ccoActivationRequests.status, ["APPROVED", "EXPIRED"])),\n      db\n        .select({\n          consultantPayoutTotal: sql<string>\`COALESCE(SUM(\${payoutRequests.amount}), 0)\`\n        })\n        .from(payoutRequests)\n        .where(eq(payoutRequests.status, "PAID"))\n    ]); // ${marker}`;
platform = platform.replace(oldOverviewPromise, newOverviewPromise);

const newOverviewResponse = `    const coursePayments = Number(coursePaymentTotal ?? 0);\n    const ccoMainPayments = Number(ccoMainPaymentTotal ?? 0);\n    const ccoAccountPayments = Number(ccoAccountPaymentTotal ?? 0);\n    const consultantPayouts = Number(consultantPayoutTotal ?? 0);\n    const totalReceived = coursePayments + ccoMainPayments + ccoAccountPayments;\n    const availableBalance = totalReceived - consultantPayouts;\n\n    response.json({\n      students,\n      consultants,\n      pendingPayments,\n      pendingApplications,\n      activeAccounts,\n      commissionCycleCount,\n      coursePayments,\n      ccoMainPayments,\n      ccoAccountPayments,\n      consultantPayouts,\n      totalReceived,\n      availableBalance\n    });`;
platform = platform.replace(oldOverviewResponse, newOverviewResponse);

const newOverviewType = `type AdminOverviewData = {\n  students: number;\n  consultants: number;\n  pendingPayments: number;\n  pendingApplications: number;\n  activeAccounts: number;\n  commissionCycleCount: number;\n  coursePayments: number;\n  ccoMainPayments: number;\n  ccoAccountPayments: number;\n  consultantPayouts: number;\n  totalReceived: number;\n  availableBalance: number;\n}; // ${marker}`;
app = app.replace(oldOverviewType, newOverviewType);

const balanceBar = `      <section className="admin-total-balance-bar">\n        <div className="admin-total-balance-main">\n          <span className="admin-total-balance-icon"><Wallet /></span>\n          <div>\n            <span className="eyebrow">LIVE FINANCIAL BALANCE</span>\n            <h3>TOTAL RS. — AVAILABLE BALANCE</h3>\n            <strong>Rs. {overview.availableBalance.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>\n            <small>All approved money received minus consultant payouts marked PAID.</small>\n          </div>\n        </div>\n        <div className="admin-total-balance-breakdown">\n          <div><span>Total received</span><strong className="money-in">+ Rs. {overview.totalReceived.toLocaleString("en-LK")}</strong></div>\n          <div><span>Course payments</span><strong>Rs. {overview.coursePayments.toLocaleString("en-LK")}</strong></div>\n          <div><span>CCO main accounts</span><strong>Rs. {overview.ccoMainPayments.toLocaleString("en-LK")}</strong></div>\n          <div><span>2nd–7th CN buys / trials</span><strong>Rs. {overview.ccoAccountPayments.toLocaleString("en-LK")}</strong></div>\n          <div className="admin-balance-payout"><span>Consultant payouts paid</span><strong>− Rs. {overview.consultantPayouts.toLocaleString("en-LK")}</strong></div>\n        </div>\n        <p className="admin-total-balance-note">Pending commissions, pending payout requests and unpaid balances do not reduce this amount. A deduction happens only after a consultant payout is marked PAID. Refunded course payments are not counted as received.</p>\n      </section>\n`;
app = app.replace(dashboardMetricsAnchor, balanceBar + dashboardMetricsAnchor);

const cssAddition = `\n/* ${marker} */\n.admin-total-balance-bar {\n  position: relative;\n  overflow: hidden;\n  margin-top: 25px;\n  padding: 22px 24px 15px;\n  border: 1px solid rgba(236, 190, 83, 0.24);\n  border-radius: 18px;\n  background:\n    radial-gradient(circle at 82% -20%, rgba(139, 255, 85, 0.10), transparent 34%),\n    radial-gradient(circle at 0 100%, rgba(236, 190, 83, 0.09), transparent 38%),\n    var(--dash-card);\n  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.14);\n}\n.admin-total-balance-bar::after {\n  content: "";\n  position: absolute;\n  inset: 0 0 auto;\n  height: 2px;\n  background: linear-gradient(90deg, transparent, rgba(236, 190, 83, .86), rgba(139, 255, 85, .66), transparent);\n}\n.admin-total-balance-main {\n  display: flex;\n  align-items: center;\n  gap: 15px;\n}\n.admin-total-balance-icon {\n  display: grid;\n  place-items: center;\n  flex: 0 0 54px;\n  width: 54px;\n  height: 54px;\n  border: 1px solid rgba(236, 190, 83, .24);\n  border-radius: 16px;\n  color: #f2c763;\n  background: rgba(236, 190, 83, .08);\n}\n.admin-total-balance-icon svg { width: 24px; height: 24px; }\n.admin-total-balance-main h3 { margin: 4px 0 2px; font-size: 14px; letter-spacing: .035em; }\n.admin-total-balance-main strong { display: block; margin-top: 3px; color: #f7d475; font-size: clamp(28px, 3.3vw, 42px); line-height: 1.08; letter-spacing: -.025em; }\n.admin-total-balance-main small { display: block; margin-top: 7px; color: var(--muted); font-size: 10px; }\n.admin-total-balance-breakdown {\n  display: grid;\n  grid-template-columns: repeat(5, minmax(0, 1fr));\n  gap: 8px;\n  margin-top: 18px;\n}\n.admin-total-balance-breakdown > div {\n  min-width: 0;\n  padding: 10px 12px;\n  border: 1px solid rgba(255,255,255,.055);\n  border-radius: 11px;\n  background: rgba(255,255,255,.018);\n}\n.admin-total-balance-breakdown span,\n.admin-total-balance-breakdown strong { display: block; }\n.admin-total-balance-breakdown span { overflow: hidden; color: var(--muted); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }\n.admin-total-balance-breakdown strong { margin-top: 5px; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }\n.admin-total-balance-breakdown .money-in { color: #8bff75; }\n.admin-total-balance-breakdown .admin-balance-payout { border-color: rgba(255, 116, 116, .12); background: rgba(255, 90, 90, .025); }\n.admin-total-balance-breakdown .admin-balance-payout strong { color: #ff9b9b; }\n.admin-total-balance-note { margin: 11px 2px 0; color: #647168; font-size: 8px; line-height: 1.5; }\n.dashboard-theme-light .admin-total-balance-bar {\n  border-color: rgba(177, 128, 27, .24);\n  background: radial-gradient(circle at 82% -20%, rgba(40, 160, 70, .09), transparent 34%), radial-gradient(circle at 0 100%, rgba(214, 161, 47, .08), transparent 38%), #fff;\n}\n.dashboard-theme-light .admin-total-balance-main strong { color: #8c6512; }\n.dashboard-theme-light .admin-total-balance-breakdown > div { border-color: #e6ece7; background: #f8faf8; }\n.dashboard-theme-light .admin-total-balance-note { color: #718077; }\n@media (max-width: 1050px) {\n  .admin-total-balance-breakdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n}\n@media (max-width: 620px) {\n  .admin-total-balance-bar { padding: 18px 16px 14px; }\n  .admin-total-balance-main { align-items: flex-start; }\n  .admin-total-balance-icon { flex-basis: 44px; width: 44px; height: 44px; border-radius: 13px; }\n  .admin-total-balance-main strong { font-size: 27px; }\n  .admin-total-balance-breakdown { grid-template-columns: 1fr; }\n}\n`;
css += cssAddition;

fs.writeFileSync(platformPath, platform);
fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);

console.log("✓ server/modules/platform/routes.ts");
console.log("✓ client/src/App.tsx");
console.log("✓ client/src/styles.css");
console.log("\n✅ ADIL ACADEMY Total Available Balance v48 applied.");
console.log("No database migration is required.");
console.log("Backup: backup/total-available-balance-v48/");

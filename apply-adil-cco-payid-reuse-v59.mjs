import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_CCO_PAYID_REUSE_V59";
const payload = path.join(root, "__adil_cco_payid_reuse_v59_payload");
const routePath = path.join(root, "server", "modules", "cco-main", "routes.ts");
const schemaPath = path.join(root, "db", "schema.ts");
const emailPath = path.join(root, "server", "services", "email.ts");
const appPath = path.join(root, "client", "src", "App.tsx");
const migrationTarget = path.join(root, "db", "migrations", "0031_cco_main_pay_id_ip_binding.sql");

function fail(message) { console.error(`\n❌ v59 stopped safely: ${message}\n`); process.exit(1); }
function mustExist(file) { if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`); }
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. Existing source was left unchanged.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) fail(`${label} patch point is ambiguous. Existing source was left unchanged.`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

for (const file of [routePath, schemaPath, emailPath, appPath, path.join(payload, "db", "migrations", "0031_cco_main_pay_id_ip_binding.sql")]) mustExist(file);

let route = fs.readFileSync(routePath, "utf8");
let schema = fs.readFileSync(schemaPath, "utf8");
let email = fs.readFileSync(emailPath, "utf8");
let app = fs.readFileSync(appPath, "utf8");

if (route.includes(marker) && schema.includes('boundIpHash: text("bound_ip_hash")') && email.includes(marker) && app.includes("48-hour reusable Pay ID")) {
  if (!fs.existsSync(migrationTarget)) fs.copyFileSync(path.join(payload, "db", "migrations", "0031_cco_main_pay_id_ip_binding.sql"), migrationTarget);
  console.log("✅ v59 is already present. Source files were not changed again.");
  process.exit(0);
}
if (route.includes(marker) || email.includes(marker)) fail("A partial v59 marker was detected. Restore from backup before retrying.");

const routeImportOld = `import express, { Router } from "express";\nimport { and, desc, eq, gt, isNull, sql } from "drizzle-orm";`;
const routeImportNew = `import express, { Router, type Request } from "express";\nimport { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"; // ${marker}`;

const makePayIdOld = `function makePayId() {\n  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");\n  return \`CCO-\${day}-\${crypto.randomBytes(4).toString("hex").toUpperCase()}\`;\n}`;
const makePayIdNew = `${makePayIdOld}\n\n// ${marker}: bind a CCO Pay ID to the first public IP that uses it.\n// The raw IP is never stored; only a SHA-256 hash is persisted.\nfunction payIdClientIpHash(request: Request) {\n  const forwarded = request.headers["x-forwarded-for"];\n  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;\n  const realIp = request.headers["x-real-ip"];\n  const raw = String(forwardedValue || realIp || request.socket.remoteAddress || request.ip || "unknown")\n    .split(",")[0]\n    .trim();\n  return crypto.createHash("sha256").update(raw).digest("hex");\n}`;

const validateOld = `ccoMainRouter.post("/public/cco-main/validate", asyncRoute(async (request, response) => {\n  const code = z.string().trim().min(8).parse(request.body?.payId).toUpperCase();\n  const db = requireDatabase();\n  const [payId] = await db.select().from(ccoMainPayIds).where(and(eq(ccoMainPayIds.code, code), isNull(ccoMainPayIds.claimedAt), isNull(ccoMainPayIds.cancelledAt), gt(ccoMainPayIds.expiresAt, new Date()))).limit(1);\n  if (!payId) throw new HttpError(400, "Pay ID එක invalid, expired හෝ කලින් භාවිත කර ඇත.");\n  response.json({ valid: true, name: payId.intendedName, email: payId.intendedEmail, phone: payId.intendedPhone, amount: Number(payId.amount) });\n}));`;
const validateNew = `ccoMainRouter.post("/public/cco-main/validate", asyncRoute(async (request, response) => {\n  const code = z.string().trim().min(8).parse(request.body?.payId).toUpperCase();\n  const db = requireDatabase();\n  const ipHash = payIdClientIpHash(request);\n  // ${marker}: reusable for 48h, but only from the first-bound public IP.\n  const [payId] = await db.update(ccoMainPayIds).set({\n    boundIpHash: ipHash,\n    claimedAt: sql\`COALESCE(\${ccoMainPayIds.claimedAt}, now())\`\n  }).where(and(\n    eq(ccoMainPayIds.code, code),\n    isNull(ccoMainPayIds.cancelledAt),\n    gt(ccoMainPayIds.expiresAt, new Date()),\n    or(isNull(ccoMainPayIds.boundIpHash), eq(ccoMainPayIds.boundIpHash, ipHash))\n  )).returning();\n  if (!payId) throw new HttpError(400, "Pay ID එක invalid/expired හෝ වෙනත් device/IP එකකට bind වී ඇත.");\n  response.json({ valid: true, name: payId.intendedName, email: payId.intendedEmail, phone: payId.intendedPhone, amount: Number(payId.amount), expiresAt: payId.expiresAt });\n}));`;

const claimOld = `    const [payId] = await tx.update(ccoMainPayIds).set({ claimedAt: new Date() }).where(and(\n      eq(ccoMainPayIds.code, code), eq(ccoMainPayIds.intendedEmail, email), isNull(ccoMainPayIds.claimedAt),\n      isNull(ccoMainPayIds.cancelledAt), gt(ccoMainPayIds.expiresAt, new Date())\n    )).returning();\n    if (!payId) throw new HttpError(409, "Pay ID එක invalid, expired, වෙනත් email එකකට අදාළ හෝ භාවිත කර ඇත.");\n    if (input.transactionReference.toUpperCase() !== code) throw new HttpError(400, "Bank reference එක special Pay ID එකට සමාන විය යුතුයි.");\n    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);`;
const claimNew = `    const ipHash = payIdClientIpHash(request);\n    const [payId] = await tx.update(ccoMainPayIds).set({\n      boundIpHash: ipHash,\n      claimedAt: sql\`COALESCE(\${ccoMainPayIds.claimedAt}, now())\`\n    }).where(and(\n      eq(ccoMainPayIds.code, code), eq(ccoMainPayIds.intendedEmail, email),\n      isNull(ccoMainPayIds.cancelledAt), gt(ccoMainPayIds.expiresAt, new Date()),\n      or(isNull(ccoMainPayIds.boundIpHash), eq(ccoMainPayIds.boundIpHash, ipHash))\n    )).returning();\n    if (!payId) throw new HttpError(409, "Pay ID එක invalid/expired, වෙනත් email එකකට අදාළ, හෝ වෙනත් device/IP එකකට bind වී ඇත.");\n    if (input.transactionReference.toUpperCase() !== code) throw new HttpError(400, "Bank reference එක special Pay ID එකට සමාන විය යුතුයි.");\n\n    // ${marker}: if the first attempt created the application but proof upload failed,\n    // issue a fresh upload token instead of consuming/rejecting the same Pay ID.\n    const [retry] = await tx.select({ application: ccoMainApplications, account: networkAccounts })\n      .from(ccoMainApplications)\n      .innerJoin(networkAccounts, eq(networkAccounts.id, ccoMainApplications.accountId))\n      .where(eq(ccoMainApplications.payIdId, payId.id))\n      .limit(1);\n    if (retry) {\n      if (retry.application.status !== "AWAITING_PROOF") {\n        throw new HttpError(409, "මෙම Pay ID එකෙන් application එක දැනටමත් submit කර ඇත. Admin review status එක බලන්න.");\n      }\n      await tx.update(ccoMainApplications).set({\n        registrationTokenHash: tokenHash(registrationToken),\n        updatedAt: new Date()\n      }).where(eq(ccoMainApplications.id, retry.application.id));\n      return { application: retry.application, account: retry.account, reused: true };\n    }\n\n    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);`;

const responseOld = `  response.json({ applicationId: result.application.id, registrationToken, accountNumber: \`CN\${result.account.numericPart}\` });`;
const responseNew = `  response.json({ applicationId: result.application.id, registrationToken, accountNumber: \`CN\${result.account.numericPart}\`, reused: "reused" in result ? result.reused : false }); // ${marker}`;

const schemaOld = `  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),\n  claimedAt: timestamp("claimed_at", { withTimezone: true }),\n  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),`;
const schemaNew = `  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),\n  claimedAt: timestamp("claimed_at", { withTimezone: true }),\n  boundIpHash: text("bound_ip_hash"), // ${marker}\n  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),`;

const emailTextOld = `    text: \`Hello \${name}, your one-time CCO Main Pay ID is \${payId}. Amount: LKR \${amount}. It expires at \${expiresAt.toISOString()}.\`,`;
const emailTextNew = `    text: \`Hello \${name}, your CCO Main Pay ID is \${payId}. Amount: LKR \${amount}. It can be reused from the same email and public IP until it expires at \${expiresAt.toISOString()}.\`, // ${marker}`;
const emailHtmlOld = `    html: \`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY · CCO MAIN</p><h2>Special CCO Main Pay ID</h2><p>ආයුබෝවන් \${name}, course එකක් නොමැති CCO Main account application එක සඳහා මෙම Pay ID එක භාවිත කරන්න.</p><div style="margin:22px 0;padding:18px;border:1px solid #315c40;border-radius:12px;text-align:center"><strong style="font-size:24px;color:#7cff4f">\${payId}</strong><br><span>LKR \${amount.toLocaleString()}</span></div><p>Bank transfer reference එකටත් CCO form එකටත් මෙම ID එකම යොදන්න. එක් වරක් පමණක් භාවිත කළ හැකි අතර පැය 48කින් expire වේ.</p></div>\``;
const emailHtmlNew = `    html: \`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY · CCO MAIN</p><h2>Special CCO Main Pay ID</h2><p>ආයුබෝවන් \${name}, course එකක් නොමැති CCO Main account application එක සඳහා මෙම Pay ID එක භාවිත කරන්න.</p><div style="margin:22px 0;padding:18px;border:1px solid #315c40;border-radius:12px;text-align:center"><strong style="font-size:24px;color:#7cff4f">\${payId}</strong><br><span>LKR \${amount.toLocaleString()}</span></div><p>Bank transfer reference එකටත් CCO form එකටත් මෙම ID එකම යොදන්න. මෙම Pay ID එක පැය 48ක් ඇතුළත <strong>එකම email එක + පළමු භාවිතයේ public IP එකෙන්</strong> නැවත භාවිත කළ හැක. වෙනත් IP එකකින් භාවිත කළ නොහැක.</p></div>\` // ${marker}`;

const appOld = `Course එකක් නොමැති consultant candidate කෙනෙකුට one-time Pay ID එකක් issue කරන්න.`;
const appNew = `Course එකක් නොමැති consultant candidate කෙනෙකුට 48-hour reusable Pay ID එකක් issue කරන්න. එකම email + first-bound device/public IP එකට පමණයි. {/* ${marker} */}`;

// Validate every anchor before writing anything.
for (const [label, source, anchor] of [
  ["route imports", route, routeImportOld],
  ["makePayId helper", route, makePayIdOld],
  ["validate route", route, validateOld],
  ["application Pay ID claim", route, claimOld],
  ["application response", route, responseOld],
  ["CCO Pay ID schema", schema, schemaOld],
  ["CCO email text", email, emailTextOld],
  ["CCO email html", email, emailHtmlOld],
  ["Admin CCO Pay ID copy", app, appOld]
]) {
  if (!source.includes(anchor)) fail(`${label} anchor not found. Current project may differ; no files were changed.`);
}

const backupDir = path.join(root, "backup", "cco-main-payid-reuse-v59");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [routePath, schemaPath, emailPath, appPath]) {
  const name = path.relative(root, file).replaceAll(path.sep, "__");
  const backup = path.join(backupDir, `${name}.before-v59`);
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

route = replaceOnce(route, routeImportOld, routeImportNew, "Route imports");
route = replaceOnce(route, makePayIdOld, makePayIdNew, "IP hash helper");
route = replaceOnce(route, validateOld, validateNew, "Reusable validate route");
route = replaceOnce(route, claimOld, claimNew, "Reusable application route");
route = replaceOnce(route, responseOld, responseNew, "Application response");
schema = replaceOnce(schema, schemaOld, schemaNew, "CCO Pay ID schema");
email = replaceOnce(email, emailTextOld, emailTextNew, "CCO Pay ID text email");
email = replaceOnce(email, emailHtmlOld, emailHtmlNew, "CCO Pay ID HTML email");
app = replaceOnce(app, appOld, appNew, "Admin CCO Pay ID copy");

fs.copyFileSync(path.join(payload, "db", "migrations", "0031_cco_main_pay_id_ip_binding.sql"), migrationTarget);
fs.writeFileSync(routePath, route);
fs.writeFileSync(schemaPath, schema);
fs.writeFileSync(emailPath, email);
fs.writeFileSync(appPath, app);

console.log("✓ CCO Main Pay ID is reusable until its original 48-hour expiry");
console.log("✓ Pay ID remains locked to its intended email");
console.log("✓ First use binds a SHA-256 hash of the public IP; another IP is rejected");
console.log("✓ A failed proof-upload flow can be retried without consuming the Pay ID");
console.log("✓ Existing application/user/account is reused; duplicates are not created");
console.log("✓ Existing CCO approval/OTP/payment review logic is preserved");
console.log("\n✅ ADIL ACADEMY CCO Main Pay ID v59 source update applied.");

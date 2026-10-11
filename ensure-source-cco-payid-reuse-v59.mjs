import fs from "node:fs";
const checks = [
  ["server/modules/cco-main/routes.ts", "ADIL_CCO_PAYID_REUSE_V59"],
  ["server/modules/cco-main/routes.ts", "boundIpHash"],
  ["db/schema.ts", 'boundIpHash: text("bound_ip_hash")'],
  ["server/services/email.ts", "ADIL_CCO_PAYID_REUSE_V59"],
  ["client/src/App.tsx", "48-hour reusable Pay ID"],
  ["db/migrations/0031_cco_main_pay_id_ip_binding.sql", "bound_ip_hash"]
];
let failed = false;
for (const [file, needle] of checks) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!text.includes(needle)) { console.error(`❌ Missing v59 marker in ${file}: ${needle}`); failed = true; }
}
if (failed) process.exit(1);
console.log("✅ v59 source verification passed.");

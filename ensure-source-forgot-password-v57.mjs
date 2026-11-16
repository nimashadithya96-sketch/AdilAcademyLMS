import fs from "node:fs";
const checks = [
  ["client/src/App.tsx", "ADIL_FORGOT_PASSWORD_V57"],
  ["client/src/styles.css", "ADIL_FORGOT_PASSWORD_V57"],
  ["db/schema.ts", "ADIL_FORGOT_PASSWORD_V57"],
  ["server/index.ts", "ADIL_FORGOT_PASSWORD_V57"],
  ["server/services/email.ts", "ADIL_FORGOT_PASSWORD_V57"],
  ["server/modules/password-reset/routes.ts", "passwordResetRouter"]
];
for (const [file, marker] of checks) {
  if (!fs.existsSync(file) || !fs.readFileSync(file, "utf8").includes(marker)) {
    console.error(`❌ Source verification failed: ${file}`); process.exit(1);
  }
}
console.log("✅ v57 source markers verified.");

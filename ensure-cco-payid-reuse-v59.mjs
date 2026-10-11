import pg from "pg";
const { Client } = pg;
if (!process.env.DATABASE_URL) { console.error("❌ DATABASE_URL secret not found."); process.exit(1); }
function sslFor(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" ? false : { rejectUnauthorized: false };
  } catch { return false; }
}
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });
await client.connect();
try {
  await client.query(`ALTER TABLE cco_main_pay_ids ADD COLUMN IF NOT EXISTS bound_ip_hash text;`);
  const result = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='cco_main_pay_ids' AND column_name='bound_ip_hash';`);
  if (!result.rows.length) throw new Error("bound_ip_hash verification failed.");
  console.log("✅ CCO Main Pay ID v59 development/test database is ready.");
} finally { await client.end(); }

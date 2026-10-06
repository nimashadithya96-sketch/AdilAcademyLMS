import pg from "pg";
const { Client } = pg;
if (!process.env.DATABASE_URL) { console.error("❌ DATABASE_URL secret not found."); process.exit(1); }
function sslFor(connectionString) { try { const host = new URL(connectionString).hostname.toLowerCase(); return host === "localhost" || host === "127.0.0.1" ? false : { rejectUnauthorized: false }; } catch { return false; } }
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS password_reset_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0,
    used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
  );`);
  const r = await client.query(`SELECT to_regclass('public.password_reset_codes') AS table_name;`);
  if (!r.rows[0]?.table_name) throw new Error("password_reset_codes verification failed.");
  console.log("✅ Forgot Password v57 development/test database table is ready.");
} finally { await client.end(); }

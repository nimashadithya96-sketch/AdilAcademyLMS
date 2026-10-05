import pg from "pg";
const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL secret not found. Check Replit Secrets.");
  process.exit(1);
}
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      online_since_at timestamptz NOT NULL DEFAULT now(),
      current_module text,
      portal_mode text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("✅ Live Online v54 database table is ready.");
} finally {
  await client.end();
}

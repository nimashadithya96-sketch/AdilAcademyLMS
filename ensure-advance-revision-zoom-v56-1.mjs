import pg from "pg";
const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL secret not found. This script only prepares the current Replit development/test database.");
  process.exit(1);
}
function sslFor(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" ? false : { rejectUnauthorized: false };
  } catch {
    return false;
  }
}
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });
await client.connect();
try {
  await client.query(`
    ALTER TABLE revision_zoom_sessions
      ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 120;
  `);
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='revision_zoom_sessions' AND column_name='duration_minutes';
  `);
  if (!result.rows[0]) throw new Error("duration_minutes column verification failed.");
  console.log("✅ Advance Revision Zoom v56.1 development/test database is ready.");
} finally {
  await client.end();
}

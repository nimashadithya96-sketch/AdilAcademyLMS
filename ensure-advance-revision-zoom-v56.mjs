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

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL)
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS revision_zoom_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title text NOT NULL,
      zoom_url text NOT NULL,
      description text,
      scheduled_at timestamptz,
      is_published boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const result = await client.query(`SELECT to_regclass('public.revision_zoom_sessions') AS table_name;`);
  if (!result.rows[0]?.table_name) throw new Error("revision_zoom_sessions table verification failed.");
  console.log("✅ Advance Revision Zoom v56 development/test database table is ready.");
} finally {
  await client.end();
}

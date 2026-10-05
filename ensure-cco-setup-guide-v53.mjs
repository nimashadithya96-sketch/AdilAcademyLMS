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
    CREATE TABLE IF NOT EXISTS cco_setup_guide_videos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      video_provider text NOT NULL DEFAULT 'youtube',
      video_id text NOT NULL,
      position integer NOT NULL,
      is_published boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("✅ CCO Setup Guide v53 database table is ready.");
} finally {
  await client.end();
}

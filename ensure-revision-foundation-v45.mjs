import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL secret එක හමු වුණේ නැහැ. Replit Secrets check කරන්න.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS revision_series (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      level text NOT NULL,
      is_complete boolean NOT NULL DEFAULT false,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS revision_series_course_level_unique
      ON revision_series(course_id, level);
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS revision_videos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      series_id uuid NOT NULL REFERENCES revision_series(id) ON DELETE CASCADE,
      title text NOT NULL,
      video_provider text,
      video_id text,
      content text,
      duration_seconds integer NOT NULL DEFAULT 0,
      position integer NOT NULL,
      is_published boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS revision_videos_series_position_idx
      ON revision_videos(series_id, position);
  `);
  console.log("✅ Revision Manager v45 database tables are ready.");
} finally {
  await client.end();
}

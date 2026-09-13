import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL secret එක හමු වුණේ නැහැ.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS video_access_overrides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      unlock_all_videos boolean NOT NULL DEFAULT true,
      granted_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS video_access_overrides_user_course_unique
      ON video_access_overrides(user_id, course_id);
  `);
  console.log('✅ video_access_overrides database table ready.');
} finally {
  await client.end();
}

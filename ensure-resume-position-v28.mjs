import pg from 'pg';
const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not configured.');
  process.exit(1);
}
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
try {
  await client.connect();
  await client.query('ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS resume_seconds INTEGER NOT NULL DEFAULT 0');
  console.log('✅ lesson_progress.resume_seconds database column is ready.');
} finally {
  await client.end();
}

import pg from 'pg';
const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS resume_seconds integer NOT NULL DEFAULT 0');
  console.log('✅ lesson_progress.resume_seconds database column is ready.');
} finally {
  await client.end();
}

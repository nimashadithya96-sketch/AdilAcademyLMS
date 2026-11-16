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
    ALTER TABLE student_training_videos
      ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'FREE';
  `);
  const result = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_training_videos'
      AND column_name = 'access_type';
  `);
  if (!result.rows.length) throw new Error("access_type column was not created.");
  console.log("✅ Student Training v58 FREE/PAID database column is ready.");
  console.table(result.rows);
} finally {
  await client.end();
}

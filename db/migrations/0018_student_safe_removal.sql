ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "removal_reason" text;
CREATE INDEX IF NOT EXISTS "users_removed_at_idx" ON "users" ("removed_at");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "learning_portal_enabled" boolean DEFAULT true NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_photo_object_key" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_photo_mime_type" text;
CREATE TABLE IF NOT EXISTS "consultant_admission_targets" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "daily_target" integer DEFAULT 0 NOT NULL,
  "weekly_target" integer DEFAULT 0 NOT NULL,
  "monthly_target" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

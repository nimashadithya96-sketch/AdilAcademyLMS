ALTER TABLE "cco_activation_requests" ADD COLUMN IF NOT EXISTS "activation_mode" text DEFAULT 'FULL' NOT NULL;
ALTER TABLE "cco_activation_requests" ADD COLUMN IF NOT EXISTS "trial_expires_at" timestamp with time zone;

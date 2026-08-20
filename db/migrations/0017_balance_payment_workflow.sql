ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "half_payment_lesson_limit" integer DEFAULT 7 NOT NULL;

CREATE TABLE IF NOT EXISTS "balance_payment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "original_payment_id" uuid NOT NULL REFERENCES "payment_requests"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "course_id" uuid NOT NULL REFERENCES "courses"("id"),
  "amount" numeric(12,2) NOT NULL,
  "transaction_reference" text NOT NULL,
  "proof_object_key" text,
  "proof_mime_type" text,
  "status" "payment_status" DEFAULT 'PENDING' NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "balance_payment_transaction_unique" ON "balance_payment_requests" ("transaction_reference");
CREATE INDEX IF NOT EXISTS "balance_payment_original_idx" ON "balance_payment_requests" ("original_payment_id");
CREATE INDEX IF NOT EXISTS "balance_payment_user_idx" ON "balance_payment_requests" ("user_id");

UPDATE "courses" SET "half_payment_lesson_limit" = 7 WHERE "slug" = 'crypto-trading-zero-to-pro';

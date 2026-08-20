CREATE TABLE IF NOT EXISTS "cco_main_pay_ids" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "intended_name" text NOT NULL,
  "intended_email" text NOT NULL,
  "intended_phone" text NOT NULL,
  "amount" numeric(12,2) DEFAULT '5000' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "claimed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cco_main_pay_ids_code_unique" ON "cco_main_pay_ids" ("code");

CREATE TABLE IF NOT EXISTS "cco_main_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pay_id_id" uuid NOT NULL REFERENCES "cco_main_pay_ids"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "account_id" uuid NOT NULL REFERENCES "network_accounts"("id"),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "date_of_birth" text NOT NULL,
  "nic_or_passport" text NOT NULL,
  "address_line_1" text NOT NULL,
  "address_line_2" text,
  "province" text NOT NULL,
  "district" text NOT NULL,
  "city" text NOT NULL,
  "transaction_reference" text NOT NULL,
  "proof_object_key" text,
  "proof_mime_type" text,
  "status" text DEFAULT 'AWAITING_PROOF' NOT NULL,
  "registration_token_hash" text,
  "review_note" text,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cco_main_applications_pay_id_unique" ON "cco_main_applications" ("pay_id_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cco_main_applications_user_unique" ON "cco_main_applications" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cco_main_applications_account_unique" ON "cco_main_applications" ("account_id");

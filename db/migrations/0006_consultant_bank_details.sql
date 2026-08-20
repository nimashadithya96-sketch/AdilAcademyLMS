CREATE TABLE "consultant_bank_details" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "bank_name" text NOT NULL,
  "branch_name" text NOT NULL,
  "account_holder_name" text NOT NULL,
  "account_number_encrypted" text NOT NULL,
  "account_number_last4" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consultant_bank_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX "consultant_bank_details_user_unique" ON "consultant_bank_details" USING btree ("user_id");

CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "is_active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "registration_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nic_or_passport" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = "created_at", "password_set_at" = "created_at" WHERE "password_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "inactivity_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"left_points_reset" integer NOT NULL,
	"right_points_reset" integer NOT NULL,
	"inactivity_days" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inactivity_resets" ADD CONSTRAINT "inactivity_resets_account_id_network_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;
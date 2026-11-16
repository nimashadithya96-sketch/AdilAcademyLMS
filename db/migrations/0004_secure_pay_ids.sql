CREATE TABLE "payment_reference_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "pay_id_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reference_ids_code_unique" ON "payment_reference_ids" USING btree ("code");--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_pay_id_id_payment_reference_ids_id_fk" FOREIGN KEY ("pay_id_id") REFERENCES "public"."payment_reference_ids"("id") ON DELETE no action ON UPDATE no action;
CREATE TYPE "public"."account_side" AS ENUM('LEFT', 'RIGHT');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('RESERVED', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('SR', 'CN');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('PENDING', 'INTERVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'PARTIAL', 'APPROVED', 'REJECTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'consultant', 'staff', 'admin');--> statement-breakpoint
CREATE TABLE "account_number_sequence" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 527694 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_point_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"left_available" integer DEFAULT 0 NOT NULL,
	"right_available" integer DEFAULT 0 NOT NULL,
	"lifetime_left" integer DEFAULT 0 NOT NULL,
	"lifetime_right" integer DEFAULT 0 NOT NULL,
	"stage_one_achieved" boolean DEFAULT false NOT NULL,
	"stage_two_achieved" boolean DEFAULT false NOT NULL,
	"last_qualified_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"object_key" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commission_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_key" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"calculated_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"matched_pairs" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"motivation" text,
	"status" "application_status" DEFAULT 'PENDING' NOT NULL,
	"interview_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'LKR' NOT NULL,
	"language" text DEFAULT 'si-LK' NOT NULL,
	"thumbnail_url" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"title" text NOT NULL,
	"video_provider" text,
	"video_id" text,
	"content" text,
	"resource_object_key" text,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"prefix" "account_type" NOT NULL,
	"numeric_part" integer NOT NULL,
	"status" "account_status" DEFAULT 'RESERVED' NOT NULL,
	"is_main_account" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"side" "account_side" NOT NULL,
	"placed_by_user_id" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"method" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"proof_object_key" text,
	"proof_mime_type" text,
	"transaction_reference" text,
	"receiving_account_id" uuid,
	"requested_parent_account_id" uuid,
	"requested_side" "account_side",
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"payout_method" text NOT NULL,
	"payout_details" jsonb NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_payment_id" uuid NOT NULL,
	"beneficiary_account_id" uuid NOT NULL,
	"side" "account_side" NOT NULL,
	"points" integer NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score_percent" integer NOT NULL,
	"passed" boolean NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option" integer NOT NULL,
	"explanation" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"passing_percent" integer DEFAULT 70 NOT NULL,
	"position" integer NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"available_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pending_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_point_balances" ADD CONSTRAINT "account_point_balances_account_id_network_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_cycles" ADD CONSTRAINT "commission_cycles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_cycle_id_commission_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."commission_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_account_id_network_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_applications" ADD CONSTRAINT "consultant_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_applications" ADD CONSTRAINT "consultant_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_accounts" ADD CONSTRAINT "network_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_placements" ADD CONSTRAINT "network_placements_account_id_network_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_placements" ADD CONSTRAINT "network_placements_parent_account_id_network_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_placements" ADD CONSTRAINT "network_placements_placed_by_user_id_users_id_fk" FOREIGN KEY ("placed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_source_payment_id_payment_requests_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_beneficiary_account_id_network_accounts_id_fk" FOREIGN KEY ("beneficiary_account_id") REFERENCES "public"."network_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_point_balances_account_unique" ON "account_point_balances" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_code_unique" ON "certificates" USING btree ("certificate_code");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_unique" ON "certificates" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_cycles_cycle_key_unique" ON "commission_cycles" USING btree ("cycle_key");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_cycle_account_stage_unique" ON "commission_entries" USING btree ("cycle_id","account_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_unique" ON "enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_unique" ON "lesson_progress" USING btree ("enrollment_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "network_accounts_number_unique" ON "network_accounts" USING btree ("prefix","numeric_part");--> statement-breakpoint
CREATE UNIQUE INDEX "network_placements_account_unique" ON "network_placements" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "network_parent_side_unique" ON "network_placements" USING btree ("parent_account_id","side");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_payment_code_unique" ON "payment_requests" USING btree ("payment_code");--> statement-breakpoint
CREATE UNIQUE INDEX "point_events_idempotency_unique" ON "point_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_idempotency_unique" ON "wallet_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_unique" ON "wallets" USING btree ("user_id");
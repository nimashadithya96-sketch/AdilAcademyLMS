CREATE TABLE IF NOT EXISTS "lesson_quiz_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "options" jsonb NOT NULL,
  "correct_option" integer NOT NULL,
  "explanation" text,
  "position" integer NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lesson_quiz_questions_correct_option_check" CHECK ("correct_option" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_questions_lesson_position_unique" ON "lesson_quiz_questions" USING btree ("lesson_id", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_quiz_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "score" integer,
  "total_questions" integer,
  "score_percent" integer,
  "watch_seconds_at_completion" integer,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_attempts_user_lesson_number_unique" ON "lesson_quiz_attempts" USING btree ("user_id", "lesson_id", "attempt_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_quiz_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL REFERENCES "lesson_quiz_attempts"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "lesson_quiz_questions"("id") ON DELETE CASCADE,
  "selected_option" integer NOT NULL,
  "is_correct" boolean NOT NULL,
  "answered_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lesson_quiz_answers_selected_option_check" CHECK ("selected_option" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_answers_attempt_question_unique" ON "lesson_quiz_answers" USING btree ("attempt_id", "question_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_quiz_watch_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "watched_seconds_total" integer DEFAULT 0 NOT NULL,
  "last_heartbeat_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_watch_progress_user_lesson_unique" ON "lesson_quiz_watch_progress" USING btree ("user_id", "lesson_id");

CREATE TABLE IF NOT EXISTS "revision_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "level" text NOT NULL,
  "is_complete" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "revision_series_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "revision_series_course_level_unique" ON "revision_series" USING btree ("course_id","level");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revision_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "series_id" uuid NOT NULL,
  "title" text NOT NULL,
  "video_provider" text,
  "video_id" text,
  "content" text,
  "duration_seconds" integer DEFAULT 0 NOT NULL,
  "position" integer NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "revision_videos_series_id_revision_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."revision_series"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revision_videos_series_position_idx" ON "revision_videos" USING btree ("series_id","position");

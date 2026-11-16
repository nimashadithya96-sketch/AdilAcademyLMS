ALTER TABLE "lesson_progress"
  ADD COLUMN IF NOT EXISTS "watched_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "lesson_progress"
  ADD COLUMN IF NOT EXISTS "detected_duration_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "lesson_progress"
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "lesson_progress" AS lp
SET
  "detected_duration_seconds" = GREATEST(lp."detected_duration_seconds", l."duration_seconds"),
  "watched_seconds" = GREATEST(
    lp."watched_seconds",
    CASE
      WHEN lp."progress_percent" >= 100 THEN l."duration_seconds"
      ELSE FLOOR((l."duration_seconds" * lp."progress_percent") / 100.0)::integer
    END
  )
FROM "lessons" AS l
WHERE l."id" = lp."lesson_id"
  AND l."duration_seconds" > 0;

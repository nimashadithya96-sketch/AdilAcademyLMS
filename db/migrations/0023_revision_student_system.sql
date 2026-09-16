CREATE TABLE IF NOT EXISTS revision_student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  revision_unlocked_at timestamptz NOT NULL DEFAULT now(),
  welcome_seen_at timestamptz,
  advanced_unlocked_at timestamptz,
  advanced_congratulations_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS revision_student_access_user_course_unique
  ON revision_student_access(user_id, course_id);

CREATE TABLE IF NOT EXISTS revision_student_level_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  level text NOT NULL,
  batch_start_position integer NOT NULL DEFAULT 1,
  batch_unlocked_at timestamptz NOT NULL DEFAULT now(),
  rollover_midnight timestamptz,
  midnight_active_slot integer,
  next_batch_unlock_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS revision_student_level_state_unique
  ON revision_student_level_state(user_id, course_id, level);

CREATE TABLE IF NOT EXISTS revision_video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES revision_videos(id) ON DELETE CASCADE,
  progress_percent integer NOT NULL DEFAULT 0,
  watched_seconds integer NOT NULL DEFAULT 0,
  resume_seconds integer NOT NULL DEFAULT 0,
  detected_duration_seconds integer NOT NULL DEFAULT 0,
  reached_eighty_at timestamptz,
  last_heartbeat_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS revision_video_progress_user_video_unique
  ON revision_video_progress(user_id, video_id);
CREATE INDEX IF NOT EXISTS revision_video_progress_user_idx
  ON revision_video_progress(user_id);

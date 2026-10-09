ALTER TABLE student_training_videos
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'FREE';

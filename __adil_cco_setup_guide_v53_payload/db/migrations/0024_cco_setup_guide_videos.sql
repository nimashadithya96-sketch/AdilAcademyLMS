CREATE TABLE IF NOT EXISTS cco_setup_guide_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_provider text NOT NULL DEFAULT 'youtube',
  video_id text NOT NULL,
  position integer NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

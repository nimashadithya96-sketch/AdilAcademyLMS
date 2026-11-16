CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  online_since_at timestamptz NOT NULL DEFAULT now(),
  current_module text,
  portal_mode text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE consultant_student_registrations
  ALTER COLUMN consultant_user_id DROP NOT NULL,
  ALTER COLUMN parent_account_id DROP NOT NULL,
  ALTER COLUMN side DROP NOT NULL;

ALTER TABLE consultant_student_registrations
  ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'CONSULTANT';

CREATE INDEX IF NOT EXISTS consultant_student_registrations_source_idx
  ON consultant_student_registrations (registration_source, created_at DESC);

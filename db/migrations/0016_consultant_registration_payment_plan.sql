ALTER TABLE "consultant_student_registrations"
  ADD COLUMN IF NOT EXISTS "payment_plan" text DEFAULT 'FULL' NOT NULL;

ALTER TABLE "consultant_student_registrations"
  ADD COLUMN IF NOT EXISTS "expected_payment_amount" numeric(12,2);

UPDATE "consultant_student_registrations" AS registration
SET "expected_payment_amount" = course."price"
FROM "courses" AS course
WHERE registration."course_id" = course."id"
  AND registration."expected_payment_amount" IS NULL;

ALTER TABLE "consultant_student_registrations"
  ALTER COLUMN "expected_payment_amount" SET NOT NULL;

ALTER TABLE "consultant_student_registrations"
  ADD CONSTRAINT "consultant_registration_payment_plan_check"
  CHECK ("payment_plan" IN ('FULL', 'HALF'));

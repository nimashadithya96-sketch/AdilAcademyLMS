#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f client/src/StudentGettingStartedPage.tsx ] || [ ! -f server/modules/student-training/routes.ts ]; then
  echo "❌ v58 stopped: Student Training v55 source files were not found."
  exit 1
fi

if ! grep -q 'ADIL_STUDENT_TRAINING_V55' server/index.ts; then
  echo "❌ v58 stopped: Student Training v55 registration marker was not found in server/index.ts."
  exit 1
fi

BACKUP_DIR="backup/student-training-register-lock-v58-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/client/src" "$BACKUP_DIR/server/modules/student-training"
cp client/src/StudentGettingStartedPage.tsx "$BACKUP_DIR/client/src/StudentGettingStartedPage.tsx"
cp client/src/student-training-videos.css "$BACKUP_DIR/client/src/student-training-videos.css"
cp server/modules/student-training/routes.ts "$BACKUP_DIR/server/modules/student-training/routes.ts"

echo "Backup: $BACKUP_DIR"

cp __adil_student_training_registration_lock_v58_payload/client/src/StudentGettingStartedPage.tsx client/src/StudentGettingStartedPage.tsx
cp __adil_student_training_registration_lock_v58_payload/client/src/student-training-videos.css client/src/student-training-videos.css
cp __adil_student_training_registration_lock_v58_payload/server/modules/student-training/routes.ts server/modules/student-training/routes.ts

node ensure-student-training-registration-lock-v58.mjs
npm run check
npm run build

echo ""
echo "✅ v58 Student Training published-list + registration unlock update completed."
echo "ℹ️ No database migration is required. Production DB is not modified by this installer."
echo "ℹ️ Public visitors can see published titles/descriptions only; video provider/ID stays protected until registered account login."

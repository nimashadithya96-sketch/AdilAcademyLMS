#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/backup/admin-video-unlock-revision-v59-$TS"
mkdir -p "$BACKUP/server/modules/revision" "$BACKUP/server/modules/courses"
cp server/modules/revision/student-service.ts "$BACKUP/server/modules/revision/student-service.ts"
cp server/modules/courses/routes.ts "$BACKUP/server/modules/courses/routes.ts"

echo "Backup: $BACKUP"
node apply-adil-admin-unlock-revision-v59.mjs

echo "Running TypeScript check..."
if ! npm run check; then
  echo "❌ TypeScript check failed. Restoring backup..."
  cp "$BACKUP/server/modules/revision/student-service.ts" server/modules/revision/student-service.ts
  cp "$BACKUP/server/modules/courses/routes.ts" server/modules/courses/routes.ts
  exit 1
fi

echo "Running production build..."
if ! npm run build; then
  echo "❌ Build failed. Restoring backup..."
  cp "$BACKUP/server/modules/revision/student-service.ts" server/modules/revision/student-service.ts
  cp "$BACKUP/server/modules/courses/routes.ts" server/modules/courses/routes.ts
  exit 1
fi

echo "✅ v59 Admin Video Unlock → Revision Access update completed."
echo "No database migration is required."
echo "Republish only after preview testing."

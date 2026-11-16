#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${PROD_DB_URL:-}" ]; then
  echo "❌ PROD_DB_URL is not available in this Shell. Do not paste the secret into chat."
  exit 1
fi
if [ ! -f db/migrations/0028_advance_revision_zoom_status.sql ]; then
  echo "❌ db/migrations/0028_advance_revision_zoom_status.sql not found. Install v56.1 source first."
  exit 1
fi

echo "Applying ONLY v56.1 Zoom duration/status migration to Production DB..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0028_advance_revision_zoom_status.sql

echo "Verifying Production column..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_zoom_sessions' AND column_name='duration_minutes';"

echo "✅ Production DB v56.1 migration completed."

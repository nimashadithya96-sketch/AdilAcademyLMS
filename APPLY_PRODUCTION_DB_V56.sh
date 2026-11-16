#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${PROD_DB_URL:-}" ]; then
  echo "❌ PROD_DB_URL is not available in this Shell. Do not paste the secret into chat."
  exit 1
fi

if [ ! -f db/migrations/0027_advance_revision_zoom_live.sql ]; then
  echo "❌ db/migrations/0027_advance_revision_zoom_live.sql not found. Install v56 source first."
  exit 1
fi

echo "Applying ONLY v56 revision_zoom_sessions migration to Production DB..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0027_advance_revision_zoom_live.sql

echo "Verifying Production table..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.revision_zoom_sessions') AS revision_zoom_sessions;"

echo "✅ Production DB v56 migration completed."

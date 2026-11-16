#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Applying ONLY v58 Student Training FREE/PAID migration to Production DB..."

if [ -z "${PROD_DB_URL:-}" ]; then
  echo "❌ PROD_DB_URL is not set. Add the Production Database URL as the temporary PROD_DB_URL Replit Secret first."
  exit 1
fi

psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0030_student_training_free_paid_access.sql

echo "Verifying Production column..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='student_training_videos' AND column_name='access_type';"

echo ""
echo "✅ Production DB v58 migration completed."

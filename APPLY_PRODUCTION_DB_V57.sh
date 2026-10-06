#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${PROD_DB_URL:-}" ]; then
  echo "❌ PROD_DB_URL is not available in this Shell. Do not paste the secret into chat."
  exit 1
fi
if [ ! -f db/migrations/0029_password_reset_codes.sql ]; then
  echo "❌ db/migrations/0029_password_reset_codes.sql not found. Install v57 source first."
  exit 1
fi
echo "Applying ONLY v57 password reset migration to Production DB..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0029_password_reset_codes.sql
echo "Verifying Production table..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.password_reset_codes') AS password_reset_codes;"
echo "✅ Production DB v57 migration completed."

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${PROD_DB_URL:-}" ]; then
  echo "❌ PROD_DB_URL is not available in this Shell. Do not paste the secret into chat."
  exit 1
fi
if [ ! -f db/migrations/0031_cco_main_pay_id_ip_binding.sql ]; then
  echo "❌ db/migrations/0031_cco_main_pay_id_ip_binding.sql not found. Install v59 source first."
  exit 1
fi
echo "Applying ONLY v59 CCO Main Pay ID IP-binding migration to Production DB..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0031_cco_main_pay_id_ip_binding.sql
echo "Verifying Production column..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='cco_main_pay_ids' AND column_name='bound_ip_hash';"
echo "✅ Production DB v59 migration completed."

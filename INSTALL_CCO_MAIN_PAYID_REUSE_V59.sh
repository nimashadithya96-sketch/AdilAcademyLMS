#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "============================================================"
echo " ADIL ACADEMY — CCO MAIN PAY ID 48H REUSE v59 UPDATE ONLY"
echo "============================================================"
[ -f package.json ] || { echo "❌ package.json not found. Run from project root."; exit 1; }
node ./apply-adil-cco-payid-reuse-v59.mjs
node ./ensure-source-cco-payid-reuse-v59.mjs
echo "Running TypeScript check..."
npm run check
echo "Running production build..."
npm run build
echo "Preparing CURRENT Replit development/test database only..."
node ./ensure-cco-payid-reuse-v59.mjs
echo "✅ v59 source + build + development database completed."
echo "IMPORTANT: Production DB is NOT modified by this installer."
echo "After preview testing, run ./APPLY_PRODUCTION_DB_V59.sh explicitly before republish."

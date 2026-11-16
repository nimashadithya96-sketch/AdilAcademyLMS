#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — STUDENT TRAINING FREE / PAID v58 UPDATE ONLY"
echo "============================================================"
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-student-training-access-v58.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "Preparing CURRENT Replit development/test database only..."
node ./ensure-student-training-access-v58.mjs

echo ""
echo "✅ v58 source + build + development database completed."
echo ""
echo "IMPORTANT: Production DB is NOT modified by this installer."
echo "After preview testing, run ./APPLY_PRODUCTION_DB_V58.sh before republish."

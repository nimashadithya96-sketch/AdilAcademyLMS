#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — ADVANCE REVISION ZOOM LIVE v56 UPDATE ONLY"
echo "============================================================"
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-advance-revision-zoom-v56.mjs
node ./ensure-source-advance-revision-zoom-v56.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "Preparing CURRENT Replit development/test database only..."
node ./ensure-advance-revision-zoom-v56.mjs

echo ""
echo "✅ v56 source + build + development database completed."
echo ""
echo "IMPORTANT: This installer does NOT modify PROD_DB_URL."
echo "After preview testing, run ./APPLY_PRODUCTION_DB_V56.sh explicitly before/after republish."

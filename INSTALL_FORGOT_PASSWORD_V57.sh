#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "============================================================"
echo " ADIL ACADEMY — FORGOT PASSWORD v57 UPDATE ONLY"
echo "============================================================"
[ -f package.json ] || { echo "❌ package.json not found. Run from project root."; exit 1; }
node ./apply-adil-forgot-password-v57.mjs
node ./ensure-source-forgot-password-v57.mjs
echo "Running TypeScript check..."
npm run check
echo "Running production build..."
npm run build
echo "Preparing CURRENT Replit development/test database only..."
node ./ensure-password-reset-v57.mjs
echo "✅ v57 source + build + development database completed."
echo "IMPORTANT: Production DB is NOT modified by this installer."
echo "After preview testing, run ./APPLY_PRODUCTION_DB_V57.sh explicitly before republish."

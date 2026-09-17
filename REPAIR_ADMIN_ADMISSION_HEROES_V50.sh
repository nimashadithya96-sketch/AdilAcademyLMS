#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "======================================================"
echo " ADIL ACADEMY — ADMIN ADMISSION HEROES v50 REPAIR"
echo " REPAIR ONLY"
echo "======================================================"
echo ""

node ./repair-adil-admin-admission-heroes-v50.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v50 repair + TypeScript check + production build completed."
echo ""
echo "Restart Preview with:"
echo "npm start"

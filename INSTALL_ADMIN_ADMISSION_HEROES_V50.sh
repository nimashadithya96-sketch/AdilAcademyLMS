#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=================================================="
echo " ADIL ACADEMY — ADMIN ADMISSION HEROES v50"
echo " UPDATE ONLY"
echo "=================================================="
echo ""

node ./apply-adil-admin-admission-heroes-v50.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v50 Admin Admission Heroes installation + checks completed."
echo ""
echo "Restart Preview with:"
echo "npm start"

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "===================================================="
echo " ADIL ACADEMY — PREMIUM COLORFUL HOME UI v49"
echo " UI UPDATE ONLY"
echo "===================================================="
echo ""

node ./apply-adil-home-ui-v49.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v49 Premium Colorful Home UI installation + checks completed."
echo ""
echo "Restart Preview with:"
echo "npm start"

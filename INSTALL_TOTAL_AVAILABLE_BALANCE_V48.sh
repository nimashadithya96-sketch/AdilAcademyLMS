#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "===================================================="
echo " ADIL ACADEMY — TOTAL AVAILABLE BALANCE v48"
echo " UPDATE ONLY"
echo "===================================================="
echo ""

node ./apply-adil-total-balance-v48.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v48 Total Available Balance installation + checks completed."
echo ""
echo "Restart Preview/server with:"
echo "npm start"

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo " ADIL ACADEMY — HALF PAYMENT STUDENTS v47"
echo " UPDATE ONLY"
echo "=============================================="
echo ""

node ./apply-adil-half-payment-students-v47.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v47 Half Payment Students installation + checks completed."
echo ""
echo "Start/restart the app with:"
echo "npm start"

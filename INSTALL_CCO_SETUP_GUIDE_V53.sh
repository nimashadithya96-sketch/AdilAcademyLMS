#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — CCO SETUP GUIDE v53 UPDATE ONLY"
echo "============================================================"
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-cco-setup-guide-v53.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "Creating/checking the new database table..."
node ./ensure-cco-setup-guide-v53.mjs

echo ""
echo "✅ v53 CCO Setup Guide installation + build + database completed."
echo ""
echo "NEXT:"
echo "  npm start"
echo "Then Preview:"
echo "  Home -> CCO Main Access -> CCO Setup Guide"
echo "  Admin -> CCO Training Videos"

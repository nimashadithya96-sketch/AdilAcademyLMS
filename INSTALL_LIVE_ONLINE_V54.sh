#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — LIVE ONLINE USERS v54 UPDATE ONLY"
echo "============================================================"
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-live-online-v54.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "Creating/checking Live Online database table..."
node ./ensure-live-online-v54.mjs

echo ""
echo "✅ v54 Live Online installation + build + database completed."
echo ""
echo "NEXT:"
echo "  npm start"
echo "Then Preview -> Admin -> Live Online"

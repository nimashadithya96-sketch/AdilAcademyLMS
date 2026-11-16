#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=============================================="
echo " ADIL ACADEMY — REVISION ADMIN v45 INSTALLER"
echo "=============================================="
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-revision-admin-v45.mjs
node ./ensure-revision-foundation-v45.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v45 installation + database foundation + checks completed."
echo "Now run: npm start"
echo "Then open Admin Dashboard → Revision Manager."

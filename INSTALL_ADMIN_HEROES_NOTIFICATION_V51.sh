#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "========================================================"
echo " ADIL ACADEMY — ADMIN HEROES + NOTIFICATION FIX v51"
echo " UPDATE ONLY"
echo "========================================================"
echo ""

node ./apply-adil-admin-heroes-notification-v51.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v51 installation + TypeScript check + production build completed."
echo ""
echo "Restart Preview with:"
echo "npm start"

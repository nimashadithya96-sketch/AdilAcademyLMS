#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — STUDENT TRAINING VIDEOS v55 UPDATE ONLY"
echo "============================================================"
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-student-training-v55.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "Creating/checking the Student Training database table..."
node ./ensure-student-training-v55.mjs

echo ""
echo "✅ v55 Student Training Videos installation + build + database completed."
echo ""
echo "NEXT:"
echo "  npm start"
echo ""
echo "Preview tests:"
echo "  Home -> Start your application -> Student Getting Started Guide"
echo "  Admin -> Training Videos -> Student Training"
echo "  Admin -> Training Videos -> CCO Training"

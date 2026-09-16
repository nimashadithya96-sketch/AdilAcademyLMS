#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo " ADIL ACADEMY — STUDENT REVISION v46 INSTALLER"
echo "=============================================="
echo ""

if [ ! -f package.json ]; then
  echo "❌ package.json not found. Run this from the main Replit project folder."
  exit 1
fi

node ./apply-adil-student-revision-v46.mjs
node ./ensure-student-revision-v46.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v46 Student Revision System installation + DB + checks completed."
echo "Now run: npm start"
echo "Then log in as a Student and open My Course → Revision."

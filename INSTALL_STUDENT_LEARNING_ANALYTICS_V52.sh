#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=========================================================="
echo " ADIL ACADEMY — STUDENT LEARNING ANALYTICS v52"
echo " UPDATE ONLY"
echo "=========================================================="
echo ""

node ./apply-adil-student-learning-analytics-v52.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v52 Student Learning Analytics installation + checks completed."
echo ""
echo "Restart Preview with:"
echo "npm start"

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " ADIL ACADEMY — STUDENT LEARNING ANALYTICS v52.1 REPAIR"
echo " BACKEND TYPE FIX ONLY"
echo "============================================================"
echo ""

node ./repair-adil-student-learning-analytics-v52-1.mjs

echo ""
echo "Running TypeScript check..."
npm run check

echo ""
echo "Running production build..."
npm run build

echo ""
echo "✅ v52.1 repair + TypeScript check + production build completed."
echo ""
echo "Now restart Preview with:"
echo "npm start"

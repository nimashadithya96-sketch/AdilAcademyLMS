ADIL ACADEMY — STUDENT LEARNING ANALYTICS v52.1 REPAIR ONLY

WHY
---
v52 FIXED successfully added the Admin UI and route wiring, but TypeScript strict mode
found four typing errors in the new backend analytics route around the "last watched video"
calculation.

Because npm run check failed, npm run build did not produce a new server bundle.
That is why the new Student Learning Analytics page is visible but shows:
"API route not found"

WHAT THIS REPAIR DOES
---------------------
- Replaces ONLY:
  server/modules/admin/student-learning-analytics.ts
- Fixes the four strict TypeScript errors shown in the Replit Shell.
- Keeps the v52 Admin UI and route wiring already installed.
- Runs npm run check.
- Runs npm run build.

It does NOT change:
- Database schema
- Student progress
- Q&A scores
- Course videos
- Revision videos
- Revision unlock rules
- Payments
- Consultants / CCO
- Commissions
- Payouts
- Other Admin pages

INSTALL
-------
Upload this ZIP to ~/workspace and run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Learning*Analytics*v52*1*REPAIR*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash REPAIR_STUDENT_LEARNING_ANALYTICS_V52_1.sh

If it ends with:
✅ v52.1 repair + TypeScript check + production build completed.

then run:
npm start

After the new build starts, hard refresh the Preview:
Ctrl + Shift + R

Then open:
Admin -> Student Learning Analytics

The API route should now be available from the newly built server bundle.

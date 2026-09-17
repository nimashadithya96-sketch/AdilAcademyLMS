ADIL ACADEMY — ADMIN ADMISSION HEROES v50 REPAIR ONLY

WHY THIS REPAIR EXISTS
----------------------
The first v50 installer calculated insertion positions before it added imports.
Adding the imports changed the file length, so the old insertion positions became incorrect.

That caused:
- AdminAdmissionHeroesPanel JSX to be inserted inside an existing MetricCard line in App.tsx
- adminAdmissionHeroesRouter mount text to be inserted inside an existing server route line

This repair does NOT guess around the broken lines.

SAFE REPAIR METHOD
------------------
The original v50 installer already created:
backup/admin-admission-heroes-v50/App.tsx.before-v50
backup/admin-admission-heroes-v50/index.ts.before-v50

This repair:
1. Restores ONLY App.tsx and server/index.ts from those exact automatic pre-v50 backups.
2. Keeps the valid new v50 component/CSS/API route files.
3. Re-applies the same v50 feature using corrected insertion logic.
4. Runs npm run check.
5. Runs npm run build.

No database, payments, commissions, consultant data, course data, Revision data or other LMS features are changed.

INSTALL
-------
Upload this ZIP to ~/workspace, then run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Admission*Heroes*v50*Repair*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash REPAIR_ADMIN_ADMISSION_HEROES_V50.sh

If it finishes with:
✅ v50 repair + TypeScript check + production build completed.

then run:
npm start

Test Preview before Republish.

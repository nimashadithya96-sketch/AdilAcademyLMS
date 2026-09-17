ADIL ACADEMY — ADMIN ADMISSION HEROES v50
UPDATE ONLY

WHAT THIS ADDS
--------------
Admin Dashboard -> Overview now gets a full-width "Admission Heroes" performance section.

Tabs:
- Weekly Top 5
- Monthly Top 10
- Target Winners

Each row shows:
- Rank
- Consultant profile photo / initials
- Consultant name
- CN main account number
- Weekly admissions
- Monthly admissions
- Current selected score / target achievement

RANKING DATA
------------
Uses the same Admission Heroes concept already used by Consultant accounts:
- Approved FULL-payment direct admissions only
- Weekly and monthly counts based on Asia/Colombo time
- Target Winners based on consultant-set Daily / Weekly / Monthly admission targets

IMPORTANT
---------
This is a read-only Admin performance view.

It does NOT modify:
- Student admissions
- Payment approval
- Consultant commissions
- Binary points
- CCO accounts
- Weekly payouts
- Existing Consultant Admission Heroes page
- Revision system
- Course access
- Database schema

NO DATABASE MIGRATION REQUIRED.

FILES ADDED
-----------
client/src/AdminAdmissionHeroesPanel.tsx
client/src/admin-admission-heroes.css
server/modules/admin/admission-heroes.ts

FILES PATCHED
-------------
client/src/App.tsx
server/index.ts

BACKUP
------
backup/admin-admission-heroes-v50/

INSTALL
-------
Upload ZIP to ~/workspace and run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Admission*Heroes*v50*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_ADMIN_ADMISSION_HEROES_V50.sh

Then:
npm start

Test in Preview before Republish.

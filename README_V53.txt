ADIL ACADEMY — CCO SETUP GUIDE v53 UPDATE ONLY

WHAT THIS UPDATE ADDS
---------------------
Public / consultant-facing:
- Existing Home -> CCO Main Access stays intact.
- Existing Special Pay ID Verification stays intact.
- Adds a new card underneath: CCO Setup Guide.
- CCO Setup Guide opens a separate step-by-step video page.
- Only Published videos are shown publicly.
- Previous / Next step navigation.
- Uses the existing protected Adil Academy video player.

Admin:
- New Admin sidebar item: CCO Training Videos.
- Add video title.
- Add short description.
- YouTube or Vimeo.
- URL or Video ID.
- Draft / Published.
- Edit.
- Delete.
- Reorder Up / Down.
- Preview in Admin.

Database:
- Adds only one new table: cco_setup_guide_videos.
- Migration file: db/migrations/0024_cco_setup_guide_videos.sql.
- Installer also safely creates the table with IF NOT EXISTS.

NOT CHANGED
-----------
- CCO Main Special Pay ID verification logic.
- Student course system.
- Revision logic.
- Payments.
- Consultant account placement.
- Commissions / payouts.
- Existing videos or student progress.

BACKUP
------
Installer creates:
backup/cco-setup-guide-v53/

INSTALL
-------
cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*CCO*Setup*Guide*v53*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_CCO_SETUP_GUIDE_V53.sh

After success:
npm start

Test in Preview before Republish.

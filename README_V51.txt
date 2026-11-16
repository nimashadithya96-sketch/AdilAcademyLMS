ADIL ACADEMY — ADMIN HEROES + NOTIFICATION FIX v51
UPDATE ONLY

WHAT THIS FIXES
---------------
1) Adds a dedicated Admin sidebar item:
   Admission Heroes

2) Clicking it opens the existing Admin Admission Heroes ranking page directly:
   - Weekly Top 5
   - Monthly Top 10
   - Target Winners

3) Fixes the notification panel layout.
   On desktop the notification list docks at the right side.
   While it is open, dashboard content gets extra right space so TOTAL RS / Overview cards are not hidden underneath it.

IMPORTANT
---------
The existing Admission Heroes API/data logic from v50 is kept.
No database, payments, consultants, commissions, points, payouts, course access or Revision logic is modified.

FILES PATCHED
-------------
client/src/App.tsx
client/src/styles.css

BACKUP
------
backup/admin-heroes-nav-notification-v51/

INSTALL
-------
Upload ZIP to ~/workspace, then run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Heroes*Notification*v51*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_ADMIN_HEROES_NOTIFICATION_V51.sh

Then:
npm start

Test Preview before Republish.

ADIL ACADEMY — LIVE ONLINE USERS v54 UPDATE ONLY

WHAT IT DOES
------------
Adds Admin -> Live Online.

Admin can see in near real time:
- Total Online
- Students Online
- Consultants Online
- Name
- SR/CN main account number
- Email
- Current portal/module
- Last heartbeat (Live now / seconds ago)
- Approximate continuous online duration
- Search + Student/Consultant filters
- Automatic refresh every 8 seconds

HOW "ONLINE" WORKS
------------------
Student/Consultant dashboards send a small server heartbeat every 20 seconds while the browser tab is visible.
A user is considered Online only if the server received a heartbeat within the last 70 seconds.
If the tab/browser is closed or hidden long enough, that user automatically disappears from Live Online.
This is more accurate than treating a 7-day login session as "online".

PRIVACY / SCOPE
---------------
Only Admin can view the Live Online directory.
Only authenticated Student and Consultant accounts are listed.
No GPS/location, device spying, message content or browsing outside the Adil Academy portal is collected.

DATABASE
--------
Adds one table only: user_presence
Migration file: db/migrations/0025_live_online_presence.sql
Installer also creates it safely with CREATE TABLE IF NOT EXISTS.

NOT CHANGED
-----------
- Courses / video progress
- Revision logic
- Payments
- CCO setup / Pay ID
- Network placement
- Commissions / payouts
- Existing support heartbeat

BACKUP
------
backup/live-online-v54/

INSTALL
-------
cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Live*Online*v54*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_LIVE_ONLINE_V54.sh

After success:
npm start

Test in Preview before Republish.

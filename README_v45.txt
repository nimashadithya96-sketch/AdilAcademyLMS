ADIL ACADEMY — REVISION FOUNDATION + ADMIN REVISION MANAGER v45
================================================================
UPDATE ONLY ZIP — NOT A FULL PROJECT REPLACEMENT

THIS IS PHASE 1 ONLY
--------------------
This v45 update prepares the separate Revision system and Admin management area.
It intentionally DOES NOT unlock or show the Student Revision tab yet.
Student Revision rules, daily 3-video access, 80% sequential unlocking,
12:00 AM / 6:00 AM rollover logic and 3D welcome/congratulations screens will
be added in the next student-side update after this Admin foundation is tested.

WHAT v45 ADDS
-------------
1. Admin Dashboard → Revision Manager
2. Separate Basic Revision and Advanced Revision tabs
3. Course selector
4. Add revision videos one by one later as you record them
5. Video title
6. YouTube / Vimeo provider
7. Video URL / Video ID
8. Duration
9. Optional notes
10. Draft / Published status
11. Edit / Delete
12. Move Up / Move Down ordering
13. Mark Basic Revision Series Complete
14. Mark Advanced Revision Series Complete
15. Reopen a completed series before editing it again
16. Admin audit-log entries for revision management actions
17. Separate database tables for revision content

IMPORTANT SAFEGUARD
-------------------
A Revision Series cannot be marked Complete unless:
- It has at least one video
- Every video is Published
- Every video has a Video URL / Video ID

Once a series is marked Complete, video editing is locked until the Admin uses
"Reopen Series". This protects future student progression rules from accidental
changes.

FILES MODIFIED
--------------
client/src/App.tsx
server/index.ts
db/schema.ts

FILES ADDED
-----------
client/src/RevisionAdminManager.tsx
client/src/revision-admin.css
server/modules/revision/routes.ts
db/migrations/0022_revision_manager_foundation.sql

DATABASE TABLES ADDED
---------------------
revision_series
revision_videos

NOT MODIFIED
------------
Normal My Course lesson rules
Current Daily 3 lesson system
Q&A logic
Student video progress logic
Payments
Pay ID
OTP / login
Consultant / CCO system
Network placement
Commissions / payouts
Customer Support
Existing course videos

BACKUP
------
The installer creates source backups in:
backup/revision-manager-v45/

INSTALL IN REPLIT
-----------------
1. Upload this ZIP to ~/workspace.
2. In Shell:

cd ~/workspace
ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Revision*Admin*v45*.zip' -print -quit)"
echo "Using: $ZIP_FILE"
unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"
bash INSTALL_REVISION_ADMIN_V45.sh

3. If everything passes, run:

npm start

4. Open:
Admin Dashboard → Revision Manager

TEST BEFORE REPUBLISH
---------------------
- Select a course
- Open Basic Revision
- Add one Draft video
- Edit it
- Publish it
- Reorder videos if you add more than one
- Mark Complete only after all final videos are added
- Check Advanced Revision tab separately

Do NOT Republish until Admin Revision Manager testing is successful.

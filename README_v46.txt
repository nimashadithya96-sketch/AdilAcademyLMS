ADIL ACADEMY — STUDENT REVISION SYSTEM v46
===========================================

UPDATE ONLY — requires tested Revision Manager v45 first.

WHAT THIS UPDATE ADDS
---------------------
Student Dashboard → Revision

1) Revision access gate
   - Revision stays locked until ALL normal My Course videos are 100% complete.
   - Every normal lesson must have published Q&A.
   - Every lesson Q&A must have a passed attempt (75% or higher).
   - Once earned, per-student Revision access is saved in the database.

2) Basic Revision
   - Basic Revision unlocks first.
   - Videos unlock sequentially:
       Video 1 open
       Video 2 opens after Video 1 reaches 80%
       Video 3 opens after Video 2 reaches 80%
   - Maximum 3 new revision videos per batch/day rule.
   - Previously unlocked videos remain available for rewatching.

3) Midnight / 6:00 AM rollover rule (Asia/Colombo server time)
   - If the student is actively watching the 3rd video when 12:00 AM is crossed,
     the next set becomes time-eligible at 12:00 AM.
   - If actively watching the 2nd video when 12:00 AM is crossed,
     the next set becomes time-eligible at 6:00 AM.
   - If actively watching the 1st video when 12:00 AM is crossed,
     the next set becomes time-eligible at the following 12:00 AM.
   - The previous/current set must still satisfy the 80% sequential rule.
   - The server/database is authoritative; changing the student's device clock does not bypass the rule.

4) Advanced Revision
   - Uses the SAME 80% sequential + 3-video + 12AM/6AM system.
   - Advanced Revision unlocks only when:
       a) Admin marked Basic Revision Series Complete in v45, AND
       b) the student completed every published Basic Revision video to 100%.

5) Videos can be added later
   - Admin can continue recording and adding revision videos one by one using v45 Revision Manager.
   - Published videos appear automatically in Student Revision Center.
   - Draft videos are not shown to students.
   - Basic videos already available remain usable even while the Basic series is still being built.

6) v47 animation state is prepared
   - Database stores one-time Revision Welcome state.
   - Database stores one-time Advanced Congratulations state.
   - v47 will add the final premium 3D Welcome / Congratulations screens.
   - The eligibility state is also checked when the final normal Q&A is passed and when a normal course video reaches 100%, so v47 can trigger at the correct completion moment.

STUDENT MESSAGES
----------------
6:00 AM rule:
"Daily Revision Limit Reached. Your next revision video will unlock at 6:00 AM."

Next midnight rule:
"Daily Revision Limit Reached. Your next three revision videos will unlock tomorrow at 12:00 AM."

FILES ADDED
-----------
client/src/StudentRevisionCenter.tsx
client/src/student-revision.css
server/modules/revision/student-service.ts
server/modules/revision/student-routes.ts
db/migrations/0023_revision_student_system.sql

FILES PATCHED SAFELY
--------------------
client/src/App.tsx
server/index.ts
server/modules/courses/routes.ts
server/modules/courses/lesson-q-and-a.ts
db/schema.ts

NOT CHANGED
-----------
Payment logic
OTP/login logic
Consultant / CCO business rules
Commission / payout logic
Normal course daily gate rules
Admin Revision Manager v45 behavior
Existing course videos or student records

DATABASE TABLES ADDED
---------------------
revision_student_access
revision_student_level_state
revision_video_progress

INSTALL
-------
1. Upload this ZIP into ~/workspace.
2. Extract and run the installer:

   cd ~/workspace
   ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Student*Revision*v46*.zip' -print -quit)"
   echo "Using: $ZIP_FILE"
   unzip -t "$ZIP_FILE"
   unzip -o "$ZIP_FILE"
   bash INSTALL_STUDENT_REVISION_V46.sh

3. Installer automatically runs:
   - source patch
   - database foundation
   - npm run check
   - npm run build

4. After success:
   npm start

5. Test with a Student account before Republish.

BACKUP
------
The installer creates source backups under:
backup/student-revision-v46/

IMPORTANT TEST ORDER
--------------------
A. Student who has NOT completed all normal videos/Q&A → Revision must show Locked.
B. Fully completed student → Revision unlocks and Basic Revision opens.
C. Add/publish 4+ Basic videos in Admin Revision Manager to test 80% + daily limit.
D. Mark Basic Series Complete only after all intended Basic videos are added.
E. Student must finish every Basic video 100% before Advanced unlocks.

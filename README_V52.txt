ADIL ACADEMY — STUDENT LEARNING ANALYTICS v52
UPDATE ONLY

ADMIN FEATURE
-------------
Adds:
Admin -> Student Learning Analytics

SEARCH
------
Search using:
- SR number
- CN number
- Student name
- Email
- Phone

LIVE DATABASE ANALYTICS
-----------------------
NO video totals are hard-coded.

Every profile request reads current database content.

Basic Theory:
- Total = current course lessons that currently have a video attached
- Watched = current videos with recorded watch progress
- Completed = current videos at 100%

Basic Revision:
- Total = current Published Basic Revision videos
- Watched / Completed from revision progress
- Shows Locked / Unlocked

Advanced Revision:
- Total = current Published Advanced Revision videos
- Watched / Completed from revision progress
- Shows Locked / Unlocked

If Admin adds/removes normal course videos, or publishes/unpublishes Revision videos,
the totals recalculate from the database.

While a student profile is open, the UI refreshes from the server every 15 seconds.
There is also a manual Refresh button.

LEARNING VS KNOWLEDGE
---------------------
Learning Progress %
= fully completed current published/attached videos divided by current total videos.

Knowledge Check %
= average of the student's best completed score for each currently published lesson Q&A.

These are intentionally shown separately because watching a video does not prove knowledge.

EXTRA ADMIN INFORMATION
-----------------------
- Total videos watched
- Total videos completed
- Current learning stage
- Q&A required / attempted / passed
- Last learning activity
- Last watched video
- Activity status:
  Excellent Progress / On Track / Needs Attention / Inactive

MULTI-COURSE READY
------------------
If a learner has more than one enrollment, the page gives a course selector and
calculates each course separately.

IMPORTANT
---------
No database migration is required.

This is READ-ONLY analytics.
It does NOT change:
- Student video progress
- Q&A results
- Revision unlock rules
- Daily Revision limits
- Payments
- Half/Full payment access
- Consultants / CCO
- Commissions
- Weekly payouts
- Existing course content

FILES ADDED
-----------
client/src/StudentLearningAnalyticsWorkspace.tsx
client/src/student-learning-analytics.css
server/modules/admin/student-learning-analytics.ts

FILES PATCHED
-------------
client/src/App.tsx
server/index.ts

BACKUP
------
backup/student-learning-analytics-v52/

INSTALL
-------
Upload ZIP to ~/workspace and run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Student*Learning*Analytics*v52*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_STUDENT_LEARNING_ANALYTICS_V52.sh

Success should end with:
✅ v52 Student Learning Analytics installation + checks completed.

Then:
npm start

Test in Preview before Republish.

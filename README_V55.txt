ADIL ACADEMY — STUDENT TRAINING VIDEOS v55 UPDATE ONLY

PURPOSE
-------
Adds a Student Getting Started video guide before the existing application/login flow,
and combines Student + CCO video management under one clear Admin menu.

PUBLIC / STUDENT SIDE
---------------------
Home -> Start your application
now opens:
Student Getting Started Guide

The guide:
- Shows Admin-published Student Training videos in step order.
- Step 01 / Step 02 / Step 03...
- Previous / Next navigation.
- Uses the existing protected Adil Academy video player.
- Final step has Continue to Application.
- Continue to Application opens the existing /login page.
- If no videos are published yet, the student can still continue to the existing application/login page.

ADMIN SIDE
----------
Sidebar:
CCO Training Videos
becomes:
Training Videos

Inside Training Videos:
[ Student Training ] [ CCO Training ]

Student Training supports:
- Add title
- Short description
- YouTube / Vimeo
- URL or Video ID
- Draft / Published
- Preview
- Edit
- Delete
- Move Up / Down

CCO Training:
- Keeps the existing v53 CCO Training Videos manager and existing CCO video data unchanged.

DATABASE
--------
Adds only:
student_training_videos

Migration:
db/migrations/0026_student_training_videos.sql

REQUIREMENT
-----------
CCO Setup Guide v53 must already be installed.
This update is compatible with v54 Live Online if v54 is present.

NOT CHANGED
-----------
- Existing /login application/login system.
- CCO Setup Guide public page.
- Existing CCO Training video data.
- Special Pay ID Verification.
- Student course lessons/progress.
- Revision.
- Payments.
- Consultant network.
- Commissions / payouts.

BACKUP
------
backup/student-training-v55/

INSTALL
-------
cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Student*Training*Videos*v55*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_STUDENT_TRAINING_V55.sh

After success:
npm start

Then test in Preview BEFORE Republish.

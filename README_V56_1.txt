ADIL ACADEMY — Advance Revision Zoom Live v56.1 — UPDATE ONLY
================================================================

PURPOSE
-------
Refines the v56 Advanced Revision Zoom Live feature without touching the existing Revision video system.

NEW IN v56.1
------------
- Admin can set Zoom class duration in minutes (default 120, allowed 15–1440).
- Admin sees timing state: UPCOMING / LIVE / ENDED.
- Student sees UPCOMING or LIVE status clearly.
- Scheduled Zoom links automatically disappear from the Student API after start time + duration.
- A Zoom class with no scheduled time behaves as LIVE until Admin moves it to Draft/deletes it.
- Student schedule remains displayed in Asia/Colombo time.
- Existing multiple links, edit, delete, Publish/Draft and direct Zoom opening remain unchanged.

SECURITY / ACCESS
-----------------
- Zoom links are still returned only to students who have Advanced Revision unlocked.
- Ended scheduled Zoom links are not returned by the student API.

UNCHANGED / PROTECTED
---------------------
- Basic Revision logic
- Existing Advanced Revision videos
- 80% sequential video unlock
- Daily 3-video revision limit
- 100% Basic completion requirement for Advanced unlock
- Normal course/Q&A/progress
- Payments, OTP, CCO, consultant, network, commission and payout systems

DATABASE
--------
Migration: db/migrations/0028_advance_revision_zoom_status.sql
Adds ONLY:
  revision_zoom_sessions.duration_minutes integer NOT NULL DEFAULT 120
No existing rows are deleted.

INSTALL
-------
Unzip into the existing Replit project root, then run:
  bash INSTALL_ADVANCE_REVISION_ZOOM_V56_1.sh

Preview-test Admin -> Revision Manager -> Advanced Revision -> Zoom Live Classes.
Then apply ONLY the Production DB migration:
  bash APPLY_PRODUCTION_DB_V56_1.sh

After Production migration succeeds, republish and test the published site.

BACKUP
------
Changed source files are backed up under:
  backup/advance-revision-zoom-v56-1/

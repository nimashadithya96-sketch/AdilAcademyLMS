ADIL ACADEMY — Advance Revision Zoom Live v56 — UPDATE ONLY
============================================================

PURPOSE
-------
Adds direct Zoom live-class links ONLY to Advanced Revision, in addition to the existing Advanced Revision videos.

ADMIN
-----
Admin -> Revision Manager -> select course -> Advanced Revision
A new "Zoom Live Classes" manager appears below the Advanced Revision video list.
Admin can:
- Add a live-class title
- Paste a direct https://*.zoom.us meeting link
- Optionally set Sri Lanka date/time and a student note
- Publish / move to Draft
- Edit / delete
- Open the Zoom link for testing
- Keep multiple Zoom classes if needed

STUDENT
-------
Students see the Zoom Live section ONLY after Advanced Revision is unlocked.
Published Zoom sessions appear with a "Join Zoom Live" button that opens Zoom directly in a new tab/app handoff.
Zoom links are NOT returned by the student API before Advanced Revision access is unlocked.

UNCHANGED / PROTECTED
---------------------
- Basic Revision logic
- Existing Advanced Revision videos
- 80% sequential video unlock rule
- Daily 3-video revision limit
- 100% Basic Revision completion requirement for Advanced unlock
- Normal course progress/Q&A
- Payments / OTP / CCO / consultant / network / commission / payout systems

DATABASE
--------
New table only: revision_zoom_sessions
Migration: db/migrations/0027_advance_revision_zoom_live.sql
No existing rows/tables are deleted or replaced.

INSTALL
-------
1) Unzip this UPDATE ONLY package into the existing project root.
2) Run:
   bash INSTALL_ADVANCE_REVISION_ZOOM_V56.sh
3) Preview test Admin -> Revision Manager -> Advanced Revision.
4) Preview test with an Advanced-unlocked student account.
5) Production DB is intentionally NOT touched by the main installer.
6) When preview is good, apply ONLY the v56 Production migration explicitly:
   bash APPLY_PRODUCTION_DB_V56.sh
7) Republish/restart as appropriate and test the published site.

BACKUP / ROLLBACK
-----------------
The installer backs up every changed source file under:
backup/advance-revision-zoom-v56/

The update is marker-based and stops safely if the expected current Revision code is not found.
It does not replace the whole project.

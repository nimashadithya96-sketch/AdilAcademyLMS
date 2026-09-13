ADIL ACADEMY — DAILY 3 VIDEOS + ADMIN ALL-VIDEO UNLOCK

This update pack safely combines:
1) Daily maximum 3 new lessons.
2) Sequential unlock: previous video 100% + lesson Q&A score 75%+.
3) Existing failed-Q&A rewatch/retake logic remains.
4) Admin > Course top: Videos Unlock panel.
5) Search exact SR number and view student/course details.
6) Unlock All Videos applies only to that student + selected course.
7) Admin override bypasses Daily 3, previous-Q&A sequencing, and half-payment lesson lock for that student/course.
8) Use Normal Limits restores the standard gating rules.
9) Unlock/restore actions are recorded in audit_logs.
10) Persistent video_access_overrides DB table is created automatically by ensure-video-unlock-table.mjs.

Apply order:
node apply-daily-video-limit.mjs
node apply-admin-video-unlock.mjs
node ensure-video-unlock-table.mjs
npm run build
restart server

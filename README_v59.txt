ADIL ACADEMY LMS — v59 UPDATE ONLY
Admin Video Unlock → Basic Revision Access

Requested behavior
- When Admin uses the existing student video access control to Unlock All Videos,
  that student's Basic Revision access must also become available immediately.
- Do NOT wait until every normal course video (for example all 12) is watched/completed.

Preserved behavior
- Existing main-course video access logic remains unchanged.
- Basic Revision still uses its existing daily 3-video and 80% sequential rules.
- Advanced Revision is NOT force-unlocked. It still unlocks only by the existing
  Basic Revision completion rule.
- Existing Revision progress is not deleted or reset.
- If Admin later restores normal course video limits, an already-granted Revision
  access is not revoked (prevents destructive loss of student Revision progress).
- No database migration is required.

Compatibility / existing students
- Future Admin Unlock All Videos actions grant Basic Revision immediately.
- Students who already had the Admin all-videos override before v59 are also handled:
  the next time their Revision overview is requested, Basic Revision access is granted.

Install
1. Upload this ZIP to the existing Replit project root.
2. Extract it.
3. Run INSTALL_ADMIN_VIDEO_UNLOCK_REVISION_V59.sh
4. Test in Preview before Republish.

Scope
Only these existing source files are patched:
- server/modules/revision/student-service.ts
- server/modules/courses/routes.ts

The installer creates a backup and restores it automatically if check/build fails.

ADIL ACADEMY — Student Training FREE / PAID v58 — UPDATE ONLY

WHAT THIS CHANGES
1. Admin -> Training Videos -> Student Training now has separate FREE Videos and PAID Videos sections.
2. FREE published videos are playable publicly from the existing Student Getting Started page.
3. PAID published videos are visible publicly as LOCKED cards, but their video ID/link is NOT returned by the public API.
4. After a student/consultant logs in with an ACTIVE course enrollment, PAID videos automatically unlock on the same Training Videos page.
5. Existing Student Training videos are classified as FREE by default, so the current "How to buy/register" onboarding videos remain publicly watchable.
6. Draft videos remain hidden from public/student published lists.
7. FREE and PAID videos have independent ordering.

NOT CHANGED
- Normal course videos/progress
- Basic/Advance Revision rules
- Advance Revision Zoom Live
- Forgot Password
- Payments/Pay IDs
- Consultant/CCO logic
- CCO Training Videos
- Commissions

SECURITY
- Public endpoint never returns the video_id of a PAID video.
- PAID video links are returned only after authenticated student/consultant access AND an ACTIVE course enrollment exists.

INSTALL
Upload this ZIP to the Replit project root, unzip, then run:
  ./INSTALL_STUDENT_TRAINING_FREE_PAID_V58.sh

After preview testing, apply Production DB migration explicitly:
  ./APPLY_PRODUCTION_DB_V58.sh

Migration 0030 adds only:
  student_training_videos.access_type text NOT NULL DEFAULT 'FREE'

Backups are created under:
  backup/student-training-free-paid-v58/

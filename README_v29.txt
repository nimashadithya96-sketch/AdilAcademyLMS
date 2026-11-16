ADIL ACADEMY — MY COURSE RESUME + MOBILE FULLSCREEN UPDATE ONLY v29

Purpose
- Fix Dashboard "Continue Learning" so it opens the same in-progress lesson at the exact saved playback timestamp.
- Save current playback position separately from genuine watched-progress seconds.
- On mobile, pressing Play requests fullscreen immediately from the user's tap.
- Dashboard Continue Learning also requests app fullscreen on mobile before opening My Course when the browser permits it.

Preserved
- Genuine watch-time tracking
- Daily video limits
- Q&A rules
- Sequential lesson access
- Existing protected player controls

Database
- Adds lesson_progress.resume_seconds (integer, default 0).

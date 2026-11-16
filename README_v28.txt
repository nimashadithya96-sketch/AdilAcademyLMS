ADIL ACADEMY — My Course Resume + Mobile Fullscreen Update ONLY v28

This patch is intended to be applied AFTER the v27 mobile inline player update.

Adds only these behaviors:
1. Mobile: pressing Play requests fullscreen for the protected video player.
2. Dashboard “ඔබ නතර කළ තැනින් ඉගෙනීම දිගටම කරගෙන යන්න” chooses the latest in-progress lesson.
3. The real playback timestamp is stored in lesson_progress.resume_seconds.
4. Resume Learning restores the same lesson and seeks to the saved timestamp.
5. Resume Learning also attempts fullscreen when the resumed player is ready. If a mobile browser blocks automatic fullscreen, the first Play tap requests fullscreen directly.

Existing daily limits, Q&A rules, protected watch-time tracking and access controls are not intentionally changed.

Apply script:
  node apply-resume-fullscreen-v28.mjs
Database one-time migration:
  node ensure-resume-position-v28.mjs
Then build and restart the app.

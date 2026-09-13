ADIL ACADEMY — MY COURSE MOBILE INLINE VIDEO UPDATE ONLY

This patch changes ONLY the first requested mobile My Course behavior:
- On screens up to 900px wide, tapping a lesson shows that lesson's video player directly below the selected lesson/topic.
- The mobile catalog is no longer clipped to a fixed 420px scroll area, so the inline player can be seen naturally.
- Desktop My Course keeps the existing two-column layout.
- No video control, Back button, Resume Learning, server, database, Q&A, daily-limit, admin-unlock, or progress logic is changed by this patch.

Apply from the Replit project root:
node apply-mobile-inline-player-v27.mjs

Then build/run the project using your normal commands.

Rollback if needed:
node rollback-mobile-inline-player-v27.mjs

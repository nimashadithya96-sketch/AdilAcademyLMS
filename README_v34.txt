ADIL ACADEMY — Mobile My Course Flat Layout / Single Active View v34

PURPOSE
Fix the mobile My Course lesson screen where several nested dark/green
containers and borders look like multiple screens/cards stacked on top of
each other.

THIS UPDATE:
- Removes repeated outer/nested borders on mobile.
- Removes repeated wrapper backgrounds and shadows around the active lesson.
- Keeps the selected lesson content as the visual focus.
- Keeps Video, Lesson Note and Progress as meaningful sections.
- Gives the active lesson one clean mobile content width.
- Prevents old nested theme gutters from creating multiple vertical side lines.
- Does not intentionally change desktop layout.

NOT CHANGED:
- Video playback/control logic
- Fullscreen logic
- Resume Learning
- Daily 3-video limit
- Q&A / 80% / 75% rules
- Lesson locking
- Progress calculation
- Admin Unlock All Videos

Apply from project root:
node apply-mobile-flat-layout-v34.mjs
npm run build

A backup of styles.css is created automatically.

ADIL ACADEMY — Mobile Fullscreen IN / OUT Fix ONLY v31

Purpose:
- Fix mobile fullscreen toggle for the existing ProtectedVideoPlayer.
- Same fullscreen control enters fullscreen and exits fullscreen.
- Adds explicit iframe fullscreen permission.
- Native browser Fullscreen API is used first.
- CSS full-viewport fallback is used for mobile/iOS/in-app browsers that reject native fullscreen.

This patch does NOT intentionally change:
- Resume Learning timestamp logic
- Daily 3-video limits
- Q&A unlock/pass rules
- Sequential lesson locking
- Admin unlock overrides
- Watch-progress calculation

Apply from project root:
node apply-mobile-fullscreen-v31.mjs
npm run build

The patch makes backups before writing and restores original files if the expected code structure does not match.
ADIL ACADEMY — Premium Video Controls Update ONLY v33

What changes:
- Removes Play/Pause from the bottom control bar.
- Adds a premium center Play/Pause control over the video.
- First tap on the video reveals the controls.
- Existing 4-second auto-hide behavior remains.
- Bottom bar becomes a translucent blurred glass control dock instead of a heavy black bar.
- Keeps: 10s Back, Restart, Watch Tracking label, Fullscreen.
- Works with the existing v31/v32 fullscreen classes.

What is NOT intentionally changed:
- Resume Learning timestamp logic
- Q&A rules
- Daily 3-video rules
- sequential lesson locks
- watch-progress calculation
- Admin unlock rules

Apply from project root:
node apply-premium-video-controls-v33.mjs
npm run build

The script creates backups and restores the original files if the expected current code does not match.

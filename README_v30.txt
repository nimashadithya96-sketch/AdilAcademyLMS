ADIL ACADEMY — MOBILE FULLSCREEN IN/OUT FIX ONLY v30

Changes ONLY fullscreen behavior in the protected lesson video player.

- Enables YouTube fullscreen (fs=1).
- Adds explicit iframe fullscreen permission.
- Fullscreen control is now a true toggle: same button enters and exits.
- Supports standard Fullscreen API and WebKit-prefixed fullscreen where available.
- Adds a fixed full-viewport fallback for mobile Safari/in-app webviews that reject native element fullscreen.
- Does not intentionally change Resume Learning, watch progress, Daily 3 limit, Q&A rules, lesson unlocking, or admin override.

Important:
Replit Preview runs the app inside another iframe, so Replit/browser policy may block native fullscreen there. Test fullscreen using the standalone preview/deployment URL in Chrome/Safari on the phone.

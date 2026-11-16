ADIL ACADEMY — 3D WARPED EDUCATION GLOBAL LOADER v44
=======================================================

UPDATE ONLY — NOT A FULL PROJECT REPLACEMENT

WHAT IT ADDS
------------
A lightweight global page/tab transition loader inspired by the approved preview:

• 3D warped education panels:
  - Crypto Trading
  - ICT Learning
  - EPS-TOPIK Korean
  - Student Portal
• Gold ADIL "A" logo in the center
• Thin premium LOADING progress sweep
• Desktop + mobile responsive
• Covers internal page / dashboard tab navigation

SMART LOADING BEHAVIOR
----------------------
The loader is NOT intentionally held for a long fixed duration.

It:
1. Starts immediately when an internal page/tab navigation is detected.
2. Tracks same-origin /api/ requests that begin during navigation.
3. Watches the React root for destination-content rendering.
4. Finishes when API work is done and the page has settled.
5. Uses a 3-second safety maximum so it can never remain stuck.

A very short ~360 ms minimum prevents an ugly flash on instant navigations.

SAFETY / SCOPE
--------------
Modified:
• client/src/main.tsx (or main.jsx/main.ts/main.js) — ONE side-effect import only.

Added:
• client/src/adilWarpLoader.ts
• client/src/adilWarpLoader.css
• client/public/adil-loader-logo.png

NOT MODIFIED:
• client/src/App.tsx
• Server/backend
• Database/schema
• Login/OTP
• Student registration / Pay ID popup
• Admin/CCO business logic
• Payments
• Commissions / payouts
• Courses / videos / progress rules
• Replit ports

Automatic backup:
backup/global-loader-v44/

INSTALL
-------
Upload this ZIP to ~/workspace, then:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 1 -type f -iname '*Warped*Loader*v44*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -o "$ZIP_FILE"

node ./apply-adil-warp-loader-v44.mjs

npm run check
npm run build
npm start

After local/temporary URL testing is correct:
Republish the Replit app.

ROLLBACK
--------
The installer creates a backup under:
backup/global-loader-v44/

To remove the loader manually:
1. Remove: import "./adilWarpLoader"; from client/src/main.tsx
2. Delete:
   client/src/adilWarpLoader.ts
   client/src/adilWarpLoader.css
   client/public/adil-loader-logo.png

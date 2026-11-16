ADIL ACADEMY — PREMIUM COLORFUL HOME UI v49
UI UPDATE ONLY

This update follows the approved homepage concept:
- Premium dark navy education homepage
- Gold Adil Academy primary accent
- Green / orange / purple feature cards
- Large "Build Skills for Your Future" hero
- Student learning visual
- Explore Courses + Student Login CTAs
- Colorful course cards
- Matching navy/gold/neon theme through the remaining public homepage
- Responsive desktop/tablet/mobile layout

IMPORTANT
---------
This ZIP changes UI only.

It does NOT change:
- Backend/server
- Database
- Student records
- Payments
- Pay IDs
- OTP/login logic
- CCO / consultants
- Commissions
- Weekly payouts
- Course-access rules
- Revision logic
- Admin dashboard logic

FILES PATCHED
-------------
client/src/App.tsx
client/src/styles.css

ASSET ADDED
-----------
client/public/adil-home-hero-v49.jpg

BACKUP
------
backup/home-ui-v49/

INSTALL
-------
Upload this ZIP to ~/workspace and run:

cd ~/workspace

ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Colorful*Home*UI*v49*.zip' -print -quit)"
echo "Using: $ZIP_FILE"

unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"

bash INSTALL_HOME_UI_V49.sh

Then:
npm start

Test in Preview first.
Republish only after the homepage is approved.

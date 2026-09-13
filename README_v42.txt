ADIL ACADEMY — HOME PAGE PREMIUM ENGLISH UPDATE v42
====================================================

This is the corrected UPDATE ONLY package for the current ADIL ACADEMY LMS.

WHY v42
-------
v41 stopped safely before changing project files because its safety check expected the FAQ section to have the exact class:
  className="academy-faq-section"

The current project actually uses:
  className="academy-section academy-faq-section"

v42 fixes that safety check and makes the visual layer more robust by scoping directly to the existing .academy-home root instead of depending on a specific <div> wrapper.

MODIFIES ONLY
-------------
  client/src/App.tsx
  client/src/styles.css

DOES NOT MODIFY
---------------
Login, OTP, Admin/CCO logic, student registration, Pay ID popup, backend APIs, database/schema, payments, commissions/payouts, course access, video player, or Replit port settings.

BACKUPS
-------
Created automatically at:
  backup/home-v42/App.tsx.before-v42
  backup/home-v42/styles.css.before-v42

APPLY
-----
cd ~/workspace
unzip -o Adil_Academy_Home_Page_Premium_English_Update_ONLY_v42.zip
node ./apply-home-premium-v42.mjs
npm run check
npm run build
npm start

EXPECTED SUCCESS
----------------
✅ ADIL ACADEMY Home Page v42 applied successfully.

ADIL ACADEMY — HOME PAGE PREMIUM ENGLISH UPDATE v41
=====================================================

PURPOSE
-------
Premium visual refresh for the existing public Home Page only.

WHAT THIS UPDATE DOES
---------------------
• Positions ADIL ACADEMY as a modern skills & career learning platform — not a crypto-only website.
• Premium English hero: “Build Skills. Shape Your Future.”
• Replaces known Sinhala wording on the public Home Page with professional English.
• Upgrades hero, glass header, course cards, benefits, learning journey, LMS preview, FAQ, CTA and footer styling.
• Keeps existing real/dynamic course data and current course images.
• Adds subtle premium motion with reduced-motion accessibility support.
• Improves desktop and mobile presentation.
• Does NOT add fake student numbers, fake success rates, fake testimonials or income claims.

SAFETY
------
The patch modifies ONLY:
  client/src/App.tsx
  client/src/styles.css

It DOES NOT modify:
• Login / OTP
• Admin / CCO logic
• Student registration / Pay ID popup
• Database / schema
• Payments
• Payout / commission system
• Course access / video logic
• Replit port configuration

Automatic source backups are created in:
  backup/home-v41/

APPLY
-----
cd ~/workspace
unzip -o Adil_Academy_Home_Page_Premium_English_Update_ONLY_v41.zip
node apply-home-premium-v41.mjs
npm run check
npm run build
npm start

IMPORTANT
---------
Use npm start for production-style testing.
Do not use “Fix all with Agent” for this update.

DESIGN DIRECTION
----------------
Dark premium academy identity:
• Deep black / forest background
• ADIL green accent
• Refined gold secondary accent
• Glass header
• Strong dynamic course cards
• Professional education positioning

BEST NEXT IDEA
--------------
After real verified student feedback is collected, add a “Verified Student Stories” section.
Do not use invented testimonials or performance/income claims.

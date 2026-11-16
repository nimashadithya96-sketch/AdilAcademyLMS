ADIL ACADEMY — Admin Student Registration Success Popup v37
UPDATE ONLY

Purpose
-------
Fix the v36 exact-match failure and implement ONLY:
Admin -> Students -> Register New Student -> Register Student & Send Pay ID

On successful registration, Admin immediately sees a professional white popup with:
- Green success tick
- Student Registration Successful!
- Student Name
- Actual generated Pay ID
- Payment expiry sentence
- Exact expiry date + time in Asia/Colombo
- OK button

When OK is pressed, the existing onCreated() flow runs so Student Management refreshes only after the Admin has seen the popup.

Backend fix
-----------
The existing backend already creates:
- code (Pay ID)
- expiresAt (48 hours)

v37 adds only `payId: code` to the existing Admin registration 201 JSON response.
It does not create a new Pay ID and does not change the 48-hour rule.

Safety
------
Only these existing project files can be modified:
- client/src/App.tsx
- client/src/styles.css
- server/modules/platform/routes.ts

The patch creates .before-registration-success-v37 backup copies.
If any required safe anchor is not found, it restores the original three files and exits.

Not intentionally changed
-------------------------
OTP/login
Payment approval
Student account/SR numbering
Consultant/CN rules
Points/commissions
Course access
Daily video system
Q&A
Notifications
Other Admin features

Commands
--------
cd ~/workspace
unzip -o Adil_Academy_Student_Registration_Success_PayID_Update_ONLY_v37.zip
node apply-registration-success-v37.mjs
npm run check
npm run dev

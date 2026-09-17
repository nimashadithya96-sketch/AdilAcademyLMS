ADIL ACADEMY — HALF PAYMENT STUDENTS v47
UPDATE ONLY

PURPOSE
-------
Adds a separate Admin tab called:
Half Payment Students

This is ONLY a filtered management view. A Half Payment student continues to appear in all normal Students / Payments / Reports areas.

AUTOMATIC REMOVAL
-----------------
The list is driven by the existing payment status PARTIAL.
When a balance payment is approved, the existing system changes the original payment to APPROVED.
At that moment the student automatically disappears from Half Payment Students, but remains everywhere else as a normal/full-payment student.

ADMIN FLOW
----------
Admin -> Half Payment Students

List shows:
- Student name / email / phone
- SR number
- Course
- Paid amount / total
- Outstanding balance
- Current balance request status
- View Details

Clicking the student opens a full detail page IN THE SAME ADMIN CONTENT AREA.

Top-left:
<- Back to Half Payment Students

The profile includes:
- Personal details
- Account / SR details
- Current Half Payment details
- Outstanding balance
- Course and Half-payment lesson limit
- Number of lessons accessible / locked by payment
- Course progress
- Q&A passed summary
- Payment history
- Balance payment request history
- Warning if Admin Unlock All Videos override is active

NO DATABASE MIGRATION
---------------------
This update reads the existing users, payment_requests, balance_payment_requests, enrollments, course progress and Q&A tables.
No new table is created.

FILES ADDED
-----------
client/src/HalfPaymentStudentsWorkspace.tsx
client/src/half-payment-students.css
server/modules/platform/half-payment-students.ts

FILES PATCHED
-------------
client/src/App.tsx
server/index.ts

BACKUP
------
backup/half-payment-students-v47/

INSTALL
-------
Upload ZIP to ~/workspace then:

cd ~/workspace
ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Half*Payment*Students*v47*.zip' -print -quit)"
echo "Using: $ZIP_FILE"
unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"
bash INSTALL_HALF_PAYMENT_STUDENTS_V47.sh

The installer runs:
npm run check
npm run build

Then:
npm start

IMPORTANT
---------
Test in Preview before Republish.

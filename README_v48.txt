ADIL ACADEMY — TOTAL AVAILABLE BALANCE v48
UPDATE ONLY

WHAT THIS ADDS
--------------
Admin -> Overview gets a new full-width financial balance bar ABOVE the existing overview cards.

Main display:
TOTAL RS. — AVAILABLE BALANCE

FORMULA
-------
AVAILABLE BALANCE = APPROVED MONEY RECEIVED - CONSULTANT PAYOUTS MARKED PAID

Money received includes:
1. Student course payments
   - approved Half Payments (current paid amount)
   - approved Full Payments
   - after an approved Balance Payment, the existing original payment becomes Full/Approved and is counted once at the full amount
   - refunded payments are excluded
2. Approved CCO Main account purchases
3. Approved 2nd-7th CN account purchases
4. Paid 30-day CN trial activations are also included because money was actually received; an expired trial remains historical received money

Money deducted:
- Consultant payout requests ONLY when status = PAID

NOT deducted:
- pending consultant income
- approved-but-not-yet-paid payout requests
- pending commissions
- unpaid student balance amounts

BREAKDOWN SHOWN IN THE BAR
--------------------------
- Total received
- Course payments
- CCO main accounts
- 2nd-7th CN buys / trials
- Consultant payouts paid
- Available balance

IMPORTANT ACCOUNTING SAFETY
---------------------------
Balance payments are NOT double-counted. The existing LMS updates the original PARTIAL payment to APPROVED and sets paidAmount to the full total after balance approval. v48 sums the current accepted amount from the original payment record.

No database migration is required.
No payment approval, payout, commission, OTP, course, Revision, CCO or student logic is replaced.

FILES PATCHED
-------------
server/modules/platform/routes.ts
client/src/App.tsx
client/src/styles.css

BACKUP
------
backup/total-available-balance-v48/

INSTALL
-------
cd ~/workspace
ZIP_FILE="$(find . -maxdepth 2 -type f -iname '*Total*Balance*v48*.zip' -print -quit)"
echo "Using: $ZIP_FILE"
unzip -t "$ZIP_FILE"
unzip -o "$ZIP_FILE"
bash INSTALL_TOTAL_AVAILABLE_BALANCE_V48.sh

Then:
npm start

Test in Preview before Republish.

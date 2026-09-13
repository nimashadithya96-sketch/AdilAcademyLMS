ADIL ACADEMY — Admin Student Registration Success Popup v35

UPDATE ONLY

After Admin clicks:
Register Student & Send Pay ID

and the server successfully creates the registration + sends the Pay ID email,
a clean white confirmation popup is shown immediately.

Popup contains:
✓ Green success tick
Student Registration Successful!
Student Name
Pay ID
Exact payment expiry date/time
Sri Lanka Time (Asia/Colombo)
OK button

Backend change:
The existing admin registration response now also returns the already-generated
Pay ID code to the frontend. The existing 48-hour expiresAt value is preserved.

No database migration is required.
No changes are intended to payment approval, consultant points, course access,
student OTP/login, Daily Video, Q&A, or other LMS logic.

Apply:
node apply-registration-success-v35.mjs
npm run build

The patch creates backups and restores original files if expected code does not match.

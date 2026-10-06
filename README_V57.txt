ADIL ACADEMY — FORGOT PASSWORD v57 UPDATE ONLY

Adds a secure Forgot Password flow to the existing Login page.

FLOW
1. Login -> Forgot password?
2. User enters account email.
3. 6-digit reset code is emailed (10 minute expiry).
4. User enters reset code + new password + confirmation.
5. Existing sessions are invalidated.
6. New password is saved using Argon2 and the user is securely logged in.

SECURITY
- Generic reset-request response prevents account enumeration.
- Reset codes are HMAC-hashed and never stored in plaintext.
- Codes expire after 10 minutes.
- Max 5 wrong attempts per code.
- 60-second resend cooldown.
- Only active, verified, non-removed accounts can reset passwords.
- Old sessions are invalidated after successful password reset.
- Password rule preserved: 8+ chars, uppercase, lowercase, number.

SCOPE
- Existing Login / Apply / Verify OTP flows remain unchanged.
- No course, payment, consultant, Revision, Zoom, commission, or network logic is changed.
- Installer updates the current Replit development/test DB only.
- Production DB requires explicit APPLY_PRODUCTION_DB_V57.sh.

FILES TOUCHED
- client/src/App.tsx
- client/src/styles.css
- db/schema.ts
- server/index.ts
- server/services/email.ts
- server/modules/password-reset/routes.ts (new)
- db/migrations/0029_password_reset_codes.sql (new)

Rollback source backups are created under backup/forgot-password-v57/.

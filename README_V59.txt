ADIL ACADEMY — CCO MAIN PAY ID 48H EMAIL + IP REUSE v59
UPDATE ONLY — DOES NOT REPLACE THE PROJECT

Requested rule
--------------
A CCO Main Pay ID must NOT become unusable after the first step/attempt.
It remains usable until its original 48-hour expiry, but only for:
  • the same intended email address, and
  • the same public IP address that first uses/validates the Pay ID.

What v59 changes
----------------
1. Removes the old "claimedAt means permanently consumed" behavior from CCO Main validation.
2. First validation/use binds the Pay ID to a SHA-256 hash of the public IP.
3. Same Pay ID can be validated/retried from that IP until expiresAt.
4. Email must still exactly match intendedEmail.
5. If application creation succeeded but proof upload failed, resubmission reuses the SAME application/account and issues a fresh upload token — no duplicate CN/user/application.
6. If proof is already submitted / under review, duplicate application creation is blocked with a clear status message rather than "invalid/used".
7. Raw IP is NOT stored; only its SHA-256 hash is stored.
8. CCO Main Pay ID email/admin text is updated to explain the 48-hour reuse rule.

Important network behavior
--------------------------
The lock is based on PUBLIC IP, not a hardware device ID. If the user switches Wi-Fi/mobile data, uses a VPN, or their carrier changes their public IP, the system will treat it as a different IP and reject the Pay ID. This is the requested security rule.

Files modified
--------------
• server/modules/cco-main/routes.ts
• db/schema.ts
• server/services/email.ts
• client/src/App.tsx
• db/migrations/0031_cco_main_pay_id_ip_binding.sql (new)

Not changed
-----------
• Student course Pay ID flow
• CCO approval / OTP logic
• Payment review
• Network/CN numbering rules
• Revision / Training / Zoom
• Login / Forgot Password
• Commission system

Install on Replit preview/dev
-----------------------------
./INSTALL_CCO_MAIN_PAYID_REUSE_V59.sh

Production DB (only after preview test)
---------------------------------------
./APPLY_PRODUCTION_DB_V59.sh

Rollback source backups
-----------------------
backup/cco-main-payid-reuse-v59/

The production migration only adds one nullable text column: cco_main_pay_ids.bound_ip_hash.

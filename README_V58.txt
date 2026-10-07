ADIL ACADEMY — Student Training Registration Unlock v58
UPDATE ONLY

WHAT CHANGES
- Published Student Training video titles/descriptions remain visible on the public Getting Started page.
- Before registration/login, every published video is shown as LOCKED.
- Video provider / YouTube or Vimeo ID is NOT returned by the public API.
- After a registered Student account logs in, all currently published Student Training videos unlock automatically.
- Existing Consultant accounts are also treated as already-registered Academy accounts and retain access.
- Draft/unpublished Student Training videos remain hidden from the public list and from registered playback.
- Admin Publish / Unpublish / Edit / Delete / Reorder remains unchanged.
- CCO Training is not changed.
- Course payment, course activation, normal course progress, Revision, Zoom, consultant network and commissions are not changed.

IMPORTANT ACCESS RULE
Registration unlock means an existing registered account must be authenticated (logged in). Payment/full-course activation is NOT required for Student Training video playback.

DATABASE
No database migration is required.

INSTALL
Upload this ZIP to the Replit workspace, unzip it and run:
  ./INSTALL_STUDENT_TRAINING_REGISTER_LOCK_V58.sh

The installer creates a timestamped backup and runs npm run check + npm run build.

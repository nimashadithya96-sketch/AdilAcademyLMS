Adil Academy v25 — Course Cover Image Fix + Remove Option

Changes:
- Public course card and Course Details modal now load images through the secure course thumbnail API.
- Cache-busting is added so a newly changed cover appears immediately.
- Admin course editor now includes Remove cover photo.
- Replacing/removing a cover also attempts to clean the old App Storage object.
- Draft course covers can display in the Admin editor.
- No database migration is required.

ADIL ACADEMY - LOGO UPDATE ONLY

Upload this ZIP to the Replit project root and run:

cd ~/workspace && unzip -o Adil_Academy_Logo_Update_ONLY.zip && node apply-logo-update.mjs && { pkill -f '[s]erver/index.ts' 2>/dev/null || true; } && npm run dev

This package only adds the logo asset and patches the existing Logo component/styles.
Backups of App.tsx and styles.css are created automatically.

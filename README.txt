ADIL ACADEMY — v45 PROJECT EXPORT HELPER

Purpose:
Create a clean ZIP of the CURRENT Replit LMS source so the Revision Manager v45 update can be built safely against the exact project you are running.

How to use:
1. Upload this helper ZIP to the main Replit project folder (~/workspace).
2. Extract it.
3. In Replit Shell run:
   bash EXPORT_CURRENT_PROJECT_FOR_V45.sh
4. It will create:
   Adil_Academy_Current_Project_For_v45.zip
5. Download that generated ZIP from Replit and upload it to ChatGPT.

Important:
- .env / secrets are excluded.
- node_modules, build output, logs, local DB files and backups are excluded.
- This helper DOES NOT modify your LMS code.

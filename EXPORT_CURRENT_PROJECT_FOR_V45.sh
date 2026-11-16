#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ROOT="${PWD}"
OUT="${ROOT}/Adil_Academy_Current_Project_For_v45.zip"

echo "ADIL ACADEMY — Current Project Export for v45"
echo "Root: $ROOT"
echo ""

if [ ! -f "package.json" ]; then
  echo "❌ package.json not found."
  echo "Place these helper files in the main project folder (~/workspace) and run again."
  exit 1
fi

rm -f "$OUT"

python3 - <<'PY'
from pathlib import Path
import zipfile

root = Path.cwd()
out = root / "Adil_Academy_Current_Project_For_v45.zip"

skip_dirs = {
    "node_modules", ".git", "dist", "dist-server", ".cache", ".vite",
    "coverage", "backup", ".upm", "__pycache__"
}
skip_files_exact = {
    ".env", ".env.local", ".env.development", ".env.production"
}
skip_suffixes = {".log", ".sqlite", ".db", ".pem", ".key", ".crt"}

include_top = {
    "client", "server", "db", "shared", "migrations", "drizzle", "jobs",
    "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
    "vitest.config.ts", "drizzle.config.ts", "replit.nix", ".replit"
}

def secret_like(filename: str) -> bool:
    n = filename.lower()
    if filename in skip_files_exact:
        return True
    markers = ["credentials", "private_key", "service-account", "service_account", "api-key"]
    return any(m in n for m in markers) and Path(filename).suffix.lower() in {".json",".txt",".pem",".key",".env"}

files = []
for p in root.rglob("*"):
    if not p.is_file():
        continue
    rel = p.relative_to(root)
    if rel.name == out.name:
        continue
    if any(part in skip_dirs for part in rel.parts):
        continue
    if rel.name in skip_files_exact or secret_like(rel.name):
        continue
    if p.suffix.lower() in skip_suffixes:
        continue

    top = rel.parts[0]
    if top not in include_top:
        if len(rel.parts) == 1 and (
            rel.name.startswith("vite") or
            rel.name.startswith("tsconfig") or
            rel.name.startswith("drizzle") or
            rel.suffix.lower() in {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"}
        ):
            pass
        else:
            continue

    files.append((p, rel))

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p, rel in files:
        z.write(p, rel.as_posix())

print(f"✅ Created: {out.name}")
print(f"Files included: {len(files)}")
print(f"Size: {out.stat().st_size/1024/1024:.2f} MB")
print("")
print("Security: .env, database files, private keys, logs, node_modules, dist and backups were excluded.")
PY

echo ""
echo "✅ DONE"
echo "Now upload this file to ChatGPT:"
echo "Adil_Academy_Current_Project_For_v45.zip"

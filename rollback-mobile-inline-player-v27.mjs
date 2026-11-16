import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
for (const rel of ['client/src/App.tsx','client/src/styles.css']) {
  const full = path.join(root, rel);
  const dir = path.dirname(full);
  const base = path.basename(full);
  const backups = fs.readdirSync(dir)
    .filter(name => name.startsWith(`${base}.before-mobile-inline-`) && name.endsWith('.bak'))
    .sort();
  if (!backups.length) {
    console.error(`❌ No mobile-inline backup found for ${rel}`);
    process.exitCode = 1;
    continue;
  }
  const latest = backups[backups.length - 1];
  fs.copyFileSync(path.join(dir, latest), full);
  console.log(`✅ Restored ${rel} from ${latest}`);
}

#!/usr/bin/env node
/**
 * Build Advisor L7 lore index from 斯诺德世界观架构.docx.
 * Delegates to scripts/sync_worldview_help.py --lore-only (shared classify/chunk rules).
 *
 * Run: node scripts/build-advisor-lore.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PY = path.join(ROOT, 'scripts', 'sync_worldview_help.py');
const OUT = path.join(ROOT, 'advisor', 'lore', 'index.json');

const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [PY, '--lore-only'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) {
  console.error('build-advisor-lore failed');
  process.exit(r.status || 1);
}
if (!fs.existsSync(OUT)) {
  console.error('missing output:', OUT);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
console.log(`OK L7 lore: ${data.meta?.chunkCount ?? data.chunks?.length ?? 0} chunks → advisor/lore/index.json`);

// build-mobile-packages.mjs
// Build mobile resource packages for the Android shell app.
// Output: dist_mobile/core-<version>.zip, poker-<version>.zip, version.json
// Usage: node scripts/build-mobile-packages.mjs [--base URL] [--version X]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist_mobile');
const SNODE = '\u65af\u8bfa\u5fb7\u8dd1\u56e2'; // ?????
const JOBS = '\u804c\u4e1a\u9875'; // ???
const POKER_SRC = path.join(ROOT, 'electron-app', 'poker-game');

// ---------- minimal ZIP writer (UTF-8 names, deflate) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
function writeZip(files, outPath) {
  // files: [{ name, data }]
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = dosDateTime();
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const comp = zlib.deflateRawSync(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);          // version needed
    lh.writeUInt16LE(0x0800, 6);      // UTF-8 flag
    lh.writeUInt16LE(8, 8);           // deflate
    lh.writeUInt16LE(now.time, 10);
    lh.writeUInt16LE(now.date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    chunks.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(now.time, 12);
    ch.writeUInt16LE(now.date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(0, 32);          // external attrs
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  fs.writeFileSync(outPath, Buffer.concat([...chunks, ...central, eocd]));
}

// ---------- collect files ----------
function collectDir(absDir, prefix) {
  const out = [];
  if (!fs.existsSync(absDir)) return out;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.includes('_backup_')) continue;
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        walk(full);
      } else {
        if (ent.name.includes('_backup_')) continue;
        if (ent.name.endsWith('.bat')) continue;
        if (ent.name === 'verify.html' || ent.name === 'tests.html') continue;
        const rel = path.relative(absDir, full).split(path.sep).join('/');
        out.push({ name: prefix + rel, data: fs.readFileSync(full) });
      }
    }
  };
  walk(absDir);
  return out;
}

// ---------- bug-report injection (same rule as web deploy) ----------
function injectBugReport(files) {
  const SCRIPT = '<script src="/bug-report.js"></script>';
  for (const f of files) {
    if (!f.name.endsWith('.html')) continue;
    let t = f.data.toString('utf8');
    t = t.replace(/src="bug-report\.js"/g, 'src="/bug-report.js"');
    if (!t.includes('bug-report.js')) {
      t = t.replace(/<\/body>/i, SCRIPT + '\n</body>');
    }
    f.data = Buffer.from(t, 'utf8');
  }
}


// ---------- mobile advisor entry injection ----------
function injectMobileEntry(files, apiBase) {
  for (const f of files) {
    if (!f.name.endsWith('.html')) continue;
    let t = f.data.toString('utf8');
    const inSN = f.name.includes(`${SNODE}/`);
    const inJobs = f.name.includes(`${JOBS}/`);
    const src = inSN
      ? 'advisor-mobile-entry.js'
      : inJobs
        ? `../${SNODE}/advisor-mobile-entry.js`
        : `${SNODE}/advisor-mobile-entry.js`;
    if (!t.includes('advisor-mobile-entry.js')) {
      t = t.replace(/<\/body>/i, `<script src="${src}"></script>\n</body>`);
    }
    if (apiBase && !t.includes('SNODE_ADVISOR_API')) {
      const base = apiBase.replace(/\/+$/, '');
      t = t.replace(/<\/body>/i, `<script>window.SNODE_ADVISOR_API = window.SNODE_ADVISOR_API || "${base}";</script>\n</body>`);
    }
    if (apiBase && f.name.endsWith(`${SNODE}/顾问.html`)) {
      t = t.split('__ADVISOR_API_BASE__').join(apiBase.replace(/\/+$/, ''));
    }
    f.data = Buffer.from(t, 'utf8');
  }
}

// ---------- reference integrity check ----------
function checkReferences(files) {
  const names = new Set(files.map((f) => f.name));
  const issues = [];
  for (const f of files) {
    if (!f.name.endsWith('.html')) continue;
    const t = f.data.toString('utf8');
    const baseDir = f.name.includes('/') ? f.name.slice(0, f.name.lastIndexOf('/')) : '';
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(t))) {
      let ref = m[1];
      if (!ref || ref.includes("'") || ref.includes('+') || ref.startsWith('#') || ref.startsWith('http:') || ref.startsWith('https:') ||
          ref.startsWith('//') || ref.startsWith('mailto:') || ref.startsWith('tel:') ||
          ref.startsWith('data:') || ref.startsWith('blob:') || ref.startsWith('javascript:')) continue;
      try { ref = decodeURIComponent(ref); } catch { /* keep raw */ }
      const parts = ref.split(/[?#]/)[0];
      if (!parts) continue;
      const segs = [];
      if (parts.startsWith('/')) {
        segs.push(...parts.slice(1).split('/'));
      } else {
        if (baseDir) segs.push(...baseDir.split('/'));
        for (const p of parts.split('/')) {
          if (p === '' || p === '.') continue;
          if (p === '..') segs.pop();
          else segs.push(p);
        }
      }
      const target = segs.join('/');
      if (!names.has(target)) {
        issues.push(`${f.name} -> ${ref} (missing: ${target})`);
      }
    }
  }
  return issues;
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  const base = (() => {
    const i = args.indexOf('--base');
    return i >= 0 ? args[i + 1] : null;
  })();
  const apiBase = (() => {
    const i = args.indexOf('--api-base');
    return i >= 0 ? args[i + 1] : (process.env.ADVISOR_API_BASE || '');
  })();
  const verArg = (() => {
    const i = args.indexOf('--version');
    return i >= 0 ? args[i + 1] : null;
  })();
  const version = verArg || process.env.MOBILE_VERSION ||
    JSON.parse(fs.readFileSync(path.join(ROOT, 'electron-app', 'package.json'), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Invalid version:', version);
    process.exit(1);
  }

  const core = [];
  core.push({ name: 'index.html', data: fs.readFileSync(path.join(ROOT, 'index.html')) });
  core.push(...collectDir(path.join(ROOT, SNODE), SNODE + '/'));
  core.push(...collectDir(path.join(ROOT, JOBS), JOBS + '/'));
  core.push({ name: 'bug-report.js', data: fs.readFileSync(path.join(ROOT, 'bug-report.js')) });
  injectBugReport(core);
  injectMobileEntry(core, apiBase);
  const poker = collectDir(POKER_SRC, 'poker-game/');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const coreZip = path.join(OUT_DIR, `core-${version}.zip`);
  const pokerZip = path.join(OUT_DIR, `poker-${version}.zip`);
  writeZip(core, coreZip);
  writeZip(poker, pokerZip);

  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const pkgs = {};
  const def = (key, zipPath) => {
    const name = path.basename(zipPath);
    const url = base ? `${base.replace(/\/+$/, '')}/mobile/packages/${version}/${name}` : `__URL_${key}__`;
    pkgs[key] = { url, sha256: sha(zipPath), size: fs.statSync(zipPath).size };
  };
  def('core', coreZip);
  def('poker', pokerZip);

  const manifest = {
    version,
    publishedAt: new Date().toISOString(),
    packages: pkgs,
    apk: {
      version: null,
      url: base ? `${base.replace(/\/+$/, '')}/mobile/apk/Snode-RPG-${version}.apk` : '__URL_apk__',
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'version.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const coreIssues = checkReferences(core);
  const pokerIssues = checkReferences(poker);
  console.log(`version: ${version}`);
  console.log(`core: ${core.length} files, ${(fs.statSync(coreZip).size / 1e6).toFixed(1)} MB`);
  console.log(`poker: ${poker.length} files, ${(fs.statSync(pokerZip).size / 1e6).toFixed(1)} MB`);
  if (coreIssues.length || pokerIssues.length) {
    console.warn('--- missing references ---');
    for (const i of coreIssues.slice(0, 30)) console.warn('  [core]', i);
    for (const i of pokerIssues.slice(0, 30)) console.warn('  [poker]', i);
  } else {
    console.log('reference check: OK');
  }
}

main();

import fs from 'node:fs';
import path from 'node:path';
/** 职业专长结构校验：class_features.json 与 18 个职业页的 chips/panels 必须一致，且正文中不得内嵌专长标题 */
const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, '职业页', '数据', 'class_features.json');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  PASS ' + n + (extra ? '  ' + extra : '')); } else { fail++; console.log('  FAIL ' + n + (extra ? '  ' + extra : '')); } };
if (!fs.existsSync(JSON_PATH)) { console.log('  FAIL 缺少 ' + JSON_PATH); process.exit(1); }
const cf = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const classes = cf.classes || {};
const names = Object.keys(classes);
ok('class_features.json 可解析', names.length >= 18, names.length + ' 个职业');
/* ① 正文内嵌标题检测 */
const embedded = [];
for (const [cls, v] of Object.entries(classes)) {
  for (const f of (v.features || [])) {
    for (const b of (f.body || [])) {
      const t = String(b.text || '').trim();
      if (!t || t.length > 12) continue;
      if (/[。，,；;：:！!？?、.…—-]$/.test(t)) continue;
      if (/^(D[1-6]|·|你|每|此|该|若)/.test(t)) continue;
      if (!/[\u4e00-\u9fa5]/.test(t)) continue;
      embedded.push(cls + '/' + f.name + ': 「' + t + '」');
    }
  }
}
ok('正文中无内嵌的专长标题', embedded.length === 0, embedded.slice(0, 5).join(' ; '));
/* ② 每个职业 features 条数合理（>=2） */
const thin = names.filter(c => ((classes[c].features || []).length) < 2);
ok('每个职业 features >= 2 条', thin.length === 0, thin.join(','));
/* ③ 职业页 chips/panels 与 JSON 逐条一致 */
const mismatch = [];
let checked = 0;
for (const cls of names) {
  const page = path.join(ROOT, '职业页', cls + '.html');
  if (!fs.existsSync(page)) { mismatch.push(cls + '(缺页面)'); continue; }
  const html = fs.readFileSync(page, 'utf8');
  const sec = html.indexOf('-class-features"');
  if (sec < 0) { mismatch.push(cls + '(无 class-features 区块)'); continue; }
  const end = html.indexOf('</section>', sec);
  const seg = html.slice(sec, end > sec ? end : sec + 20000);
  const chips = Array.from(seg.matchAll(/class-feature-chip[^>]*>([^<]+)</g)).map(m => m[1].trim());
  const panels = Array.from(seg.matchAll(/class-feature-panel[^>]*>\s*<h3>([^<]+)<\/h3>/g)).map(m => m[1].trim());
  const want = (classes[cls].features || []).map(f => String(f.name).trim());
  checked++;
  if (JSON.stringify(chips) !== JSON.stringify(want)) mismatch.push(cls + ' chips=' + JSON.stringify(chips) + ' ≠ ' + JSON.stringify(want));
  if (JSON.stringify(panels) !== JSON.stringify(want)) mismatch.push(cls + ' panels=' + JSON.stringify(panels) + ' ≠ ' + JSON.stringify(want));
}
ok('各职业页 chips/panels 与数据源逐条一致', mismatch.length === 0, mismatch.slice(0, 4).join(' ; '));
console.log('');
console.log('职业专长结构校验: ' + pass + 'P ' + fail + 'F（覆盖 ' + checked + ' 个职业页）');
process.exit(fail === 0 ? 0 : 1);
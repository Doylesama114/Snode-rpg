/**
 * 生成顾问抉择组数据：从 panel_data.js 的 CHOICE_GROUPS 导出，
 * 并补充面板中缺失、但规则书/用户已确认存在的抉择组（如德鲁伊定位术）。
 *
 * 用法：node scripts/build-advisor-choice-groups.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PANEL = path.join(ROOT, '\u65af\u8bfa\u5fb7\u8dd1\u56e2', 'panel_data.js');
const OUT = path.join(ROOT, 'advisor', 'chargen', 'choice_groups.json');

const text = fs.readFileSync(PANEL, 'utf8');
const start = text.indexOf('const CHOICE_GROUPS = [');
const end = text.indexOf('];', start);
if (start < 0 || end < 0) throw new Error('CHOICE_GROUPS not found in panel_data.js');
const arrText = text.slice(start + 'const CHOICE_GROUPS = '.length, end + 2);
// eslint-disable-next-line no-eval
const groups = new Function('return ' + arrText)();

const EXTRA = [
  {
    id: '\u5fb7\u9c81\u4f0a\u00b7\u661f\u8fb0\u4e09\u9636\u00b7\u5b9a\u4f4d\u672f',
    cls: '\u5fb7\u9c81\u4f0a',
    skills: ['\u7269\u4ef6\u5b9a\u4f4d\u672f', '\u751f\u7269\u5b9a\u4f4d\u672f'],
    max: 1,
    rule: '\u4ec5\u53ef\u9009\u62e9\u4e00\u9879\u4e60\u5f97',
    source: '\u7528\u6237\u786e\u8ba4 + \u89c4\u5219\u4e66\u6292\u62e9\u6807\u8bb0',
  },
];

const outGroups = groups.map((g, i) => ({
  id: g.marker || `group-${i + 1}`,
  cls: g.cls || '\u901a\u7528',
  skills: Array.isArray(g.skills) ? g.skills : [],
  max: Number(g.max) || 1,
  rule: g.rule || '\u4ec5\u53ef\u9009\u62e9\u4e00\u9879\u4e60\u5f97',
  source: 'panel_data.js CHOICE_GROUPS',
}));

const seen = new Set(outGroups.map((g) => (g.cls || '') + '\u0000' + g.skills.join('\u0000')));
for (const g of EXTRA) {
  const key = (g.cls || '') + '\u0000' + g.skills.join('\u0000');
  if (!seen.has(key)) {
    outGroups.push(g);
    seen.add(key);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      groups: outGroups,
    },
    null,
    2,
  ),
  'utf8',
);
console.log('choice_groups.json:', outGroups.length, 'groups');

// 同步把已知抉择组的 choicesFrom 补进技能索引（最小文本替换，避免整文件重排）
const JOBS = [
  { file: 'druid_index.json', id: 'd-skill-59', group: '\u5fb7\u9c81\u4f0a\u00b7\u661f\u8fb0\u4e09\u9636\u00b7\u5b9a\u4f4d\u672f' },
  { file: 'druid_index.json', id: 'd-skill-60', group: '\u5fb7\u9c81\u4f0a\u00b7\u661f\u8fb0\u4e09\u9636\u00b7\u5b9a\u4f4d\u672f' },
  { file: 'mage_index.json', id: 'm-skill-3-2-7', group: '\u6cd5\u5e08\u00b7\u9884\u8a00\u4e8c\u9636\u00b7\u5b9a\u4f4d\u672f' },
  { file: 'mage_index.json', id: 'm-skill-3-2-8', group: '\u6cd5\u5e08\u00b7\u9884\u8a00\u4e8c\u9636\u00b7\u5b9a\u4f4d\u672f' },
];
for (const { file, id, group } of JOBS) {
  const p = path.join(ROOT, 'advisor', 'skills', file);
  let t = fs.readFileSync(p, 'utf8');
  const re = new RegExp(`("id":\\s*"${id}"[\\s\\S]{0,1200}?)"choicesFrom":\\s*""`);
  if (!re.test(t)) {
    console.warn(`skip ${file} ${id}: pattern not found`);
    continue;
  }
  t = t.replace(re, (m, p1) => `${p1}"choicesFrom": "${group}"`);
  fs.writeFileSync(p, t, 'utf8');
  console.log(`choicesFrom patched: ${file} ${id}`);
}

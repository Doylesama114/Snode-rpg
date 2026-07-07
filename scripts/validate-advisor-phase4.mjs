#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 4 mage tips library.
 * Run: node scripts/validate-advisor-phase4.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const tipsDoc = loadJson('advisor/combos/mage_tips.json');
const mageNames = new Set(loadJson('advisor/skills/mage_index.json').skills.map((s) => s.name));
const universalNames = new Set(loadJson('advisor/skills/universal_index.json').skills.map((s) => s.name));
const allNames = new Set([...mageNames, ...universalNames]);

ok('mage_tips parses', !!tipsDoc.tips?.length);
ok('tips >= 18', tipsDoc.tips.length >= 18, `got ${tipsDoc.tips.length}`);
ok('tips = 24', tipsDoc.tips.length === 24);
ok('tip id 唯一', tipsDoc.tips.length === new Set(tipsDoc.tips.map((t) => t.id)).size);
ok('meta.type = tips', tipsDoc.meta?.type === 'tips');
ok('user_provided = 18', tipsDoc.meta.userProvidedCount === 18);
ok('supplement = 6', tipsDoc.meta.supplementCount === 6);

const required = ['id', 'title', 'kind', 'confidence', 'summary', 'detail', 'searchText'];
const badShape = tipsDoc.tips.filter((t) => required.some((k) => !t[k]));
ok('tip 字段完整', badShape.length === 0);

const kinds = new Set(['combat_rule', 'tactic', 'style_guide']);
ok('kind 合法', tipsDoc.tips.every((t) => kinds.has(t.kind)));

function checkSkillNames(tips, label) {
  const unknown = [];
  for (const t of tips) {
    for (const name of t.relatedSkills || []) {
      if (!allNames.has(name)) unknown.push(`${t.id}:${name}`);
    }
  }
  ok(`${label} 技能名零胡编`, unknown.length === 0, unknown.slice(0, 3).join('; '));
}

checkSkillNames(tipsDoc.tips, 'tips');

const t13 = tipsDoc.tips.find((t) => t.id === 'tip-mage-T13');
ok('T13 咒法风格', t13?.style === '咒法');
ok('T13 含强韧召唤', t13?.relatedSkills?.includes('强韧召唤'));

const t12 = tipsDoc.tips.find((t) => t.id === 'tip-mage-T12');
ok('T12 塑能+火球炎爆', t12?.style === '塑能' && t12.relatedSkills.includes('火球术'));

ok('无旧 mage_starter.json', !exists('advisor/combos/mage_starter.json'));
ok('无 combos 字段', tipsDoc.combos === undefined);
ok('rules_summary 含小贴士', loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.startsWith('L5 法师小贴士')));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 4 validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);

// 校验：学习面板不再有阶位门禁 / 抉择门禁（v1.0.8092）
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const src = fs.readFileSync(path.join(root, '斯诺德跑团', 'panel_engine.js'), 'utf8');

function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, i = src.indexOf('{', start);
  const from = src.indexOf('(', start);
  let paren = 0;
  for (let j = from; j < i; j++) { if (src[j] === '(') paren++; else if (src[j] === ')') paren--; }
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}

const code = [grab('normalizeTierName'), grab('choiceOptionName'), grab('isTierUnlocked'), grab('getChoiceGroupStatus')].join('\n');
const state = { unlocked_tiers: ['一阶', '二阶'], talent_tree: [] };
const sandbox = new Function('state', code + '\nreturn { isTierUnlocked, getChoiceGroupStatus, normalizeTierName };')(state);

console.log('=== 阶位门禁 ===');
for (const t of ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶', '七阶', '通用']) {
  ok(t + ' 可通过', sandbox.isTierUnlocked(t) === true);
}
ok('未解锁列表不再影响（清空后三阶仍可）', (() => { state.unlocked_tiers = []; return sandbox.isTierUnlocked('三阶') === true; })());

console.log('=== 抉择门禁 ===');
const group = { marker: '抉择A', cls: '通用', skills: ['凝聚力量', '敏捷身姿'], max: 1 };
state.talent_tree = [{ n: '凝聚力量', src: '通用' }];
const st = sandbox.getChoiceGroupStatus(group, '通用');
ok('已选 1 项时 count=1', st.count === 1, 'count=' + st.count);
ok('已选满后不再 full（full=false）', st.full === false);
ok('max 仍保留用于显示', st.max === 1);
state.talent_tree = [];
const st2 = sandbox.getChoiceGroupStatus(group, '通用');
ok('未选时 full=false', st2.full === false, 'count=' + st2.count);

console.log('');
console.log('面板解锁校验: ' + pass + 'P ' + fail + 'F');
process.exit(fail ? 1 : 0);

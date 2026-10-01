import fs from 'node:fs';
import path from 'node:path';
/** 技能索引校验：独立枚举数据源 + 内容级可达性（不复用生成器的来源列表） */
const ROOT = process.cwd();
const D = path.join(ROOT, '职业页', '数据');
const IDX = path.join(ROOT, '斯诺德跑团', 'skill_index.js');
if (!fs.existsSync(IDX)) { console.log('  FAIL 缺少 斯诺德跑团/skill_index.js'); process.exit(1); }
const src = fs.readFileSync(IDX, 'utf8');
const json = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
let I;
try { I = JSON.parse(json); } catch (e) { console.log('  FAIL 索引 JSON 解析失败: ' + e.message.slice(0, 80)); process.exit(1); }
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  PASS ' + n + (extra ? '  ' + extra : '')); } else { fail++; console.log('  FAIL ' + n + (extra ? '  ' + extra : '')); } };
/* ① 独立枚举数据源 */
const CLASSES = ['召唤师','吟游诗人','圣骑士','奇械师','守望者','德鲁伊','战士','战舞者','术士','武僧','法师','游荡者','牧师','猎人','萨满祭司','蛮斗士','谋士','魔契师'];
let expect = 0, missing = [], identityMissing = [], staleFields = [];
const detailFail = [];
for (const cls of CLASSES.concat(['通用天赋树', '特殊专长', '牧师·神圣领域'])) {
  const p = path.join(D, cls + '.json');
  if (!fs.existsSync(p)) { missing.push(cls + '(文件缺失)'); continue; }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  let arr = Array.isArray(j) ? j : (j.skills || j.feats || []);
  if (cls === '牧师·神圣领域') { arr = []; const doms = j.domains || {}; for (const dk in doms) { const dv = doms[dk] || {}; (dv.skills || []).forEach((s) => arr.push(s)); } }
  const names = arr.filter((s) => s && s.name).map((s) => s.name);
  expect += names.length;
  const idxNames = new Set((I.rows || []).filter((r) => r[2] === (cls === '通用天赋树' ? '通用' : cls)).map((r) => r[0]));
  for(const s of arr){
    if(!s||!s.name)continue;
    const srcClass=cls==='通用天赋树'?'通用':cls;
    const exact=(I.rows||[]).filter(r=>r[0]===s.name&&r[1]===(s.id||'')&&r[2]===srcClass);
    if(exact.length!==1)identityMissing.push(srcClass+'/'+s.name+'/'+s.id);
    else if(exact[0][6]!==String(s.tier||'')||(cls!=='牧师·神圣领域'&&exact[0][5]!==String(s.style||'')))staleFields.push(srcClass+'/'+s.name);
  }
  const miss = names.filter((n) => !idxNames.has(n));
  if (miss.length) missing.push(cls + ':' + miss.length + ' 条未入索引');
  /* 内容级可达性：索引标记 hasDetail=1 的条目，源文件必须有实际内容 */
  for (const s of arr) {
    if (!s || !s.name) continue;
    const row = (I.rows || []).find((r) => r[0] === s.name && r[2] === (cls === '通用天赋树' ? '通用' : cls));
    if (!row || !row[8]) continue;
    const dsc = s.description;
    const hasContent = (typeof dsc === 'string' && dsc.trim().length > 0) || (Array.isArray(dsc) && dsc.length > 0) || (s.fields && Object.keys(s.fields).length) || (Array.isArray(s.level_upgrades) && s.level_upgrades.length) || (Array.isArray(s.effects) && s.effects.length > 0);
    if (!hasContent) detailFail.push(cls + '/' + s.name);
  }
}
ok('独立枚举：条目覆盖', missing.length === 0, '源 ' + expect + ' 条 · 索引 ' + (I.rows || []).length + ' 条' + (missing.length ? ' · 缺: ' + missing.slice(0, 4).join('; ') : ''));
ok('来源+ID+名称逐条覆盖',identityMissing.length===0,identityMissing.slice(0,3).join('; '));
ok('阶位与风格符合当前数据',staleFields.length===0,staleFields.slice(0,3).join('; '));
ok('内容级可达性', detailFail.length === 0, detailFail.length ? '无内容: ' + detailFail.slice(0, 4).join('; ') : 'hasDetail 条目均有实际内容');
/* ② byKey 唯一 + 重号候选保留 */
const keys = Object.keys(I.byKey || {});
const rowKeys=(I.rows||[]).filter(r=>r[1]).map(r=>r[2]+'\t'+r[1]);
const dupKeys=rowKeys.length!==new Set(rowKeys).size||keys.length!==rowKeys.length||I.rows.some((r,i)=>r[1]&&I.byKey[r[2]+'\t'+r[1]]!==i);
ok('byKey 无冲突', !dupKeys, keys.length + ' 个键');
const dupIds = Object.entries(I.byId || {}).filter(([, v]) => v.length > 1);
ok('重号 ID 候选保留', dupIds.length === 2, '检测到 ' + dupIds.length + ' 组: ' + dupIds.map(([k, v]) => k + '(' + v.length + ')').join(' '));
/* ③ 同名候选保留 */
const dupNames = Object.entries(I.byName || {}).filter(([, v]) => v.length > 1);
ok('所有名称/ID/起始候选索引可回溯',I.rows.every((r,i)=>
  (I.byName[r[0]]||[]).includes(i)&&(!r[1]||(I.byId[r[1]]||[]).includes(i))&&(!r[7]||(I.starts[r[0]]||[]).includes(i))));
ok('同名候选保留', dupNames.length >= 260, dupNames.length + ' 组同名');
/* ④ 起始特性多候选 */
const st = Object.entries(I.starts || {});
ok('起始特性索引', st.length >= 60, st.length + ' 个（多候选 ' + st.filter(([, v]) => v.length > 1).length + ' 个）');
/* ⑤ 载荷体积 */
const kb = Math.round(fs.statSync(IDX).size / 1024);
ok('索引体积可接受', kb < 600, kb + ' KB');
console.log('');
console.log('技能索引校验: ' + pass + 'P ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

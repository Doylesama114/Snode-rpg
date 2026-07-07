#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 5 retrieval against 15-question spot-check bank.
 * Run: node scripts/validate-advisor-phase5.mjs
 */
import { retrieve } from './advisor-retrieve.mjs';

const CHECKS = [
  {
    id: 1,
    query: '我想玩输出很猛的法师，种族和背景怎么选？',
    layers: ['L1', 'L0'],
    anyName: ['侏儒', '魔裔', '人鱼', '智力'],
    minRaces: 1,
    minBackgrounds: 1,
  },
  {
    id: 2,
    query: '塑能流派 1～3 级优先学什么？',
    layers: ['L2-mage'],
    anyName: ['塑能箭', '魔法飞弹', '寒冰箭', '火焰箭'],
    style: '塑能',
  },
  {
    id: 3,
    query: '魔法飞弹和寒冰箭能一起学吗？',
    layers: ['L2-mage'],
    anyName: ['魔法飞弹', '寒冰箭'],
    fieldIncludes: [{ path: 'L2-mage', key: 'choicesFrom', substr: '寒冰箭' }],
  },
  {
    id: 4,
    query: '4 级特殊专长选什么适合输出法师？',
    layers: ['L4', 'L0'],
    minFeats: 3,
    anyName: ['法术射手', '法术精准', '强化属性'],
  },
  {
    id: 5,
    query: '5 级该关注什么系统奖励？',
    layers: ['L3', 'L0'],
    anyName: ['进阶', '冰霜法师', '火焰法师', '开启'],
    level: 5,
  },
  {
    id: 6,
    query: '智力 14 的法师能走冰霜法师吗？',
    layers: ['L3'],
    advName: '冰霜法师',
    eligibility: { eligible: false, gapKey: '智力', gapValue: 1 },
  },
  {
    id: 7,
    query: '7 级法师能兼职什么？',
    layers: ['L0'],
    compatIncludes: ['吟游诗人', '魔契师', '奇械师'],
    compatExcludes: ['牧师'],
  },
  {
    id: 8,
    query: '通用天赋树里有什么适合法师的输出向天赋？',
    layers: ['L2-universal'],
    minUniversal: 5,
    anyName: ['法术精准', '法术精通', '极速施法'],
  },
  {
    id: 9,
    query: '8 级第二次专长推荐？',
    layers: ['L4', 'L0'],
    minFeats: 3,
    level: 8,
  },
  {
    id: 10,
    query: '咒法风格和塑能风格怎么选？',
    layers: ['L2-mage', 'L1'],
    styles: ['咒法', '塑能'],
  },
  {
    id: 11,
    query: '标识不够能学带紫色标识的技能吗？',
    layers: ['L0'],
    spMarks: true,
  },
  {
    id: 12,
    query: '近卫进阶适合法师吗？',
    layers: ['L3'],
    advName: '近卫',
    scope: 'universal',
  },
  {
    id: 13,
    query: '有没有塑能相关的战斗技巧或小贴士？',
    layers: ['L5', 'L2-mage'],
    anyName: ['火球术', '塑能', '炎爆术', 'tip-mage-T12'],
    minTips: 1,
  },
  {
    id: 14,
    query: '主职 3 级解锁什么？',
    layers: ['L0'],
    tier3: true,
  },
  {
    id: 15,
    query: '法师兼职奇械师要什么条件？',
    layers: ['L0', 'L1'],
    anyName: ['智力', '15', '奇械师', '逻辑'],
  },
];

function getSkillByName(result, name) {
  return (result.results['L2-mage'] || []).find((s) => s.name === name);
}

function runCheck(spec) {
  const result = retrieve(spec.query);
  const errors = [];

  for (const layer of spec.layers) {
    if (!result.layersHit.includes(layer)) {
      errors.push(`缺少层 ${layer}（命中: ${result.layersHit.join(',')}）`);
    }
  }

  const allText = JSON.stringify(result.results);

  if (spec.anyName) {
    const hit = spec.anyName.some((n) => allText.includes(n));
    if (!hit) errors.push(`未命中名称: ${spec.anyName.join('|')}`);
  }

  if (spec.minRaces) {
    const n = result.results.L1?.races?.length || 0;
    if (n < spec.minRaces) errors.push(`种族检索不足: ${n}`);
  }

  if (spec.minBackgrounds) {
    const n = result.results.L1?.backgrounds?.length || 0;
    if (n < spec.minBackgrounds) errors.push(`背景检索不足: ${n}`);
  }

  if (spec.style) {
    const skills = result.results['L2-mage'] || [];
    if (!skills.some((s) => s.style === spec.style || s.name?.includes('塑能'))) {
      errors.push(`未命中风格 ${spec.style}`);
    }
  }

  if (spec.fieldIncludes) {
    for (const f of spec.fieldIncludes) {
      const list = result.results[f.path] || [];
      const found = list.some((item) => String(item[f.key] || '').includes(f.substr));
      if (!found) errors.push(`字段 ${f.path}.${f.key} 未含 ${f.substr}`);
    }
  }

  if (spec.minFeats) {
    const n = result.results.L4?.length || 0;
    if (n < spec.minFeats) errors.push(`专长检索不足: ${n}`);
  }

  if (spec.minUniversal) {
    const n = result.results['L2-universal']?.length || 0;
    if (n < spec.minUniversal) errors.push(`通用天赋检索不足: ${n}`);
  }

  if (spec.level) {
    const l0 = result.results.L0;
    const hit = JSON.stringify(l0).includes(`"level":${spec.level}`) || JSON.stringify(l0).includes(`"level": ${spec.level}`);
    if (!hit && spec.id !== 14) {
      // level 5/8 may appear in milestones text
      if (!JSON.stringify(l0).includes(String(spec.level))) {
        errors.push(`未命中 ${spec.level} 级里程碑/等级行`);
      }
    }
  }

  if (spec.advName) {
    const adv = result.results.L3?.advancements?.find((a) => a.name === spec.advName);
    if (!adv) errors.push(`未命中进阶 ${spec.advName}`);
    if (spec.scope && adv?.scope !== spec.scope) errors.push(`进阶 scope 期望 ${spec.scope}`);
  }

  if (spec.eligibility) {
    const e = result.results.L3?.eligibility?.find((x) => x.advancementName === spec.advName);
    if (!e) errors.push('无 eligibility 结果');
    else {
      if (e.eligible !== spec.eligibility.eligible) errors.push(`eligible 期望 ${spec.eligibility.eligible}`);
      if (spec.eligibility.gapKey && e.gaps?.[spec.eligibility.gapKey] !== spec.eligibility.gapValue) {
        errors.push(`gaps.${spec.eligibility.gapKey} 期望 ${spec.eligibility.gapValue} 得 ${e.gaps?.[spec.eligibility.gapKey]}`);
      }
    }
  }

  if (spec.compatIncludes) {
    const blob = JSON.stringify(result.results.L0);
    for (const c of spec.compatIncludes) {
      if (!blob.includes(c)) errors.push(`兼职兼容列表未含 ${c}`);
    }
  }

  if (spec.compatExcludes) {
    const blob = JSON.stringify(result.results.L0);
    for (const c of spec.compatExcludes) {
      const mc = result.results.L0?.hits?.find((h) => h.type === 'multiclass_mage');
      if (mc?.compatibleSubclasses?.includes(c)) errors.push(`不应出现在兼容子职: ${c}`);
      if (mc?.incompatible?.includes(c)) { /* ok */ } else if (blob.includes(`"${c}"`) && spec.compatExcludes.includes(c)) {
        // only fail if in compatible list
      }
    }
    const mc = result.results.L0?.hits?.find((h) => h.type === 'multiclass_mage');
    if (mc && spec.compatExcludes.includes('牧师') && !mc.incompatible?.includes('牧师')) {
      errors.push('牧师应在 incompatible 列表');
    }
  }

  if (spec.spMarks) {
    const has = result.results.L0?.hits?.some((h) => h.type === 'sp_marks');
    if (!has) errors.push('未检索 sp_marks 规则');
  }

  if (spec.styles) {
    const l1 = JSON.stringify(result.results.L1 || {});
    for (const s of spec.styles) {
      if (!l1.includes(s)) errors.push(`L1 未含风格 ${s}`);
    }
  }

  if (spec.minTips) {
    const n = result.results.L5?.length || 0;
    if (n < spec.minTips) errors.push(`小贴士检索不足: ${n}`);
  }

  if (spec.tier3) {
    const l0 = JSON.stringify(result.results.L0);
    if (!/三阶|tier.*3|"level":3/.test(l0)) errors.push('未命中三阶/3级解锁信息');
  }

  return { id: spec.id, query: spec.query, intent: result.intent, pass: errors.length === 0, errors };
}

const results = CHECKS.map(runCheck);
const failed = results.filter((r) => !r.pass);

console.log(`Phase 5 retrieval spot-check: ${results.length - failed.length}/${results.length} passed`);
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} Q${r.id} [${r.intent}] ${r.query.slice(0, 28)}${r.query.length > 28 ? '…' : ''}`);
  for (const e of r.errors) console.log(`    ${e}`);
}

if (failed.length) process.exit(1);

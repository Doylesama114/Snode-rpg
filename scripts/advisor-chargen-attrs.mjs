/**
 * Phase 4‴ / 5 — 购点分析与熟练↔属性关联
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeKeyAttrTargets,
  formatKeyAttrLabel,
  getClassProfile,
} from './advisor-chargen-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const POINT_BUY_TOTAL = 32;

export const ATTR_NAMES = [
  '力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运',
];

/** @type {Record<string, string>} */
let _skillAttrMap = null;

function loadSkillAttrMap() {
  if (_skillAttrMap) return _skillAttrMap;
  _skillAttrMap = {};
  try {
    const p = path.join(__dirname, '..', 'advisor', 'chargen', 'proficiencies.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [attr, skills] of Object.entries(data.byAttribute || {})) {
      for (const sk of skills) {
        if (sk === '豁免' || sk.endsWith('-自定义')) continue;
        const parent = sk.includes('-') ? sk.split('-')[0] : sk;
        if (!_skillAttrMap[sk]) _skillAttrMap[sk] = attr;
        if (!_skillAttrMap[parent]) _skillAttrMap[parent] = attr;
      }
    }
  } catch {
    _skillAttrMap = {
      专注: '体质', 调查: '智力', 逻辑: '智力', 奥秘: '智力', 知识: '智力',
      洞悉: '感知', 感悟: '感知', 聆听: '感知',
    };
  }
  return _skillAttrMap;
}

/** @deprecated use loadSkillAttrMap — kept for tests importing MAGE_SKILL_ATTR */
export const MAGE_SKILL_ATTR = loadSkillAttrMap();

export function calcAttrCost(v) {
  if (v <= 8) return 0;
  if (v <= 13) return v - 8;
  return 5 + (v - 13) * 2;
}

export function calcPointSpent(attrs) {
  if (!attrs) return 0;
  let t = 0;
  for (const an of ATTR_NAMES) {
    t += calcAttrCost(attrs[an] ?? 8);
  }
  return t;
}

export function skillPrimaryAttr(skillName) {
  if (!skillName) return null;
  const map = loadSkillAttrMap();
  if (skillName.includes('-')) {
    return map[skillName] || map[skillName.split('-')[0]] || null;
  }
  if (skillName.includes('·')) {
    return skillName.split('·')[0] || null;
  }
  return map[skillName] || null;
}

export function applyRaceBonuses(baseAttrs, raceBonuses) {
  const out = {};
  for (const an of ATTR_NAMES) {
    const base = baseAttrs?.[an] ?? 8;
    let bonus = 0;
    if (raceBonuses && raceBonuses[an] != null && raceBonuses[an] !== 'X') {
      bonus = typeof raceBonuses[an] === 'number' ? raceBonuses[an] : parseInt(raceBonuses[an], 10) || 0;
    }
    out[an] = base + bonus;
  }
  return out;
}

export function analyzePointBuy(char) {
  const attrs = char?.attrs || {};
  const spent = calcPointSpent(attrs);
  const raceBonuses = char?.raceAttrBonuses || {};
  const final = applyRaceBonuses(attrs, raceBonuses);
  const profile = getClassProfile(char?.className);
  const keyTargets = analyzeKeyAttrTargets(char, profile);
  const highlights = [];
  for (const an of ATTR_NAMES) {
    const base = attrs[an] ?? 8;
    if (base >= 14 || final[an] >= 15) {
      highlights.push({ attr: an, base, final: final[an] });
    }
  }
  return {
    spent,
    complete: spent === POINT_BUY_TOTAL,
    baseAttrs: attrs,
    finalAttrs: final,
    keyTargets,
    keyAttrLabel: formatKeyAttrLabel(char, profile),
    intFinal: final['智力'],
    intTargetMet: final['智力'] >= (profile.keyAttrTarget ?? 15),
    highlights,
    className: char?.className || null,
  };
}

export function analyzeSkillAttrSynergy(char, skillNames) {
  const pb = analyzePointBuy(char);
  const lines = [];
  for (const sk of skillNames || []) {
    if (!sk || sk.includes('魔法学派')) continue;
    const attr = skillPrimaryAttr(sk);
    if (!attr) continue;
    const final = pb.finalAttrs[attr] ?? 8;
    lines.push({
      skill: sk,
      attr,
      final,
      strong: final >= 14,
    });
  }
  return lines;
}

export function formatPointBuyContext(char) {
  const pb = analyzePointBuy(char);
  const lines = ['## 购点分析（只读）'];
  lines.push(`- 已花费购点：${pb.spent}/${POINT_BUY_TOTAL}${pb.complete ? '（已满）' : ''}`);
  const parts = ATTR_NAMES.map((an) => {
    const base = pb.baseAttrs[an] ?? 8;
    const fin = pb.finalAttrs[an];
    return `${an}购点${base}→含种族${fin}`;
  });
  lines.push(`- 属性：${parts.join('；')}`);
  const kt = pb.keyTargets;
  if (kt.attrs.length) {
    for (const row of kt.attrs) {
      lines.push(
        `- 关键属性·${row.attr}含种族：${row.final}${row.met ? `（达标≥${row.target}）` : `（未达${row.target}）`}`,
      );
    }
  } else {
    lines.push(`- 关键属性：${pb.keyAttrLabel || '（见创建页）'}`);
  }
  if (pb.highlights.length) {
    lines.push(`- 高属性：${pb.highlights.map((h) => `${h.attr}${h.final}`).join('、')}`);
  }
  return lines.join('\n');
}

export function formatSkillSynergyContext(char, skillNames) {
  const syn = analyzeSkillAttrSynergy(char, skillNames);
  if (!syn.length) return '';
  const lines = ['## 熟练↔属性关联（须用完整子项名，勿只写大类）'];
  for (const s of syn) {
    lines.push(
      `- ${s.skill} → ${s.attr} ${s.final}${s.strong ? '（高属性，检定会受益）' : ''}`,
    );
  }
  lines.push('- 若用户将某属性点得很高，须点出对应熟练的协同价值。');
  return lines.join('\n');
}

export function formatCharacterProfileContext(char) {
  const p = char?.characterProfile || char;
  const fields = [
    ['charName', '角色名'], ['gender', '性别'], ['age', '年龄'],
    ['height', '身高'], ['weight', '体重'], ['eye', '瞳色'],
    ['skin', '肤色'], ['hair', '发色'], ['story', '背景故事'],
    ['personality', '个性'], ['ideals', '理念'], ['bonds', '羁绊'], ['flaws', '缺陷'],
  ];
  const lines = ['## 角色形象与叙事（用户已填部分）'];
  let any = false;
  for (const [key, label] of fields) {
    const v = (p[key] || '').trim();
    if (v) {
      any = true;
      const preview = v.length > 120 ? `${v.slice(0, 120)}…` : v;
      lines.push(`- ${label}：${preview}`);
    }
  }
  if (!any) {
    lines.push('- （尚未填写）');
  } else {
    lines.push('- 顾问须对已有叙事/外貌/个性做简短评价，勿替用户改写。');
  }
  return lines.join('\n');
}

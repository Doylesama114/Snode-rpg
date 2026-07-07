/**
 * Phase 4″ — 车卡熟练账本（确定性分析，供顾问上下文与冒泡 warning）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAGE_SPEC_PROF = new Set(['奥法学者', '知识传承']);
const MAGE_CLASS_SKILL_POOL = [
  '专注', '调查', '逻辑', '奥秘', '知识', '洞悉', '感悟', '聆听',
];

/** @type {Record<string, string[]>} */
export const MAGE_FEATURE_TAGS = {
  塑能箭: ['输出', '元素伤害'],
  闪现术: ['位移', '生存'],
  预知梦: ['检定', '辅助'],
  法术护盾: ['生存', '防御'],
  魔法武器: ['增益', '附魔'],
  死灵弹: ['输出', '减益'],
  次级幻影: ['功能', '诡术'],
  次级变形术: ['控制', '惑控'],
};

function profCategory(name) {
  if (!name) return null;
  if (name.startsWith('奥秘') || name.startsWith('奥秘-')) return '奥秘';
  if (name.startsWith('知识') || name.startsWith('知识-')) return '知识';
  if (name === '逻辑' || name.startsWith('逻辑')) return '逻辑';
  if (name.includes('·')) {
    const parts = name.split('·');
    return profCategory(parts[parts.length - 1]);
  }
  return null;
}

function normalizeProfName(name) {
  if (!name || typeof name !== 'string') return null;
  const t = name.trim();
  if (!t) return null;
  if (t.includes('-')) return t;
  return t;
}

function addEntry(entries, name, source) {
  const n = normalizeProfName(name);
  if (!n) return;
  entries.push({ name: n, source, category: profCategory(n) });
}

function featNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map((f) => (typeof f === 'string' ? f : (f?.n || f?.name || ''))).filter(Boolean);
}

function collectSpecProfs(char, entries) {
  const specs = char?.specChoices || {};
  for (const specName of Object.keys(specs)) {
    if (specName === '魔法学派') {
      entries.push({
        name: '魔法学派（L1 能力已获得）',
        source: '专精·魔法学派',
        category: null,
        note: '对立学派与主修路线在角色面板后续配置，创建页不选',
      });
      continue;
    }
    if (!MAGE_SPEC_PROF.has(specName)) continue;
    const ch = specs[specName];
    const skill = ch?.skill || ch?.prof || null;
    if (skill) addEntry(entries, skill, `专精·${specName}`);
  }
  if (!specs['魔法学派'] && char?.className === '法师') {
    entries.push({
      name: '魔法学派（L1 能力已获得）',
      source: '专精·魔法学派',
      category: null,
      note: '对立学派与主修路线在角色面板后续配置，创建页不选',
    });
  }
}

function collectBgProfs(char, entries) {
  const bgProfs = char?.bgProfs?.skills;
  if (!bgProfs || typeof bgProfs !== 'object') return;
  for (const [cat, v] of Object.entries(bgProfs)) {
    if (cat === '_custom' && v && typeof v === 'object') {
      const label = v.attr && v.skill ? `${v.attr}·${v.skill}` : (v.skill || '');
      if (label) addEntry(entries, label, '背景·任选');
    } else if (Array.isArray(v)) {
      for (const sk of v) addEntry(entries, sk, `背景·${cat}`);
    }
  }
}

/**
 * @param {object} char — snowdChargen snapshot char
 * @param {{ step?: number }} options
 */
export function buildChargenLedger(char, options = {}) {
  const step = options.step ?? 0;
  const entries = [];

  if (char?.className === '法师') {
    collectSpecProfs(char, entries);
  }

  for (const sk of char?.selectedSkills || []) {
    addEntry(entries, sk, '职业·八选四');
  }

  if (char?.humanFreeSkill) {
    addEntry(entries, char.humanFreeSkill, '种族·人类中庸');
  }

  collectBgProfs(char, entries);

  const profNames = entries
    .map((e) => e.name)
    .filter((n) => n && !n.includes('魔法学派（'));

  const overlapWarnings = [];
  const seen = new Map();
  for (const e of entries) {
    if (!e.name || e.name.includes('魔法学派（')) continue;
    const key = e.name;
    if (seen.has(key)) {
      overlapWarnings.push({
        prof: key,
        sources: [seen.get(key), e.source],
        message: `「${key}」已从 ${seen.get(key)} 获得；再次选取合法但应用场景重叠，建议优先选不同熟练以拓宽用途。`,
      });
    } else {
      seen.set(key, e.source);
    }
  }

  const gate = { 奥秘: 0, 知识: 0, 逻辑: 0, total: 0, target: 6 };
  for (const e of entries) {
    if (e.category === '奥秘') gate.奥秘 += 1;
    if (e.category === '知识') gate.知识 += 1;
    if (e.category === '逻辑') gate.逻辑 += 1;
  }
  gate.total = gate.奥秘 + gate.知识 + gate.逻辑;

  const pendingAtStep = [];
  if (char?.className === '法师') {
    if (step === 0) {
      const specs = char?.specChoices || {};
      if (!specs['奥法学者']?.skill) pendingAtStep.push('奥法学者：选择 1 项奥秘子熟练');
      if (!specs['知识传承']?.skill) pendingAtStep.push('知识传承：选择 1 项知识子熟练');
    }
    if (step === 1) {
      const n = featNames(char?.selectedFeatures).length;
      if (n < 4) pendingAtStep.push(`起始特性：已选 ${n}/4（选满后可评价组合）`);
    }
    if (step === 4) {
      const n = (char?.selectedSkills || []).length;
      if (n < 4) pendingAtStep.push(`职业熟练：已选 ${n}/4`);
    }
  }

  const stepSkillPool = step === 4 && char?.className === '法师' ? MAGE_CLASS_SKILL_POOL : [];
  for (const poolItem of stepSkillPool) {
    if (profNames.includes(poolItem)) {
      overlapWarnings.push({
        prof: poolItem,
        sources: ['已有熟练', '职业·八选四候选'],
        message: `职业熟练候选「${poolItem}」与已有熟练同名；建议换选其他方向以拓宽用途。`,
      });
    }
  }

  const features = featNames(char?.selectedFeatures);
  const featureTags = features.flatMap((f) => MAGE_FEATURE_TAGS[f] || []);
  const uniqueTags = [...new Set(featureTags)];

  return {
    entries,
    profNames,
    overlapWarnings,
    multiclassGate: gate,
    pendingAtStep,
    startingFeatures: features,
    featureTags: uniqueTags,
    featureTagMap: Object.fromEntries(
      features.map((f) => [f, MAGE_FEATURE_TAGS[f] || []]),
    ),
  };
}

export function formatLedgerContext(ledger) {
  if (!ledger) return '';
  const lines = ['## 车卡熟练账本（只读；顾问须据此分析，勿与页面冲突）'];

  if (ledger.entries.length) {
    lines.push('- 已锁定熟练：');
    for (const e of ledger.entries) {
      let row = `  · ${e.name} ← ${e.source}`;
      if (e.note) row += `（${e.note}）`;
      lines.push(row);
    }
  } else {
    lines.push('- 已锁定熟练：（尚无）');
  }

  const g = ledger.multiclassGate;
  lines.push(
    `- 兼职法师门槛参考（奥秘+知识+逻辑 熟练计数）：奥秘 ${g.奥秘}、知识 ${g.知识}、逻辑 ${g.逻辑}，合计 ${g.total}/${g.target}`,
  );

  if (ledger.overlapWarnings.length) {
    lines.push('- 重叠/重复提醒（须在回答中优先说明 trade-off，仅冒泡级提示，不阻止用户选择）：');
    for (const w of ledger.overlapWarnings) {
      lines.push(`  · ${w.message}`);
    }
  }

  if (ledger.pendingAtStep.length) {
    lines.push(`- 本步待完成：${ledger.pendingAtStep.join('；')}`);
  }

  if (ledger.startingFeatures?.length) {
    lines.push(`- 已选起始特性：${ledger.startingFeatures.join('、')}`);
    if (ledger.featureTagMap && Object.keys(ledger.featureTagMap).length) {
      const tagLines = Object.entries(ledger.featureTagMap)
        .filter(([, tags]) => tags.length)
        .map(([name, tags]) => `  · ${name}：${tags.join('、')}`);
      if (tagLines.length) {
        lines.push('- 起始特性标签（供组合评价，勿推销未选项）：');
        lines.push(...tagLines);
      }
    }
  }

  lines.push('- L1 法师三项专精（奥法学者、知识传承、魔法学派）能力均获得；非「三选一」。魔法学派对立/主修路线创建页不配置。');
  return lines.join('\n');
}

export function loadMageClassFeatures() {
  try {
    const p = path.join(__dirname, '..', 'advisor', 'chargen', 'mage_class.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data.startingFeatures || [];
  } catch {
    return [];
  }
}

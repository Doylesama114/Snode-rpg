/**
 * Advisor 5.0 batch7 (7071) — chargen calculation tools (point buy + leveling range).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

/** @type {object|null} */
let _pointBuyCache = null;
/** @type {object|null} */
let _levelingCache = null;

const POINT_BUY_RE = /购点|32\s*点|点数分配|属性点分配/;
const LEVELING_RANGE_RE = /从\s*(\d+)\s*级\s*升到\s*(\d+)\s*级|(\d+)\s*级\s*到\s*(\d+)\s*级|升到\s*(\d+)\s*级.*获得|累计.*奖励/;

function loadPointBuyRules() {
  if (!_pointBuyCache) {
    _pointBuyCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'chargen', 'point_buy.json'), 'utf8'));
  }
  return _pointBuyCache;
}

function loadLevelingRules() {
  if (!_levelingCache) {
    _levelingCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'rules', 'leveling.json'), 'utf8'));
  }
  return _levelingCache;
}

export function resetChargenToolsCache() {
  _pointBuyCache = null;
  _levelingCache = null;
}

function costForValue(attrValue, table) {
  const row = table.find((r) => r.attrValue === attrValue);
  return row?.pointCost ?? Infinity;
}

function modForValue(attrValue, table) {
  const row = table.find((r) => r.attrValue === attrValue);
  return row?.modifier ?? Math.floor((attrValue - 10) / 2);
}

export function getLevelingTable(from = 1, to = 5) {
  const lo = Math.min(Number(from) || 1, Number(to) || 5);
  const hi = Math.max(Number(from) || 1, Number(to) || 5);
  const rows = (loadLevelingRules().mainClass?.levels || []).filter(
    (r) => r.level >= lo && r.level <= hi,
  );
  const featWindows = (loadLevelingRules().featMilestones || []).filter(
    (f) => f.level >= lo && f.level <= hi,
  );
  const advancementUnlock = (loadLevelingRules().advancementMilestones || []).find((m) => m.level === 5);
  return { from: lo, to: hi, rows, featWindows, advancementUnlock };
}

/**
 * @param {{ totalPoints?: number, mins?: Record<string, number>, maximize?: string[] }} constraints
 */
export function optimizePointBuy(constraints = {}) {
  const rules = loadPointBuyRules();
  const table = rules.table || [];
  const attrs = rules.attrs || [];
  const totalBudget = constraints.totalPoints ?? rules.totalPoints ?? 32;
  const mins = constraints.mins || {};
  const maximize = constraints.maximize?.length ? constraints.maximize : ['体质'];
  const maxPerAttr = rules.maxPointsPerAttr ?? 9;

  const allocation = {};
  const costs = {};
  for (const a of attrs) {
    allocation[a] = Math.max(8, mins[a] ?? 8);
    costs[a] = costForValue(allocation[a], table);
  }

  let spent = Object.values(costs).reduce((s, c) => s + c, 0);
  if (spent > totalBudget) {
    return { ok: false, error: '约束超出购点预算', spent, totalBudget, allocation };
  }

  for (const attr of maximize) {
    if (!attrs.includes(attr)) continue;
    const floor = allocation[attr];
    for (const row of [...table].sort((a, b) => b.attrValue - a.attrValue)) {
      if (row.attrValue < floor || row.pointCost > maxPerAttr) continue;
      const delta = row.pointCost - costs[attr];
      if (delta <= 0) continue;
      if (spent + delta <= totalBudget) {
        allocation[attr] = row.attrValue;
        spent += delta;
        costs[attr] = row.pointCost;
      }
    }
  }

  for (const attr of maximize) {
    if (!attrs.includes(attr)) continue;
    while (costs[attr] < maxPerAttr && spent < totalBudget) {
      const next = allocation[attr] + 1;
      const nextCost = costForValue(next, table);
      if (nextCost === Infinity || nextCost > maxPerAttr) break;
      const delta = nextCost - costs[attr];
      if (spent + delta > totalBudget) break;
      allocation[attr] = next;
      costs[attr] = nextCost;
      spent += delta;
    }
  }

  const secondary = attrs.filter((a) => !Object.keys(mins).includes(a) && !maximize.includes(a));
  for (const attr of secondary) {
    while (costs[attr] < maxPerAttr && spent < totalBudget) {
      const next = allocation[attr] + 1;
      const nextCost = costForValue(next, table);
      if (nextCost === Infinity || nextCost > maxPerAttr) break;
      const delta = nextCost - costs[attr];
      if (spent + delta > totalBudget) break;
      allocation[attr] = next;
      costs[attr] = nextCost;
      spent += delta;
    }
  }

  const modifiers = {};
  for (const a of attrs) modifiers[a] = modForValue(allocation[a], table);

  return {
    ok: true,
    totalBudget,
    spent,
    remaining: totalBudget - spent,
    allocation,
    pointCosts: costs,
    modifiers,
    maximize,
    mins,
    rules: rules.rules || [],
    sourceFile: 'advisor/chargen/point_buy.json',
  };
}

/**
 * @param {string} query
 */
export function parsePointBuyConstraintsFromQuery(query) {
  const q = String(query || '');
  const mins = {};
  const maximize = [];

  const minPatterns = [
    /(力量|敏捷|体质|智力|感知|魅力|意志|幸运)\s*(?:达到|到|为|是)?\s*(\d+)/g,
  ];
  for (const re of minPatterns) {
    let m;
    while ((m = re.exec(q)) !== null) {
      const val = Number(m[2]);
      if (val >= 8 && val <= 15) mins[m[1]] = Math.max(mins[m[1]] || 0, val);
    }
  }

  if (/智力\s*15|智力达到15|智力.*15/.test(q)) mins.智力 = 15;
  if (/体质\s*15|体质达到15/.test(q)) mins.体质 = 15;

  if (/体质尽量高|体质尽可能高|体质最高|高体质/.test(q)) maximize.push('体质');
  if (/力量尽量|力量尽可能/.test(q)) maximize.push('力量');
  if (/敏捷尽量|敏捷尽可能/.test(q)) maximize.push('敏捷');
  if (!maximize.length && Object.keys(mins).length) maximize.push('体质');

  return {
    totalPoints: 32,
    mins,
    maximize,
    classHint: /法师/.test(q) ? '法师' : null,
    query: q,
  };
}

/**
 * @param {number} from
 * @param {number} to
 */
export function summarizeLevelingRange(from, to) {
  const lo = Math.min(Number(from) || 1, Number(to) || 5);
  const hi = Math.max(Number(from) || 1, Number(to) || 5);
  const table = getLevelingTable(lo + 1, hi);
  const rows = table.rows || [];

  let proficiencyGain = 0;
  let skillSlotsGain = 0;
  let attrGain = 0;
  const featLevels = [];
  const milestones = [];
  const profCaps = [];

  for (const row of rows) {
    if (row.proficiency) proficiencyGain += row.proficiency;
    if (row.skill_slots) skillSlotsGain += row.skill_slots;
    if (row.attr_gain) attrGain += row.attr_gain;
    if (row.other && /专长/.test(row.other)) featLevels.push(row.level);
    if (row.other && row.other !== '-') milestones.push({ level: row.level, note: row.other });
    if (row.prof_cap != null) profCaps.push({ level: row.level, cap: row.prof_cap });
  }

  return {
    fromLevel: lo,
    toLevel: hi,
    levelsApplied: rows.map((r) => r.level),
    proficiencyGain,
    skillSlotsGain,
    attrGain,
    featLevels,
    milestones,
    profCaps,
    advancementUnlock: table.advancementUnlock,
    featWindowsInRange: table.featWindows || [],
    sourceFile: 'advisor/rules/leveling.json',
  };
}

/**
 * @param {string} query
 */
export function parseLevelingRangeFromQuery(query) {
  const q = String(query || '');
  const m = q.match(/从\s*(\d+)\s*级\s*升到\s*(\d+)\s*级/)
    || q.match(/(\d+)\s*级\s*到\s*(\d+)\s*级/)
    || q.match(/从\s*(\d+)\s*级.*升到\s*(\d+)\s*级/);
  if (m) return { from: Number(m[1]), to: Number(m[2]), query: q };
  return null;
}

/**
 * @param {string} query
 */
export function detectChargenCalcQuestion(query) {
  const q = String(query || '');

  if (POINT_BUY_RE.test(q) && /分配|怎样|如何|达到|尽量|最高/.test(q)) {
    const constraints = parsePointBuyConstraintsFromQuery(q);
    if (Object.keys(constraints.mins).length || constraints.maximize.length) {
      return { intent: 'point_buy_optimize', constraints, query: q };
    }
  }

  const range = parseLevelingRangeFromQuery(q);
  if (range && /获得|奖励|一共|累计|什么/.test(q)) {
    return { intent: 'leveling_summary', ...range, query: q };
  }

  if (LEVELING_RANGE_RE.test(q) && /获得|奖励|熟练|技能槽|专长/.test(q)) {
    const r2 = parseLevelingRangeFromQuery(q);
    if (r2) return { intent: 'leveling_summary', ...r2, query: q };
  }

  return null;
}

/**
 * @param {{ intent: string, constraints?: object, from?: number, to?: number, query?: string }} detected
 */
export function buildChargenToolContext(detected) {
  if (!detected) return null;

  if (detected.intent === 'point_buy_optimize') {
    const result = optimizePointBuy(detected.constraints || parsePointBuyConstraintsFromQuery(detected.query));
    if (!result.ok) {
      return {
        intent: 'point_buy_optimize',
        promptProfile: 'point_buy_optimize',
        text: `### Tools 层 · 购点优化\n- 错误：${result.error}\n- 已花费：${result.spent}/${result.totalBudget}`,
        meta: result,
      };
    }
    const lines = [
      '### Tools 层 · 32 点购点优化（point_buy.json · 事实 · 勿改数字）',
      `- 预算：${result.totalBudget} 点；已用 ${result.spent}；剩余 ${result.remaining}`,
      `- 语料来源：${result.sourceFile}`,
      '- **推荐分配（server-side 演算）**：',
    ];
    for (const [attr, val] of Object.entries(result.allocation)) {
      if (result.pointCosts[attr] > 0 || result.mins?.[attr]) {
        lines.push(`  · ${attr} **${val}**（费用 ${result.pointCosts[attr]} → 调整值 ${result.modifiers[attr] >= 0 ? '+' : ''}${result.modifiers[attr]}）`);
      }
    }
    const omitted = Object.entries(result.allocation)
      .filter(([a, v]) => result.pointCosts[a] === 0 && !result.mins?.[a] && v === 8)
      .map(([a]) => a);
    if (omitted.length) lines.push(`  · 其余 ${omitted.join('、')} 维持 **8**（默认，费用 0）`);
    for (const r of result.rules) lines.push(`- 规则：${r}`);
    lines.push('- LLM 须解释约束如何满足（如法师智力 15）及体质最大化；种族加值在购点后叠加。');
    return {
      intent: 'point_buy_optimize',
      promptProfile: 'point_buy_optimize',
      text: lines.join('\n'),
      meta: result,
    };
  }

  if (detected.intent === 'leveling_summary') {
    const summary = summarizeLevelingRange(detected.from, detected.to);
    const lines = [
      '### Tools 层 · 等级区间累计奖励（leveling.json · 事实）',
      `- 区间：主职 **L${summary.fromLevel} → L${summary.toLevel}**（计入 L${summary.levelsApplied.join('、L')} 升级行）`,
      `- 语料：${summary.sourceFile}`,
      `- **熟练 +${summary.proficiencyGain}**`,
      `- **技能槽 +${summary.skillSlotsGain}**`,
    ];
    if (summary.attrGain) lines.push(`- **自由属性点 +${summary.attrGain}**`);
    if (summary.featLevels.length) {
      lines.push(`- **特殊专长窗口**：L${summary.featLevels.join('、L')}`);
    }
    for (const ms of summary.milestones) {
      lines.push(`- L${ms.level}：${ms.note}`);
    }
    if (summary.profCaps.length) {
      lines.push(`- 熟练上限变化：${summary.profCaps.map((p) => `L${p.level}→${p.cap}`).join('；')}`);
    }
    lines.push('- LLM 须完整转述上表；勿编造未出现在升级表中的奖励。');
    return {
      intent: 'leveling_summary',
      promptProfile: 'leveling_summary',
      text: lines.join('\n'),
      meta: summary,
    };
  }

  return null;
}

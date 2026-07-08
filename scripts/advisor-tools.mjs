/**
 * Advisor 4.0 — structured tools (fact layer before LLM polish).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAdvancementMeta,
  inferSourceClassForAdvancement,
  briefAdvancementTalents,
  findSimilarAdvancements,
  loadAdvancementsList,
} from './advisor-advancement-resolve.mjs';
import {
  ROADMAP_DISCLAIMER,
  ROADMAP_ANSWER_SECTIONS,
  buildLevelingHints,
} from './advisor-build-roadmap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

let _levelingCache = null;
let _registryCache = null;

function loadLevelingRules() {
  if (!_levelingCache) {
    _levelingCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'rules', 'leveling.json'), 'utf8'));
  }
  return _levelingCache;
}

function loadClassRegistry() {
  if (!_registryCache) {
    _registryCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'chargen', 'class_registry.json'), 'utf8'));
  }
  return _registryCache;
}

/**
 * @param {string} name
 * @returns {{ type: 'advancement'|'class'|'unknown', name: string, meta?: object }|null}
 */
export function resolveEntity(name) {
  const n = String(name || '').trim();
  if (!n) return null;

  const adv = getAdvancementMeta(n);
  if (adv) return { type: 'advancement', name: adv.name, meta: adv };

  const classes = loadClassRegistry().classes || {};
  if (classes[n]) return { type: 'class', name: n, meta: classes[n] };

  const advByPartial = loadAdvancementsList().find((a) => a.name === n || a.name.includes(n));
  if (advByPartial) return { type: 'advancement', name: advByPartial.name, meta: advByPartial };

  return { type: 'unknown', name: n };
}

/**
 * @param {number} [from=1]
 * @param {number} [to=5]
 */
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
 * @param {string} advancementName
 */
export function getAdvancementBrief(advancementName) {
  const meta = getAdvancementMeta(advancementName);
  const talents = briefAdvancementTalents(advancementName);
  if (!meta && !talents) return null;
  return {
    name: advancementName,
    scope: meta?.scope || null,
    sourceClasses: meta?.sourceClasses || [],
    attrsRequired: meta?.attrsRequired || null,
    conditions: (meta?.conditions || []).slice(0, 4),
    confidence: meta?.confidence || talents?.confidence || 'documented',
    abilityNames: talents?.abilityNames || [],
    insightMilestones: talents?.insightMilestones || [],
  };
}

function formatLevelRow(row) {
  const parts = [`L${row.level}`];
  if (row.proficiency) parts.push(`熟练+${row.proficiency}`);
  if (row.attr_gain) parts.push(`属性+${row.attr_gain}`);
  if (row.skill_slots) parts.push(`技能槽+${row.skill_slots}`);
  if (row.other && row.other !== '-') parts.push(String(row.other).slice(0, 80));
  return parts.join(' · ');
}

function sampleSkillDirections(catalog, limit = 6) {
  if (!catalog?.phases?.early) return [];
  const out = [];
  for (const [style, skills] of Object.entries(catalog.phases.early.byStyle || {})) {
    for (const sk of skills.slice(0, 2)) {
      out.push(`${style}：${sk.name}(${sk.tier})`);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Server-side factual outline for build_roadmap (LLM polishes on top).
 * @param {object} goal parseRoadmapGoal result
 * @param {{ store?: object, roadmapCtx?: object, snapshot?: object }} [options]
 */
export function outlineGrowthRoadmap(goal, options = {}) {
  const roadmapCtx = options.roadmapCtx || null;
  const mainClass = goal.mainClass
    || (goal.advancementName ? inferSourceClassForAdvancement(goal.advancementName) : null)
    || roadmapCtx?.goal?.mainClass
    || '法师';

  const sections = [];

  if (goal.unknownAdvancement) {
    const similar = findSimilarAdvancements(goal.unknownAdvancement);
    sections.push({
      id: 'goal',
      title: ROADMAP_ANSWER_SECTIONS[0],
      bullets: [
        `用户目标进阶「${goal.unknownAdvancement}」`,
        '当前资料库未收录该进阶名称',
      ],
    });
    sections.push({
      id: 'unknown',
      title: '未收录说明（事实）',
      bullets: [
        '不得编造属性门槛、标识或天赋列表',
        similar.length ? `相近 documented 进阶（仅供参考）：${similar.join('、')}` : '无相近 documented 进阶可推荐',
      ],
    });
    const table = getLevelingTable(1, 5);
    sections.push({
      id: 'base_l1_4',
      title: ROADMAP_ANSWER_SECTIONS[1],
      bullets: table.rows.map(formatLevelRow),
    });
    sections.push({
      id: 'advancement_timing',
      title: ROADMAP_ANSWER_SECTIONS[2],
      bullets: [
        table.advancementUnlock
          ? `${table.advancementUnlock.reward}（L${table.advancementUnlock.level}）`
          : '主职 L5 可择进阶（一般规则）',
        '具体进阶门槛须向 DM 或规则书确认',
      ],
    });
    sections.push({
      id: 'disclaimer',
      title: ROADMAP_ANSWER_SECTIONS[5],
      bullets: [ROADMAP_DISCLAIMER],
    });
    return {
      mode: 'unknown_advancement',
      mainClass,
      advancementName: null,
      unknownAdvancement: goal.unknownAdvancement,
      sections,
      disclaimer: ROADMAP_DISCLAIMER,
    };
  }

  const advBrief = goal.advancementName ? getAdvancementBrief(goal.advancementName) : null;
  const table = getLevelingTable(1, 5);
  const catalog = roadmapCtx?.mainClassCatalog || null;
  const skillDirs = sampleSkillDirections(catalog);

  if (goal.roadmapMode === 'advancement_base_class_pick' && advBrief?.sourceClasses?.length) {
    const goalBullets = [
      `目标进阶：${goal.advancementName}`,
      `兼容基础主职（任选其一）：${advBrief.sourceClasses.join('、')}`,
      '问句类型：基础职业选择——须比较以上主职，勿默认单一法师，勿误认「术士」等子串职业',
    ];
    sections.push({ id: 'goal', title: ROADMAP_ANSWER_SECTIONS[0], bullets: goalBullets });
    sections.push({
      id: 'base_l1_4',
      title: ROADMAP_ANSWER_SECTIONS[1],
      bullets: [
        '各兼容主职 L1–4 均遵循 L0 升级表（熟练/属性/技能槽/专长窗）',
        ...table.rows.filter((r) => r.level <= 4).map(formatLevelRow),
      ],
    });
    const gateBullets = [];
    if (table.advancementUnlock) {
      gateBullets.push(`${table.advancementUnlock.reward}（L${table.advancementUnlock.level}）`);
    }
    if (advBrief.attrsRequired) {
      gateBullets.push(`属性门槛：${Object.entries(advBrief.attrsRequired).map(([k, v]) => `${k}${v}`).join('、')}`);
    }
    if (advBrief.sourceClasses?.length) {
      gateBullets.push(`兼容主职：${advBrief.sourceClasses.join('、')}`);
    }
    if (advBrief.conditions?.length) {
      gateBullets.push(`行为/剧情条件：${advBrief.conditions.join('；')}`);
    }
    sections.push({ id: 'advancement_gate', title: ROADMAP_ANSWER_SECTIONS[2], bullets: gateBullets });
    const insightBullets = (advBrief.insightMilestones || []).map(
      (m) => `${m.name}：${m.summary.slice(0, 120)}`,
    );
    sections.push({
      id: 'advancement_nodes',
      title: ROADMAP_ANSWER_SECTIONS[3],
      bullets: insightBullets.length ? insightBullets : ['见 L3 文档'],
    });
    sections.push({
      id: 'skill_direction',
      title: ROADMAP_ANSWER_SECTIONS[4],
      bullets: [
        `分别简述 ${advBrief.sourceClasses.join('、')} 各 1 条风格取向（须来自 L2 检索）`,
        '勿给出单一主职的完整 build',
      ],
    });
    sections.push({ id: 'disclaimer', title: ROADMAP_ANSWER_SECTIONS[5], bullets: [ROADMAP_DISCLAIMER] });
    return {
      mode: 'advancement_base_class_pick',
      mainClass: null,
      advancementName: goal.advancementName,
      unknownAdvancement: null,
      sections,
      disclaimer: ROADMAP_DISCLAIMER,
    };
  }

  const goalBullets = [
    goal.advancementName ? `目标进阶：${goal.advancementName}` : null,
    `主职：${mainClass}`,
    goal.subClass ? `子职：${goal.subClass}` : null,
    options.snapshot ? '场景：含 L6 快照' : '场景：从 L1 规划',
  ].filter(Boolean);

  sections.push({ id: 'goal', title: ROADMAP_ANSWER_SECTIONS[0], bullets: goalBullets });

  sections.push({
    id: 'base_l1_4',
    title: ROADMAP_ANSWER_SECTIONS[1],
    bullets: [
      ...table.rows.filter((r) => r.level <= 4).map(formatLevelRow),
      ...(table.featWindows.filter((f) => f.level === 4).map((f) => `L${f.level}：${f.reward}`)),
    ],
  });

  const gateBullets = [];
  if (table.advancementUnlock) {
    gateBullets.push(`${table.advancementUnlock.reward}（L${table.advancementUnlock.level}）`);
  }
  if (advBrief?.attrsRequired) {
    gateBullets.push(`属性门槛：${Object.entries(advBrief.attrsRequired).map(([k, v]) => `${k}${v}`).join('、')}`);
  }
  if (advBrief?.conditions?.length) {
    gateBullets.push(`行为/剧情条件：${advBrief.conditions.join('；')}`);
  }
  if (advBrief?.sourceClasses?.length) {
    gateBullets.push(`兼容主职：${advBrief.sourceClasses.join('、')}`);
  }
  sections.push({
    id: 'advancement_gate',
    title: ROADMAP_ANSWER_SECTIONS[2],
    bullets: gateBullets.length ? gateBullets : ['L5 择进阶；具体门槛见 L3 上下文'],
  });

  const insightBullets = (advBrief?.insightMilestones || []).map(
    (m) => `${m.name}：${m.summary.slice(0, 120)}`,
  );
  if (advBrief?.abilityNames?.length) {
    insightBullets.unshift(`天赋名（勿展开机制）：${advBrief.abilityNames.join('、')}`);
  }
  sections.push({
    id: 'advancement_nodes',
    title: ROADMAP_ANSWER_SECTIONS[3],
    bullets: insightBullets.length ? insightBullets : ['进阶后节点见 L3 文档'],
  });

  sections.push({
    id: 'skill_direction',
    title: ROADMAP_ANSWER_SECTIONS[4],
    bullets: skillDirs.length
      ? [...skillDirs, '（以上为 L2 前期抽样，非固定配点）']
      : ['结合 L2 上下文按流派/位阶自选 2～4 项代表技能'],
  });

  sections.push({
    id: 'disclaimer',
    title: ROADMAP_ANSWER_SECTIONS[5],
    bullets: [ROADMAP_DISCLAIMER],
  });

  return {
    mode: goal.roadmapMode || 'dual_class_or_orientation',
    mainClass,
    advancementName: goal.advancementName || null,
    unknownAdvancement: null,
    sections,
    disclaimer: ROADMAP_DISCLAIMER,
  };
}

/**
 * @param {ReturnType<typeof outlineGrowthRoadmap>} outline
 */
export function formatRoadmapOutline(outline) {
  if (!outline?.sections?.length) return '';
  const lines = ['### 路线骨架（server-side · 事实层）'];
  lines.push('- LLM 须在此骨架上补充取舍理由；**不得修改**门槛数字、等级节点、L0 升级事实。');
  for (const sec of outline.sections) {
    lines.push(`\n#### ${sec.title}`);
    for (const b of sec.bullets || []) {
      lines.push(`- ${b}`);
    }
  }
  return lines.join('\n');
}

export function resetAdvisorToolsCache() {
  _levelingCache = null;
  _registryCache = null;
}

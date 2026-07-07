/**
 * Build Advisor — extract 异常状态 from 帮助.html §7 (+ control-related keywords).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAGE_SKILLS = path.join(__dirname, '..', '职业页', '数据', '法师.json');

const CATEGORY_META = [
  { heading: '持续状态', category: '持续', defaultTier: 'dot' },
  { heading: '限制状态', category: '限制', defaultTier: 'soft_cc' },
  { heading: '失能状态', category: '失能', defaultTier: 'hard_cc' },
  { heading: '创伤状态', category: '创伤', defaultTier: 'trauma' },
];

const TIER_OVERRIDES = {
  霜冻: 'stacking',
  感染: 'stacking',
  击退: 'displacement',
  恐惧: 'mind_control',
  混乱: 'mind_control',
  魅惑: 'mind_control',
  忏悔: 'mind_control',
  昏睡: 'hard_cc',
  醉酒: 'debuff',
  缴械: 'debuff',
};

const BUILD_HINTS = {
  hard_cc: ['硬控：跳过回合且无法行动', '控场 build 核心', '可打断敌方施法节奏'],
  soft_cc: ['软控：限制移动/感知/反应等', '可与硬控或 DoT 叠加'],
  dot: ['持续伤害（DoT）', '战斗结束后层数可能转入长休后果'],
  stacking: ['层数累积型', '满层后触发更强效果'],
  mind_control: ['惑控向：目标可能失控或跳过回合', '通常受伤或受刺激可解除'],
  displacement: ['位移向：改变站位', '一般不触发借机攻击'],
  debuff: ['负面减益', '改变目标战斗行为'],
  trauma: ['长期/永久创伤', 'build 顾问仅作背景说明，非常规战斗控场'],
};

const RELATED_KEYWORDS = [
  { name: '惑控', source: '帮助.html §关键词·效果标签', description: '能够使目标短暂失去角色控制权的效果' },
  { name: '专注', source: '帮助.html §关键词·机制标签', description: '必须花费注意力来维持的精密效果；施展者进入惑控或失能状态、或执行另一项专注效果时会中断先前的专注' },
  { name: '净化', source: '帮助.html §关键词·效果标签', description: '移除角色当前承受的负面状态的效果' },
  { name: '激活', source: '帮助.html §关键词·机制标签', description: '施展者未进入惑控或失能状态时可在自身回合选择中断，不需花费动作' },
];

function htmlEffectToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstSummary(text, maxLen = 140) {
  const line = text.split('\n').find((l) => l.trim()) || text;
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

function inferBreaksOn(text) {
  const out = [];
  if (/受到伤害/.test(text)) out.push('伤害');
  if (/暴击伤害/.test(text)) out.push('暴击伤害');
  if (/承受一定刺激/.test(text)) out.push('刺激');
  if (/豁免成功/.test(text)) out.push('豁免成功');
  if (/对抗成功/.test(text)) out.push('对抗成功');
  if (/火焰伤害/.test(text)) out.push('火焰伤害');
  return out;
}

function inferControlTier(name, category, defaultTier, text) {
  if (TIER_OVERRIDES[name]) return TIER_OVERRIDES[name];
  if (category === '失能') return 'hard_cc';
  if (category === '持续' && ['灼烧', '中毒', '流血'].includes(name)) return 'dot';
  if (category === '创伤') return 'trauma';
  if (/跳过下一个自身回合/.test(text) && category === '限制') return 'mind_control';
  return defaultTier;
}

function extraBuildHints(name, tier, text) {
  const hints = [...(BUILD_HINTS[tier] || [])];
  if (name === '沉默') hints.push('反制施法者：禁语言交流及需语言的法术');
  if (name === '耳鸣') hints.push('与沉默不同：禁听觉与聆听，听觉类能力无效');
  if (name === '冻结' && /灼烧/.test(text)) hints.push('触发时清除全部灼烧；受火焰伤害解除');
  if (name === '击晕') hints.push('短版眩晕，持续仅 1 轮');
  if (name === '减速' || name === '禁锢' || name === '麻痹') hints.push('移动限制类，可与其他控场叠加');
  return [...new Set(hints)];
}

function parseStatusTables(html) {
  const section = html.match(/id="s7"[\s\S]*?(?=id="s8"|$)/);
  if (!section) throw new Error('异常状态 section (s7) not found in 帮助.html');

  const conditions = [];
  for (const { heading, category, defaultTier } of CATEGORY_META) {
    const blockRe = new RegExp(`<h3>${heading}<\\/h3>([\\s\\S]*?)(?=<h3>|$)`);
    const block = section[0].match(blockRe);
    if (!block) throw new Error(`Missing subsection: ${heading}`);

    const rows = [...block[1].matchAll(/<tr><td><b>([^<]+)<\/b><\/td><td>([\s\S]*?)<\/td><\/tr>/g)];
    for (const row of rows) {
      const name = row[1].trim();
      const fullEffect = htmlEffectToText(row[2]);
      const controlTier = inferControlTier(name, category, defaultTier, fullEffect);
      conditions.push({
        id: `status-${name}`,
        name,
        category,
        controlTier,
        summary: firstSummary(fullEffect),
        fullEffect,
        breaksOn: inferBreaksOn(fullEffect),
        buildHints: extraBuildHints(name, controlTier, fullEffect),
      });
    }
  }

  const severeNote = section[0].match(/<div class="card"><div class="num">重伤<\/div><div class="desc">([^<]+)<\/div>/);
  return {
    severeInjuryNote: severeNote ? severeNote[1].trim() : null,
    conditions,
  };
}

function countMageSkillRefs(statusNames) {
  const magePath = MAGE_SKILLS;
  if (!fs.existsSync(magePath)) return {};
  const mage = JSON.parse(fs.readFileSync(magePath, 'utf8'));
  const counts = Object.fromEntries(statusNames.map((n) => [n, 0]));
  for (const skill of mage.skills || []) {
    const blob = JSON.stringify(skill);
    for (const name of statusNames) {
      if (blob.includes(name)) counts[name]++;
    }
  }
  return counts;
}

/**
 * @param {string} helpHtmlPath absolute path to 帮助.html
 */
export function buildStatusConditions(helpHtmlPath) {
  const html = fs.readFileSync(helpHtmlPath, 'utf8');
  const { severeInjuryNote, conditions } = parseStatusTables(html);
  const mageRefs = countMageSkillRefs(conditions.map((c) => c.name));

  for (const c of conditions) {
    c.referencedByMageSkills = mageRefs[c.name] || 0;
  }

  const mageControlTop = conditions
    .filter((c) => c.referencedByMageSkills > 0 && c.category !== '创伤')
    .sort((a, b) => b.referencedByMageSkills - a.referencedByMageSkills)
    .slice(0, 10)
    .map((c) => ({ name: c.name, count: c.referencedByMageSkills, controlTier: c.controlTier }));

  return {
    meta: {
      layer: 'L0',
      phase: '1.5',
      version: '1.0.0',
      source: '斯诺德跑团/帮助.html §异常状态 + §关键词（惑控/专注/净化/激活）',
      generatedAt: new Date().toISOString().slice(0, 10),
      conditionCount: conditions.length,
      categories: CATEGORY_META.map((c) => c.category),
      advisorUsage: '控场/异常 build 问答时检索；阶段2将为技能挂 appliesStatuses 字段联动',
      truncatedInSource: conditions.filter((c) => c.name === '昏睡').length
        ? ['昏睡：帮助.html 原文在「如果豁免成功、目标在受到伤害或承受一定刺激」处截断，以原文为准']
        : [],
    },
    severeInjuryNote,
    relatedKeywords: RELATED_KEYWORDS,
    controlTierLegend: {
      hard_cc: '硬控：跳过回合 / 无法行动',
      soft_cc: '软控：移动、感知、反应等受限',
      mind_control: '惑控：目标失控或被迫行动',
      dot: '持续伤害层数',
      stacking: '层数累积后质变',
      displacement: '强制位移',
      debuff: '其他负面减益',
      trauma: '长期创伤（非常规战斗控场）',
    },
    mageControlTop,
    conditions,
  };
}

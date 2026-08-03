/**
 * Transform 职业页/数据 skill records into L2 advisor chunks.
 */
const TIER_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const TYPE_FROM_KEYWORD = {
  法术: 'spell',
  戏法: 'cantrip',
  天赋: 'talent',
  战技: 'martial',
  神术: 'divine',
  功法: 'gongfa',
  异能: 'psionic',
};

const DAMAGE_TAGS = [
  '火焰', '冰霜', '雷电', '强酸', '力能', '自然', '暗影', '光耀', '死灵', '毒素', '心灵',
];

const ROLE_PATTERNS = [
  { re: /施法攻击|AOE|伤害|打击/, hint: 'burst' },
  { re: /治疗|治愈|回复生命|次级治疗|生命归还/, hint: 'sustain' },
  { re: /跃迁|传送|闪现|次元步|闪烁/, hint: 'mobility' },
  { re: /增益|护盾|防护|庇护|增幅/, hint: 'buff' },
  { re: /惑控|睡眠|减速|禁锢|麻痹|恐惧|混乱|魅惑|沉默|致盲|击晕|冻结|眩晕|击倒|压制|忏悔|混乱|惊惧|缠绕|束缚/, hint: 'control' },
  { re: /创造|侦查|探测|识别|解析|侦测|传讯|照明/, hint: 'utility' },
  { re: /备战|先攻|反应|借机/, hint: 'tactical' },
  { re: /命中|精准|暴击/, hint: 'precision' },
  { re: /参悟|补给|短休|长休/, hint: 'resource' },
];

export function normalizeTier(tier) {
  if (tier == null || tier === '') return null;
  if (typeof tier === 'number') {
    const label = TIER_NUM[tier] || String(tier);
    return `${label}阶`;
  }
  return String(tier);
}

export function parseKeywordHead(fields) {
  const kw = fields?.关键词 || '';
  return kw.split('.')[0] || '';
}

export function inferSkillType(skill) {
  if (skill.type === 'starting') return 'starting';
  const head = parseKeywordHead(skill.fields);
  if (TYPE_FROM_KEYWORD[head]) return TYPE_FROM_KEYWORD[head];
  if (skill.fields?.施展时间) return 'spell';
  if (head === '天赋' || (skill.fields && !skill.fields.施展时间)) return 'talent';
  return 'spell';
}

export function parseMarks(cost) {
  if (!Array.isArray(cost) || !cost.length) {
    return { marks: [], spCost: 0 };
  }
  const marks = [];
  let spCost = 0;
  for (const c of cost) {
    for (let i = 0; i < (c.count || 1); i += 1) {
      marks.push(c.name || c.id);
    }
    spCost += c.count || 1;
  }
  return { marks, spCost };
}

export function parseCast(fields) {
  if (!fields?.施展时间 && !fields?.施展距离 && !fields?.持续时间) return null;
  return {
    time: fields.施展时间 || null,
    range: fields.施展距离 || null,
    duration: fields.持续时间 || null,
  };
}

export function parseFp(fields) {
  const raw = fields?.疲劳消耗;
  if (raw == null || raw === '' || raw === '-') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function extractChoicesFrom(descriptions) {
  const text = (descriptions || []).join('\n');
  const m = text.match(/抉择[^：:\n]*[：:]\s*(.+)/);
  return m ? m[1].trim() : '';
}

export function buildSummary(skill) {
  const descParts = [];
  if (skill.fields?.描述) descParts.push(skill.fields.描述);
  for (const line of skill.description || []) {
    if (line && !descParts.includes(line)) descParts.push(line);
  }
  const upTexts = [];
  for (const up of skill.level_upgrades || []) {
    if (up.text) upTexts.push(`L${up.level}: ${up.text}`);
  }
  const descJoined = descParts.join(' ').replace(/\s+/g, ' ').trim();
  const upsJoined = upTexts.join(' ');
  let joined = [descJoined, upsJoined].filter(Boolean).join(' ');
  if (joined.length <= 600) return joined;
  // 长技能截断时优先保留升级文本：描述压缩到 240，升级内容尽量完整（上限 900）
  if (upsJoined.length > 0) {
    const descCut = descJoined.length > 240 ? `${descJoined.slice(0, 239)}…` : descJoined;
    joined = [descCut, upsJoined].filter(Boolean).join(' ');
    if (joined.length <= 900) return joined;
  }
  return `${joined.slice(0, 899)}…`;
}

export function inferDamageHint(skill) {
  const tags = skill.tags || [];
  for (const d of DAMAGE_TAGS) {
    if (tags.some((t) => t.includes(d))) return d;
  }
  const blob = `${skill.fields?.关键词 || ''} ${(skill.description || []).join(' ')} ${skill.fields?.描述 || ''}`;
  for (const d of DAMAGE_TAGS) {
    if (blob.includes(d)) return d;
  }
  return null;
}

export function inferRoleHints(skill, statusNames) {
  const hints = new Set();
  const blob = JSON.stringify(skill);
  for (const { re, hint } of ROLE_PATTERNS) {
    if (re.test(blob)) hints.add(hint);
  }
  for (const name of statusNames) {
    if (blob.includes(name)) hints.add('control');
  }
  const range = skill.fields?.施展距离 || '';
  if (/^\d+米$/.test(range) && Number(range) >= 6) hints.add('ranged');
  if (skill.tags?.includes('AOE')) hints.add('aoe');
  if (skill.tags?.includes('专注') || skill.tags?.includes('引导')) hints.add('concentration');
  return [...hints];
}

export function inferAppliesStatuses(skill, statusNames) {
  const blob = JSON.stringify(skill);
  return statusNames.filter((n) => blob.includes(n));
}

export function buildSearchText(chunk) {
  return [
    chunk.name,
    chunk.class,
    chunk.style,
    chunk.tier,
    chunk.type,
    chunk.damageHint,
    ...(chunk.tags || []),
    ...(chunk.marks || []),
    ...(chunk.roleHints || []),
    ...(chunk.appliesStatuses || []),
    chunk.choicesFrom,
    chunk.prerequisite,
    chunk.summary,
  ].filter(Boolean).join(' ');
}

/**
 * @param {object} skill raw skill from 职业页/数据/*.json
 * @param {object} opts
 * @param {'mage'|'universal'} opts.source
 * @param {string} opts.className
 * @param {string[]} opts.statusNames
 */
export function skillToChunk(skill, { source, className, statusNames }) {
  const { marks, spCost } = parseMarks(skill.cost);
  const cast = parseCast(skill.fields);
  const choicesFrom = extractChoicesFrom(skill.description);
  const prerequisite = [skill.fields?.前置条件, skill.fields?.施展条件, skill.fields?.额外条件]
    .filter((x) => x && x !== '-')
    .join('；') || '';
  const chunk = {
    id: skill.id,
    name: skill.name,
    source,
    class: className,
    style: skill.style || null,
    tier: normalizeTier(skill.tier),
    type: inferSkillType(skill),
    tags: skill.tags || [],
    marks,
    spCost,
    fp: parseFp(skill.fields),
    cast,
    prerequisite,
    choicesFrom,
    summary: buildSummary(skill),
    damageHint: inferDamageHint(skill),
    roleHints: inferRoleHints(skill, statusNames),
    appliesStatuses: inferAppliesStatuses(skill, statusNames),
  };
  chunk.searchText = buildSearchText(chunk);
  return chunk;
}

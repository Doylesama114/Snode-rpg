/**
 * Advisor — 数值确定性工具（技能代价 / 负重 / 伤害期望）。
 * 原则：能交给引擎算的数值不让模型心算；没有可靠结构化数据就不给数字。
 */

/** 遍历 store 中全部 L2 技能索引，返回指定技能名的出现条目 */
function lookupSkillOccurrences(store, name) {
  const out = [];
  const collect = (list, className, layer) => {
    for (const sk of list || []) {
      if (sk.name === name) {
        out.push({ className, layer, skill: sk });
      }
    }
  };
  for (const [layer, entry] of Object.entries(store.classSkillIndexes || {})) {
    collect(entry?.skills, entry?.className || layer, layer);
  }
  if (store.mageSkills?.skills) collect(store.mageSkills.skills, '法师', 'L2-mage');
  if (store.universalSkills?.skills) collect(store.universalSkills.skills, '通用天赋', 'L2-universal');
  return out;
}

function skillNamesFromDetected(detected) {
  const names = detected.skillNames || (detected.skillName ? [detected.skillName] : []);
  return [...new Set(names.filter(Boolean))];
}

/** 技能代价查询：疲劳/技能点/标识/施展时间等结构化字段 */
export function buildSkillCostContext(detected, store = {}) {
  const names = skillNamesFromDetected(detected);
  if (!names.length) return null;
  const rows = [];
  for (const name of names) {
    for (const occ of lookupSkillOccurrences(store, name)) {
      const sk = occ.skill || {};
      const fields = [];
      if (sk.fp != null) fields.push(`疲劳消耗：${sk.fp}`);
      if (sk.spCost != null) fields.push(`技能点：${sk.spCost}`);
      if (sk.marks?.length) fields.push(`色彩标识：${sk.marks.join('、')}`);
      if (sk.cast?.time) fields.push(`施展时间：${sk.cast.time}`);
      if (sk.cast?.range) fields.push(`施展距离：${sk.cast.range}`);
      if (sk.cast?.duration) fields.push(`持续时间：${sk.cast.duration}`);
      if (sk.prerequisite) fields.push(`前置：${String(sk.prerequisite).slice(0, 120)}`);
      if (sk.choicesFrom) fields.push(`抉择：${sk.choicesFrom}`);
      if (fields.length) rows.push(`- ${name}（${occ.className}）：${fields.join('；')}`);
    }
  }
  if (!rows.length) return null;
  return {
    intent: 'skill_cost',
    promptProfile: 'skill_detail',
    text: [
      '### Tools 层 · 技能代价（server-side 事实 · 勿改数字）',
      ...rows,
      '- LLM 须完整转述上述代价；未出现在上文中的代价字段不得编造。',
    ].join('\n'),
    meta: { skillNames: names },
  };
}

/** 负重演算：常规=力量×5，满载=力量×10，极限=力量×15；承载熟练 +1 力量 */
export function buildCarryCapacityContext(detected, store = {}) {
  const q = String(detected.query || '');
  const m = q.match(/力量\s*(\d+)/);
  const snap = detected.snapshot || null;
  let str = m ? Number(m[1]) : null;
  if (str == null && snap?.attrs) {
    const v = snap.attrs['力量'] ?? snap.attrs.str;
    if (v != null) str = Number(v);
  }
  let profNote = '';
  if (snap?.profs?.['力量']?.['承载']) {
    const p = Number(snap.profs['力量']['承载']) || 0;
    if (p) {
      str = (str || 0) + p;
      profNote = `（含承载熟练 +${p}，视作力量+${p}）`;
    }
  }
  if (str == null) {
    return {
      intent: 'carry_capacity',
      promptProfile: 'general',
      text: [
        '### Tools 层 · 负重规则（server-side 事实）',
        '- 公式：常规负重 = 力量值×5；满载负重 = 力量值×10；极限负重 = 力量值×15（单位 kg）',
        '- 每 1 点力量「承载」专业熟练度视作 +1 力量值',
        '- 用户未给出力量值时，先说明需要力量值，再给公式。',
      ].join('\n'),
      meta: { formula: true },
    };
  }
  const reg = str * 5;
  const full = str * 10;
  const max = str * 15;
  return {
    intent: 'carry_capacity',
    promptProfile: 'general',
    text: [
      '### Tools 层 · 负重演算（server-side 事实 · 勿改数字）',
      `- 力量值：${str}${profNote}`,
      `- 常规负重：${str}×5 = ${reg} kg`,
      `- 满载负重：${str}×10 = ${full} kg`,
      `- 极限负重：${str}×15 = ${max} kg`,
      '- LLM 须完整转述三个档位数值。',
    ].join('\n'),
    meta: { str, reg, full, max },
  };
}

const DICE_RE = /(\d+)[Dd](\d+)([+-]\d+)?/g;
const AMBIGUOUS_RE = /D100|区间|随机|根据|或|额外|每升|再结算|可再/;

/** 伤害期望：仅当技能描述里只有一个清晰骰子表达式时给出区间/均值 */
export function buildDamageExpectationContext(detected, store = {}) {
  const names = skillNamesFromDetected(detected);
  if (!names.length) return null;
  const rows = [];
  for (const name of names) {
    for (const occ of lookupSkillOccurrences(store, name)) {
      const sk = occ.skill || {};
      const blob = `${sk.summary || ''}`;
      // 按升级档拆分（L5:/L8:/L10:...），每个档位内应只有一个骰子表达式
      const segs = blob.split(/(?=L\d+:)/);
      const computed = [];
      for (const seg of segs) {
        const dice = [...seg.matchAll(DICE_RE)];
        if (dice.length !== 1) continue;
        if (AMBIGUOUS_RE.test(seg)) continue;
        const d = dice[0];
        const n = Number(d[1]);
        const s = Number(d[2]);
        const flat = Number(d[3] || 0);
        if (!n || !s) continue;
        const min = n * 1 + flat;
        const max = n * s + flat;
        const avg = (n * (1 + s)) / 2 + flat;
        const lv = /^L(\d+):/.exec(seg);
        const flatTxt = flat > 0 ? `+${flat}` : flat < 0 ? String(flat) : '';
        computed.push({
          label: lv ? `L${lv[1]}` : '基础',
          text: `${n}D${s}${flatTxt} → ${min}-${max}（平均约 ${avg.toFixed(1)}）`,
        });
      }
      if (!computed.length) continue;
      const parts = computed.map((c) => `${c.label}：${c.text}`).join('；');
      rows.push(
        `- ${name}（${occ.className}）：${parts}（仅技能自身骰子与固定加值，不含武器/属性调整/Buff）`,
      );
    }
  }
  if (!rows.length) return null;
  return {
    intent: 'damage_expectation',
    promptProfile: 'skill_detail',
    text: [
      '### Tools 层 · 伤害期望（server-side 演算 · 勿改数字）',
      ...rows,
      '- 若用户问的是普攻/武器伤害，须说明还需要武器与属性信息；不要把技能骰子当作最终伤害。',
    ].join('\n'),
    meta: { skillNames: names },
  };
}

/**
 * Phase 4‴ / 5 — 创建页陪跑：分步骤冒泡问法（全职业）
 */
import { buildChargenLedger, formatLedgerContext } from './advisor-chargen-ledger.mjs';
import {
  analyzePointBuy,
  formatPointBuyContext,
  formatSkillSynergyContext,
  formatCharacterProfileContext,
} from './advisor-chargen-attrs.mjs';
import {
  formatKeyAttrLabel,
  formatKeyAttrTargetPhrase,
  formatTierAdvisorNote,
  getClassProfile,
  getStartingFeatureMax,
} from './advisor-chargen-registry.mjs';

function featNames(char) {
  const list = char?.selectedFeatures || [];
  return list.map((f) => (typeof f === 'string' ? f : (f?.n || f?.name || ''))).filter(Boolean);
}

function profileHasContent(char) {
  const p = char?.characterProfile || char;
  return ['story', 'personality', 'charName', 'gender', 'ideals', 'bonds', 'flaws', 'hair', 'eye']
    .some((k) => (p[k] || '').trim().length > 0);
}

function step0Query(char, label, commonTail) {
  const cn = char.className || '当前职业';
  const profile = getClassProfile(cn);
  const tierNote = formatTierAdvisorNote(profile);
  const parts = [`当前车卡步骤「${label}」。职业：${cn}。`];
  if (tierNote) parts.push(tierNote);
  if (profile.keyAttrCreateNote) {
    parts.push(`关键属性说明：${profile.keyAttrCreateNote}`);
  }
  if (profile.hasMageSpecs) {
    parts.push(
      '规则：L1 法师同时获得奥法学者、知识传承、魔法学派三项专精能力（非三选一）；本步请为奥法学者、知识传承各选 1 子熟练；魔法学派 L1 已拥有，对立学派后续在角色面板配置。',
      '请根据已选专精子项（须用完整名如奥秘-魔法学识）说明 trade-off；若尚未选满，只提示待完成项。',
    );
  } else if (cn === '魔契师') {
    parts.push(
      '规则：魔契师创建以「魔契」与「起始特性」战斗风格树为核心，传统起始特性池可能为空；请围绕魔契选择与起始特性线说明 trade-off，勿套用其他职业八选四模板。',
      '若用户尚未选魔契/风格，只提示待完成项，勿推销具体未选项名称。',
    );
  } else if (profile.specProfChoices?.length) {
    parts.push(
      `请根据已选专精/选项（${profile.specProfChoices.join('、')} 等）说明 trade-off；若尚未选满，只提示待完成项。`,
    );
    if (cn === '奇械师') {
      parts.push(
        '奇械师专精涉及知识/工程学子项与职业八选四熟练，须用完整子项名讨论重复与协同；勿假设标识系统已完整收录。',
      );
    }
  } else {
    parts.push('请确认职业选择并简述该职业 L1 创建要点；勿推销具体未选项名称。');
  }
  if ((profile.keyAttr || '').includes('或') && !char.keyAttr) {
    parts.push('本职业关键属性为「或」关系：创建页须先选定力量或敏捷其一作为关键属性，购点阶段至少一项达标即可。');
  }
  parts.push(commonTail);
  return parts.join('');
}

/**
 * @param {{ step?: number, stepLabel?: string, char?: object }} snapshot
 */
export function buildChargenBubbleQuery(snapshot) {
  if (!snapshot) return '当前车卡步骤请给出陪跑建议。';
  const step = snapshot.step ?? 0;
  const label = snapshot.stepLabel || '';
  const char = snapshot.char || {};
  const className = char.className || null;
  const profile = getClassProfile(className);
  const ledger = buildChargenLedger(char, { step });
  const feats = featNames(char);
  const featMax = getStartingFeatureMax(char, profile);
  const skills = (char.selectedSkills || []).slice();
  const keyLabel = formatKeyAttrLabel(char, profile);

  const commonTail = '不要 Markdown。不要替用户指定未选项名称；不要「必拿/强烈建议选 XXX」。';

  if (step === 0) {
    return step0Query(char, label, commonTail);
  }

  if (step === 1) {
    const poolHint = profile.startingFeaturePick === 'all'
      ? '本职业起始特性规则以创建页为准（勿称「八选四」）'
      : `本步规则（选 ${featMax} 项）`;
    const sorcererNote = className === '术士'
      ? '术士起始特性为三选二（魔法飞弹/混沌法术/天赐神通）；评价组合时强调随机性与幸运关键属性协同。'
      : '';
    if (feats.length >= featMax) {
      return [
        `当前车卡步骤「${label}」。职业：${className || '未选'}。用户已选满 ${featMax} 项起始特性：${feats.join('、')}。`,
        sorcererNote,
        '【必须】评价这套组合的整体风格、优点与缺口（缺位移/缺控/缺生存等）；不要推荐改选或推销其他未选特性。',
        profile.tier === 'full' ? '可结合上下文起始特性标签；2～3 点，共不超过120字。' : '2～3 点，共不超过120字；勿编造上下文中未收录的特性效果。',
        commonTail,
      ].filter(Boolean).join('');
    }
    if (feats.length > 0) {
      return [
        `当前车卡步骤「${label}」。职业：${className || '未选'}。已选 ${feats.length}/${featMax}：${feats.join('、')}。`,
        sorcererNote,
        `请简述已选项倾向；提示选满 ${featMax} 项后将评价整体组合；禁止列出「还应选 XXX」。`,
        commonTail,
      ].filter(Boolean).join('');
    }
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。尚未选择起始特性。`,
      sorcererNote,
      `请说明${poolHint}及选满后才会评价组合；不要预先推销具体特性名称。`,
      commonTail,
    ].filter(Boolean).join('');
  }

  if (step === 2) {
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
      '请结合概览/账本已有熟练（含完整子项名），说明选种族时应优先补什么；不要固定推销某几个种族名；禁止提及兼职或 +6 熟练门槛。',
      commonTail,
    ].join('');
  }

  if (step === 3) {
    const keyPhrase = formatKeyAttrTargetPhrase(char, profile);
    const pb = analyzePointBuy(char);
    if (pb.complete) {
      return [
        `当前车卡步骤「${label}」。职业：${className || '未选'}。用户已完成 32 点购点。`,
        formatPointBuyContext(char),
        `【必须】评价当前加点：${keyPhrase}是否达标、取舍是否合理、与种族/build 契合度；2～3 点；不要替用户改数字。`,
        profile.keyAttrCreateNote ? `注意：${profile.keyAttrCreateNote}` : '',
        commonTail,
      ].filter(Boolean).join('');
    }
    const spent = pb.spent;
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。购点进度 ${spent}/32。`,
      `请结合种族加值说明${keyPhrase}与分配思路；购点满 32 后再评价最终方案。`,
      profile.keyAttrCreateNote ? `注意：${profile.keyAttrCreateNote}` : '',
      commonTail,
    ].filter(Boolean).join('');
  }

  if (step === 4) {
    const warn = ledger.overlapWarnings.length
      ? `优先在开头用 1 句说明：${ledger.overlapWarnings[0].message}`
      : '';
    const skillLine = skills.length
      ? `已选熟练（完整名称）：${skills.join('、')}。`
      : '';
    const syn = formatSkillSynergyContext(char, [
      ...skills,
      ...ledger.profNames.filter((n) => !skills.includes(n)),
    ]);
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。${skillLine}`,
      warn,
      syn,
      '请结合账本：①用完整子项名讨论；②若某属性点高则点出对应熟练协同；③重复熟练说明 trade-off。',
      commonTail,
    ].join('');
  }

  if (step === 5) {
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
      '请结合概览/账本已有熟练（完整子项名）推荐背景方向；重复 grant 须提示 trade-off；禁止提及兼职或 +6 熟练门槛。',
      commonTail,
    ].join('');
  }

  if (step === 6) {
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
      '请结合已选 build 方向简评套装 A/B/C/D 取向；2～3 点。',
      commonTail,
    ].join('');
  }

  if (step === 7) {
    const profileCtx = formatCharacterProfileContext(char);
    if (profileHasContent(char)) {
      return [
        `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
        profileCtx,
        '【必须】对已有背景故事/外貌/个性做简短评价（氛围、与职业背景 build 的契合）；并一句总评 build；勿替用户改写剧情。',
        commonTail,
      ].join('');
    }
    return [
      `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
      profileCtx,
      '请对当前 build 摘要做总评；若用户尚未填写故事/外貌，可鼓励填写后获得叙事简评。',
      commonTail,
    ].join('');
  }

  return [
    `当前车卡步骤「${label}」。职业：${className || '未选'}。`,
    '请根据已选内容与账本给出 2～3 条陪跑建议。',
    commonTail,
  ].join('');
}

/** Extra context blocks appended in retrieve layer */
export function buildChargenExtraContext(snapshot) {
  if (!snapshot?.char) return '';
  const char = snapshot.char;
  const step = snapshot.step ?? 0;
  const ledger = buildChargenLedger(char, { step });
  const parts = [formatLedgerContext(ledger)];
  if (step >= 3) parts.push(formatPointBuyContext(char));
  if (step >= 4) {
    parts.push(formatSkillSynergyContext(char, [
      ...(char.selectedSkills || []),
      ...ledger.profNames,
    ]));
  }
  if (step >= 7) parts.push(formatCharacterProfileContext(char));
  return parts.filter(Boolean).join('\n\n');
}

#!/usr/bin/env node
/**
 * Phase 6 batch 1 (7039) — 将 registry 职业升至 full 档（首版：战士）
 * 用法: node scripts/build-advisor-class-full.mjs [职业名]
 * 不修改 hints 中种族/背景/人工 build 推荐；仅 meta 与 auto 字段。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPanelConst,
  loadPanelWeaponProfs,
} from './advisor-entity-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');
const CHARGEN = path.join(ADVISOR, 'chargen');
const PANEL = path.join(ROOT, '斯诺德跑团', 'panel_data.js');
const REGISTRY = path.join(CHARGEN, 'class_registry.json');
const MULTICLASS = path.join(ADVISOR, 'rules', 'multiclass.json');

const TIER_ORDER = ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶'];

const CLASS_FULL_PROFILES = {
  战士: {
    defaultFullL2MinSkills: 100,
    fpKeyLabel: '力量或敏捷',
    specBuildHints: {
      运动健将: '力量或敏捷型 build 均可；创建页选与主属性一致的一项，配合运动/体操等检定。',
      武器专精: '与主武器类型一致（近战选剑/斧/锤/长柄，远程选弓箭/火器）；专精加成仅对该武器类型生效。',
    },
    styleRoleHints: {
      斗争: '近战正面与徒手连段；力量型常见，可搭配猛击起手。',
      狂攻: '高爆发与火焰/位移；冲锋起手契合突进。',
      防护: '嘲讽、格挡与减伤；盾牌格挡起手契合坦克。',
      射击: '远程稳定输出；瞄准射击起手契合弓/火器线。',
      军团: '团队号令与阵型增益；偏辅助指挥。',
      机敏: '毒/控与投掷；敏捷型常见。',
    },
    chargenAttrDetail: '力量偏向斗争/狂攻/防护近战；敏捷偏向射击/机敏与部分狂攻。运动健将专精应选与主属性相同的一项。',
    combatRules: (className, slug, profile) => [
      {
        id: 'tip-' + slug + '-cr-shield',
        title: '盾牌与格挡反应',
        summary: '持盾且具备盾牌熟练时，可用盾牌格挡等反应减伤；防护/军团线常深化此路线。',
        detail: '起手「盾牌格挡」与防护风格防御姿态、嘲讽等配合；切换武器或弃盾后失去相关反应选项。',
        relatedSkills: ['盾牌格挡', '防御姿态'],
        tags: [className, '盾牌', '反应', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-charge',
        title: '冲锋与借机',
        summary: '冲锋等带位移的战技规划时，注意进入/离开敌人触及的借机风险；迅捷类位移不触发借机。',
        detail: '狂攻线「冲锋」用于接近；脱离时用回避或迅捷位移，避免贴脸多人时盲目穿人。',
        relatedSkills: ['冲锋'],
        tags: [className, '位移', '借机攻击', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-armor',
        title: '重甲与属性',
        summary: '战士可着全部护甲；重甲力量不足时移动受限，高敏低力 build 宜轻中甲。',
        detail: '防护/军团坦克向可选锁链/板甲；机敏/射击高敏 build 常用皮甲或中甲保敏捷加成。以创建页熟练与力量最终值为准。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与战技节奏',
        summary: '战技消耗 FP；多段战技或高 FP 技能需规划回合节奏，避免空 FP 时无应对手段。',
        detail: '一阶技能 FP 通常较低；长战可先低 FP 稳态输出，再交高 FP 爆发。短休/长休回复见基础规则。',
        relatedSkills: ['猛击', '冲锋'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: () => [],
  },
  蛮斗士: {
    defaultFullL2MinSkills: 60,
    fpKeyLabel: '力量',
    specBuildHints: {
      运动健将: '蛮斗士以力量为主；运动健将选力量，配合威力/运动等检定与近战输出。',
    },
    styleRoleHints: {
      斗争: '近战战技与连段；猛击起手常见，偏正面换血。',
      狂暴: '爆发与狂怒相关能力；凶蛮打击、鲜血雷鸣等起手可契合。',
      生机: '生命回复与续航；生命归还起手契合持久作战。',
      法咒: '氏族法术/戏法线；远古魔法补充远程与控场，勿与法师八学派混淆。',
    },
    chargenAttrDetail: '力量≥15 为常见目标；体质配合高 HP 与续航。法咒线仍依赖智力相关法术条目，但关键属性为力量。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-rage',
        title: '狂怒与爆发窗口',
        summary: '狂暴/狂怒类能力有开启与维持成本；在关键回合集中输出，避免空窗期硬顶。',
        detail: '专精「狂怒」与狂暴风格技能联动；爆发前确认 FP 与 HP 能否支撑换血节奏。',
        relatedSkills: ['凶蛮打击', '鲜血雷鸣'],
        tags: [className, '狂暴', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-sustain',
        title: '生机与回复',
        summary: '生机风格与生命归还等能力提供续航；长战优先低 FP 稳态再交高消耗战技。',
        detail: '蛮斗士 HP 成长较高；短休配合生机线可反复入场，但仍须规划 FP。',
        relatedSkills: ['生命归还'],
        tags: [className, '生机', '回复', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-narm',
        title: '轻中甲与无甲',
        summary: '蛮斗士熟练轻甲、中甲与盾牌；无甲防御专精（若选）与不着甲 AC 规则见创建页。',
        detail: '无法使用重甲；中甲保 AC 同时注意敏捷加成上限。盾牌可选但非所有 build 必带。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-spell',
        title: '法咒线定位',
        summary: '法咒风格为氏族魔法/戏法，不是法师八学派；引用须来自 L2 蛮斗士上下文。',
        detail: '法咒与斗争/狂暴可并行投资，但 FP 与技能槽仍有限；优先点亮与属性匹配的低阶节点。',
        relatedSkills: [],
        tags: [className, '法咒', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-tradeoff',
        title: '凶蛮打击的换血',
        summary: '凶蛮打击等对敌我同时造成伤害；确认 HP 余量后再交，配合生机/生命归还。',
        detail: '起手可选凶蛮打击换爆发；勿在已残血时硬开，避免被反杀。',
        relatedSkills: ['凶蛮打击', '生命归还'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与战技节奏',
        summary: '战技与法术均消耗 FP；长战先低 FP 稳态，再交狂暴/高消耗技能。',
        detail: '一阶技能 FP 通常较低；短休/长休回复见基础规则。',
        relatedSkills: ['猛击', '鲜血雷鸣'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/除枪械|不含枪械/.test(refClass?.weapons || '')) {
        rules.push('蛮斗士不熟练枪械；勿推荐火枪/步枪等火器 build。');
      }
      return rules;
    },
  },
};

function classProfile(className) {
  return CLASS_FULL_PROFILES[className] || {
    defaultFullL2MinSkills: 80,
    fpKeyLabel: '关键属性',
    specBuildHints: {},
    styleRoleHints: {},
    chargenAttrDetail: '关键属性购点通常≥15；与战斗风格/武器规划一致。',
    combatRules: (cn, slug) => [{
      id: 'tip-' + slug + '-cr-fp',
      title: 'FP 与技能节奏',
      summary: '技能消耗 FP；规划回合节奏，避免空 FP。',
      detail: '低阶技能优先；长战注意短休/长休回复（见基础规则）。',
      relatedSkills: [],
      tags: [cn, 'FP', 'combat_rule'],
    }],
    extraEquipmentRules: () => [],
  };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function slugFor(className, profile) {
  if (className === '法师') return 'mage';
  return profile.l2Slug;
}

function inferStyleSummary(styleName, skills) {
  const inStyle = skills.filter((s) => s.style === styleName && s.type !== 'starting');
  if (!inStyle.length) return `${styleName}战斗风格（详见职业页技能树）。`;
  const tags = new Set();
  for (const s of inStyle.slice(0, 8)) {
    for (const t of s.tags || []) tags.add(t);
  }
  const tagStr = [...tags].slice(0, 4).join('、');
  return tagStr ? `${styleName}：偏${tagStr}等能力。` : `${styleName}：该风格技能以职业页为准。`;
}

function lowTierSkills(skills, style, limit = 4) {
  return skills
    .filter((s) => s.style === style && s.type !== 'starting')
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    .slice(0, limit);
}

function formatHpFormula(ref, className) {
  const hp = ref?.hp_formula || ref?.hpFormula;
  if (!hp) return null;
  if (typeof hp.first === 'string') return { first: hp.first, levelUp: hp.levelUp || hp.level_up };
  return {
    first: `${hp.first}+体质调整值`,
    levelUp: `每${className}等级+${hp.level_up}+体质调整值`,
  };
}

function formatFpFormula(ref, className, fpKeyLabel) {
  const fp = ref?.fp_formula || ref?.fpFormula;
  if (!fp) return null;
  if (typeof fp.first === 'string') return { first: fp.first, levelUp: fp.levelUp || fp.level_up };
  const key = fpKeyLabel || '关键属性';
  return {
    first: `${fp.first}+${key}调整值`,
    levelUp: `每${className}等级+${fp.level_up}`,
  };
}

function buildFullClassDoc(className, profile, refClass, weaponProfs, index, existing) {
  const slug = slugFor(className, profile);
  const cp = classProfile(className);
  const specHints = cp.specBuildHints || {};
  const styleHints = cp.styleRoleHints || {};
  const skills = index.skills || [];
  const styleNames = Object.keys(index.meta?.facets?.byStyle || {});
  const mcReq = readJson(MULTICLASS).requirements?.find((r) => r.class === className);

  const specNames = profile.specProfChoices?.length
    ? profile.specProfChoices
    : (refClass?.specializations || []).map((s) => s.name);

  const specializations = specNames.map((name) => {
    const ref = (refClass?.specializations || []).find((s) => s.name === name);
    return {
      name,
      effect: ref?.desc || ref?.effect || `创建页专精「${name}」`,
      buildHint: specHints[name] || `创建页专精「${name}」；与主属性/武器规划一致即可。`,
    };
  });

  const combatStyles = styleNames.map((name) => {
    const samples = lowTierSkills(skills, name, 3).map((s) => s.name);
    return {
      name,
      summary: inferStyleSummary(name, skills),
      buildHint: styleHints[name] || inferStyleSummary(name, skills),
      sampleSkills: samples,
    };
  });

  const startingFeatures = (existing?.startingFeatures?.length
    ? existing.startingFeatures
    : (refClass?.starting_features || []).map((s) => ({ name: s.name, desc: s.desc })));

  return {
    meta: {
      layer: 'L1',
      phase: '5-full',
      source: `职业页/数据/${className}.json + REF_CLASSES + ${slug}_index.json`,
      generatedAt: new Date().toISOString().slice(0, 10),
      advisorTier: 'full',
    },
    id: className,
    name: className,
    description: existing?.description || '',
    rolePositioning: existing?.rolePositioning || '',
    roleSummary: existing?.roleSummary || {
      positioning: (existing?.rolePositioning || '').split('、').filter(Boolean),
      blurb: (existing?.description || '').slice(0, 220),
    },
    keyAttr: existing?.keyAttr || refClass?.key_attr || profile.keyAttr,
    armor: existing?.armor || refClass?.armor || '',
    weapons: existing?.weapons || refClass?.weapons || '',
    weaponProfCategories: weaponProfs[className] || [],
    weaponCategoryNote: '创建页武器为具体类型；面板武器熟练类别见 weaponProfCategories（剑类/斧类等为分组）。',
    saves: existing?.saves || refClass?.saves || [],
    skills: existing?.skills || refClass?.skills || '',
    startingFeatures,
    startingChoice: profile.startingFeaturePick ?? refClass?.starting_choice ?? 2,
    hpFormula: formatHpFormula(refClass, className),
    fpFormula: formatFpFormula(refClass, className, cp.fpKeyLabel),
    multiclassRequirements: mcReq || null,
    specializations,
    combatStyles,
  };
}

function buildFullEquipmentRules(className, refClass, weaponProfs) {
  const cp = classProfile(className);
  const armor = refClass?.armor || '全部护甲';
  const weapons = refClass?.weapons || '全部武器';
  const categories = weaponProfs[className] || [];
  const keyRules = [
    '未着装护甲时 AC = 10 + 敏捷调整值。',
    '布衣/皮甲：AC 11 + 敏捷调整值（敏捷加成至多为 2）；布衣有隐匿劣势。',
    '鳞甲/锁甲/链甲等中重甲：敏捷加成受限；具体 AC 与力量需求见基础规则战斗章与创建页。',
  ];
  if (/全部护甲|重甲/.test(armor)) {
    keyRules.push('重甲：力量不足时移动可能受限；着甲休眠规则见基础规则。');
  }
  if (/盾牌/.test(armor)) {
    keyRules.push('盾牌：需持盾且具备盾牌熟练；相关反应类能力须满足持盾条件。');
  }
  keyRules.push(
    '借机攻击：离开敌人触及或单次移动超过三格时，敌人可借机；带「迅捷」位移不触发借机。',
    '创建页护甲熟练：' + armor,
    '创建页武器熟练：' + weapons,
  );
  if (categories.length) {
    keyRules.push('武器熟练类别（面板）：' + categories.join('、') + '。');
  }
  if (/火器/.test(weapons) || categories.includes('火器')) {
    keyRules.push('火器消耗弹药；相邻或超距射击可能有命中劣势（见基础规则）。');
  }
  for (const r of cp.extraEquipmentRules(refClass)) keyRules.push(r);
  return {
    meta: {
      layer: 'L1',
      phase: '5-full',
      class: className,
      source: 'REF_CLASSES + CLASS_WEAPON_PROFS + 全局护甲摘要',
      generatedAt: new Date().toISOString().slice(0, 10),
      advisorTier: 'full',
    },
    allowedArmor: armor.split(/、/).filter(Boolean),
    allowedWeapons: weapons.split(/、/).filter(Boolean),
    weaponProfCategories: categories,
    keyRules,
  };
}

function makeTipBase(className, slug, id, title, kind, extra = {}) {
  return {
    id,
    scope: 'class',
    applicableClasses: [className],
    title,
    kind,
    confidence: 'auto_generated',
    style: extra.style ?? null,
    summary: extra.summary || '',
    detail: extra.detail || '',
    relatedSkills: extra.relatedSkills || [],
    relatedTipIds: [],
    tags: extra.tags || [className],
    skillRefs: (extra.relatedSkills || []).map((name) => ({ name, source: slug })),
    searchText: '',
    ...extra,
  };
}

function finalizeTip(tip) {
  tip.searchText = [
    tip.title,
    tip.kind,
    tip.confidence,
    tip.summary,
    tip.detail,
    ...(tip.tags || []),
    ...(tip.relatedSkills || []),
  ].filter(Boolean).join(' ');
  return tip;
}

function buildFullTips(className, profile, hints, index) {
  const slug = slugFor(className, profile);
  const cp = classProfile(className);
  const styleHints = cp.styleRoleHints || {};
  const specHints = cp.specBuildHints || {};
  const skills = index.skills || [];
  const tips = [];
  const pick = profile.startingFeaturePick ?? 2;

  for (const style of hints?.styleHints || []) {
    const samples = (style.sampleSkills || lowTierSkills(skills, style.name, 3).map((s) => s.name)).slice(0, 4);
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-style-' + style.name,
      className + '·' + style.name + '风格',
      'style_guide',
      {
        style: style.name,
        summary: style.summary,
        detail: [
          styleHints[style.name] || '',
          samples.length ? ('低阶代表：' + samples.join('、') + '。') : '',
          '顾问自动摘要（非官方连招）；数值与前置以规则书/创建页为准。',
        ].filter(Boolean).join(''),
        relatedSkills: samples,
        tags: [className, style.name, '战斗风格', 'style_guide'],
      },
    )));
  }

  for (const style of hints?.styleHints || []) {
    const low = lowTierSkills(skills, style.name, 3);
    const starting = skills.filter((s) => s.style === style.name && s.type === 'starting');
    const names = [...starting, ...low].map((s) => s.name).slice(0, 4);
    if (!names.length) continue;
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-prio-' + style.name,
      style.name + ' 1～3 阶优先',
      'tactic',
      {
      style: style.name,
      summary: style.name + '线前三级可优先：' + names.join('、') + '；与起手特性/专精规划一致再扩展。',
      detail: className + ' ' + style.name + ' 风格在 L2 索引中一～三阶技能较多；车卡后优先点亮与武器/属性匹配的 low-tier 节点。' + (styleHints[style.name] || ''),
      relatedSkills: names,
      tags: [className, style.name, '优先学', 'tactic'],
    })));
  }

  for (const feat of skills.filter((s) => s.type === 'starting')) {
    const featStyle = feat.style || '起手';
    const pick = profile.startingFeaturePick ?? 2;
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-start-' + feat.name,
      '起手·' + feat.name,
      'tactic',
      {
        style: feat.style,
        summary: feat.name + '（' + featStyle + '）：' + String(feat.summary || '').slice(0, 80),
        detail: className + ' 4 选 ' + pick + ' 起手特性之一。' + (feat.summary || '') + ' 与后续 ' + featStyle + ' 风格技能可形成初期连招，但非强制绑定。',
        relatedSkills: [feat.name],
        tags: [className, '起手特性', '车卡', 'tactic'],
      },
    )));
  }

  const combatRules = cp.combatRules(className, slug, profile);
  for (const cr of combatRules) {
    tips.push(finalizeTip(makeTipBase(className, slug, cr.id, cr.title, 'combat_rule', cr)));
  }

  tips.push(finalizeTip(makeTipBase(
    className,
    slug,
    'tip-' + slug + '-chargen-attr',
    className + '关键属性',
    'chargen',
    {
      summary: (profile.keyAttr || hints?.primaryAttr?.name) + '：创建购点通常至少一项≥15，与主武器/战斗风格一致。',
      detail: cp.chargenAttrDetail,
      tags: [className, '车卡', '属性', 'chargen'],
    },
  )));

  tips.push(finalizeTip(makeTipBase(
    className,
    slug,
    'tip-' + slug + '-chargen-spec',
    className + '专精选择',
    'chargen',
    {
      summary: '创建页专精：' + ((profile.specProfChoices || []).join('、') || '见创建页') + '；与武器与风格规划一致即可。',
      detail: Object.entries(specHints).map(([k, v]) => k + '：' + v).join(' '),
      tags: [className, '车卡', '专精', 'chargen'],
    },
  )));

  return {
    meta: {
      layer: 'L5',
      phase: '5-full',
      targetClass: className,
      tier: 'full',
      status: 'auto_generated',
      count: tips.length,
      byKind: tips.reduce((acc, t) => {
        acc[t.kind] = (acc[t.kind] || 0) + 1;
        return acc;
      }, {}),
      note: 'full 档由 build-advisor-class-full.mjs 从 L2 索引与 REF 生成；可人工覆盖',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    tips,
  };
}

function patchHintsForFull(className, hints) {
  const cp = classProfile(className);
  const specHints = cp.specBuildHints || {};
  const next = { ...hints };
  next.meta = {
    ...next.meta,
    phase: '5-full',
    tier: 'full',
    status: 'auto',
    note: '战斗风格摘要为 auto；种族/背景/build 推荐待人工补充',
  };
  next.specializationHints = (next.specializationHints || []).map((s) => ({
    ...s,
    buildHint: specHints[s.name] || s.buildHint,
  }));
  next.chargenTips = [
    className + ' full 档：可检索 L2 技能名、战斗风格与 L5 小贴士；标识/进阶以规则书与 DM 为准。',
  ];
  delete next.advisorPartialNote;
  return next;
}

function patchRegistry(className, profile, slug, options = {}) {
  const reg = readJson(REGISTRY);
  const row = reg.classes[className];
  if (!row) throw new Error(`Unknown class: ${className}`);
  const cp = classProfile(className);
  row.tier = 'full';
  row.promptProfile = slug + '_skills';
  row.fullL2MinSkills = profile.fullL2MinSkills ?? cp.defaultFullL2MinSkills ?? 80;
  row.l5MinTips = profile.l5MinTips ?? 20;
  delete row.advisorNote;
  if (options.registryMeta) {
    reg.meta = { ...reg.meta, ...options.registryMeta };
  }
  writeJson(REGISTRY, reg);
}

export function buildClassFull(className, options = {}) {
  const root = options.root || ROOT;
  const reg = readJson(path.join(root, 'advisor/chargen/class_registry.json'));
  const profile = reg.classes[className];
  if (!profile?.l2Slug) throw new Error(`No l2Slug for ${className}`);

  const slug = slugFor(className, profile);
  const refClasses = loadPanelConst(path.join(root, '斯诺德跑团/panel_data.js'), 'REF_CLASSES');
  const weaponProfs = loadPanelWeaponProfs(path.join(root, '斯诺德跑团/panel_data.js'));
  const refClass = refClasses[className];
  const indexPath = path.join(root, 'advisor/skills', `${slug}_index.json`);
  const index = readJson(indexPath);
  const existingClass = readJson(path.join(root, 'advisor/chargen', `${slug}_class.json`));
  const hintsPath = path.join(root, 'advisor/chargen/hints', `${className}.json`);
  const hints = readJson(hintsPath);

  const classDoc = buildFullClassDoc(className, profile, refClass, weaponProfs, index, existingClass);
  writeJson(path.join(root, 'advisor/chargen', `${slug}_class.json`), classDoc);

  const equipRules = buildFullEquipmentRules(className, refClass, weaponProfs);
  writeJson(path.join(root, 'advisor/chargen', `${slug}_equipment_rules.json`), equipRules);

  const hintsFull = patchHintsForFull(className, hints);
  writeJson(hintsPath, hintsFull);

  const tipsDoc = buildFullTips(className, profile, hintsFull, index);
  writeJson(path.join(root, 'advisor/combos/class_tips', `${className}.json`), tipsDoc);

  patchRegistry(className, profile, slug, options);

  return {
    className,
    slug,
    skillCount: index.meta?.count || index.skills?.length || 0,
    tipsCount: tipsDoc.tips.length,
    styles: classDoc.combatStyles.length,
  };
}

function main() {
  const className = process.argv[2] || '战士';
  const result = buildClassFull(className);
  console.log(`OK ${result.className} → full`);
  console.log(`  skills: ${result.skillCount}, styles: ${result.styles}, tips: ${result.tipsCount}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

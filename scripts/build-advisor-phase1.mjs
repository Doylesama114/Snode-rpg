#!/usr/bin/env node
/**
 * Build Advisor — Phase 1 + 1.5: extract L0 rules + L1 chargen + status conditions JSON.
 * Run: node scripts/build-advisor-phase1.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStatusConditions } from './advisor-status-extract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_RULES = path.join(ROOT, 'advisor', 'rules');
const OUT_CHARGEN = path.join(ROOT, 'advisor', 'chargen');

const PANEL_DATA = path.join(ROOT, '斯诺德跑团', 'panel_data.js');
const RACES_DATA = path.join(ROOT, '职业页', '数据', 'races_data.js');
const HELP_HTML = path.join(ROOT, '斯诺德跑团', '帮助.html');

function loadPanelConst(name) {
  const text = fs.readFileSync(PANEL_DATA, 'utf8');
  const marker = `const ${name} = JSON.parse('`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name} in panel_data.js`);
  let i = start + marker.length;
  let raw = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === "'") {
      raw += "'";
      i += 2;
      continue;
    }
    if (c === "'") break;
    raw += c;
    i++;
  }
  return JSON.parse(raw);
}

function loadRaces() {
  const text = fs.readFileSync(RACES_DATA, 'utf8');
  const m = text.match(/var RACES = (\[[\s\S]*\]);/);
  if (!m) throw new Error('RACES not found in races_data.js');
  return JSON.parse(m[1]);
}

/** Parse help.html main-class leveling table rows (authoritative XP). */
function enrichLevelSpecial(row) {
  if (row.special === 'lowest_attr' || row.lowest_attr_gain != null) return row;
  if (row.other?.includes('最低的一项提升2点')) {
    return { ...row, special: 'lowest_attr', lowest_attr_gain: 2 };
  }
  if (row.other?.includes('特殊专长')) {
    return { ...row, special: 'feat' };
  }
  return row;
}

function parseHelpMainLeveling() {
  const html = fs.readFileSync(HELP_HTML, 'utf8');
  const section = html.match(/id="s3"[\s\S]*?<h3>子职业<\/h3>/);
  if (!section) throw new Error('升级规则 section not found in 帮助.html');
  const rows = [...section[0].matchAll(
    /<tr><td[^>]*><b>LV\.(\d+)<\/b><\/td><td[^>]*>(\d+)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>(\d+)<\/td><td>([^<]*)<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><td>([^<]*)<\/td><\/tr>/g
  )];
  return rows.map((r) => ({
    level: Number(r[1]),
    xp: Number(r[2]),
    proficiency: r[3].trim() === '-' ? null : Number(r[3]),
    attr_gain: r[4].trim() === '-' || r[4].trim() === '' ? null : Number(r[4]),
    skill_slots: Number(r[5]),
    other: r[6].trim(),
    attr_cap: Number(r[7]),
    prof_cap: Number(r[8]),
    rank: r[9].trim() || null,
  }));
}

function parseHelpSubLeveling() {
  const html = fs.readFileSync(HELP_HTML, 'utf8');
  const section = html.match(/<h3>子职业<\/h3>[\s\S]*?id="s4"/);
  if (!section) throw new Error('子职业 section not found in 帮助.html');
  const rows = [...section[0].matchAll(
    /<tr><td[^>]*><b>LV\.(\d+)<\/b><\/td><td[^>]*>(\d+)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>(\d+)<\/td><td>([^<]*)<\/td><\/tr>/g
  )];
  return rows.map((r) => ({
    level: Number(r[1]),
    xp: Number(r[2]),
    proficiency: r[3].trim() === '-' ? null : Number(r[3]),
    attr_gain: r[4].trim() === '-' || r[4].trim() === '' ? null : Number(r[4]),
    skill_slots: Number(r[5]),
    other: r[6].trim(),
  }));
}

const CLASS_SHORT = {
  蛮斗士: '蛮', 战士: '战', 法师: '法', 猎人: '猎', 牧师: '牧', 圣骑士: '圣',
  游荡者: '游', 德鲁伊: '德', 萨满祭司: '萨', 术士: '术', 武僧: '武',
  吟游诗人: '诗', 魔契师: '魔', 奇械师: '械',
};

function parseMulticlassFromHelp() {
  const html = fs.readFileSync(HELP_HTML, 'utf8');
  const section = html.match(/id="s4"[\s\S]*?<h3>职业兼容性<\/h3>/);
  if (!section) throw new Error('兼职规则 section not found');

  const reqRows = [...section[0].matchAll(
    /<tr><td><b>([^<]+)<\/b><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g
  )];
  const requirements = reqRows.map((r) => ({
    class: r[1].trim(),
    attrRequired: r[2].trim() === '-' ? null : r[2].trim(),
    profRequired: r[3].trim() === '-' ? null : r[3].trim(),
    otherRequired: r[4].trim() === '-' ? null : r[4].trim(),
    incompatibleWith: r[5].trim() === '—' || r[5].trim() === '-' ? [] : r[5].split('、').map((s) => s.trim()).filter(Boolean),
  }));

  const compatSection = html.match(/<h3>职业兼容性<\/h3>[\s\S]*?<\/table>/);
  if (!compatSection) throw new Error('职业兼容性 table not found');
  const compatRows = [...compatSection[0].matchAll(
    /<tr><td style="font-weight:bold">([^<]+)<\/td>((?:<td[^>]*>[^<]*<\/td>){14})<\/tr>/g
  )];
  const classOrder = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司', '术士', '武僧', '吟游诗人', '魔契师', '奇械师'];
  const compatibility = {};
  for (const row of compatRows) {
    const main = row[1].trim();
    const cells = [...row[2].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((c) => c[1].trim());
    const subs = {};
    classOrder.forEach((cls, i) => {
      const v = cells[i];
      subs[cls] = v === '✓' ? true : v === '✗' ? false : null;
    });
    compatibility[main] = subs;
  }

  return { requirements, compatibility, classOrder, classShort: CLASS_SHORT };
}

function parseBackgroundSkills(baseSkills, profSkills) {
  const skills = new Set();
  const addTokens = (s) => {
    if (!s || s === '无') return;
    s.split(/[、，,]/).forEach((t) => {
      const x = t.trim();
      if (x && x !== '无') skills.add(x);
    });
  };
  addTokens(baseSkills);
  addTokens(profSkills);
  return [...skills];
}

function buildMageHints(races, backgrounds, mageClass, multiclass) {
  const mageCompat = multiclass.compatibility['法师'] || {};
  const compatibleSubs = Object.entries(mageCompat)
    .filter(([, ok]) => ok === true)
    .map(([name]) => name);

  const intPositive = races
    .filter((r) => typeof r.intBonus === 'number' && r.intBonus > 0)
    .map((r) => ({
      name: r.name,
      intBonus: r.intBonus,
      note: r.intBonus >= 2 ? '高智力加值，车卡友好' : '智力加值',
    }))
    .sort((a, b) => b.intBonus - a.intBonus);

  const intNegative = races
    .filter((r) => typeof r.intBonus === 'number' && r.intBonus < 0)
    .map((r) => ({ name: r.name, intBonus: r.intBonus, note: '智力减值，需额外属性点补偿' }));

  const mageSkillKeywords = ['逻辑', '奥秘', '知识'];
  const bgForMage = backgrounds
    .map((bg) => {
      const skills = bg.skills || [];
      const hits = mageSkillKeywords.filter((k) => skills.some((s) => s.includes(k)));
      return { ...bg, mageSkillHits: hits, score: hits.length };
    })
    .filter((bg) => bg.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    meta: {
      layer: 'L1',
      targetClass: '法师',
      version: '1.0.0',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    primaryAttr: {
      name: '智力',
      targetAtCreation: 15,
      reason: '法师本职与奇械师兼职均要求智力 15',
    },
    classRequirements: {
      attr: mageClass.multiclassRequirements?.attrRequired || '智力属性15',
      prof: mageClass.multiclassRequirements?.profRequired || '拥有奥秘、知识和逻辑的熟练度共计+6',
      other: mageClass.multiclassRequirements?.otherRequired || '拥有系统性学习的魔法传承',
      keyAttr: mageClass.key_attr,
      saves: mageClass.saves,
      skillPickRule: mageClass.skills,
    },
    recommendedRaces: {
      high: intPositive.slice(0, 8),
      caution: intNegative,
    },
    recommendedBackgrounds: bgForMage.slice(0, 12).map((bg) => ({
      name: bg.name,
      skills: bg.skills,
      mageSkillHits: bg.mageSkillHits,
      description: bg.description,
    })),
    multiclassAsMain: {
      unlockLevel: 7,
      compatibleSubclasses: compatibleSubs,
      incompatibleSubclasses: Object.entries(mageCompat).filter(([, ok]) => ok === false).map(([n]) => n),
      notable: [
        { class: '奇械师', note: '同样需智力15与巧手/知识/逻辑熟练+6，偏工程奇械' },
        { class: '魔契师', note: '魅力14与表演/神秘学向，与法师智力主属性分流' },
        { class: '吟游诗人', note: '魅力14，社交向兼职' },
      ],
    },
    advisorNotes: [
      '1 级起优先将智力点至 15，再分配其余属性。',
      '背景与职业熟练选择应覆盖逻辑、奥秘、知识三项，合计 +6。',
      '带色彩标识的高阶技能需 DM 团队结算标识，顾问不得默认已获得。',
    ],
  };
}

function buildSpMarks() {
  return {
    meta: {
      layer: 'L0',
      rulesVersion: '26.06.30',
      source: ['斯诺德跑团/panel_engine.js', '项目文档.md'],
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    spPoints: {
      field: 'sp_points',
      description: '数值型技能点；默认学 1 个带标识的技能/天赋消耗 1 SP（除非该条目另有说明）。',
      learnCost: 1,
      refundOnUnlearn: true,
    },
    colorMarks: {
      field: 'color_marks',
      description: '14 种标识持有状态；学习技能时消耗对应色彩标识（可含 wildcard）。',
      allMarkNames: ['橙色', '白色', '紫色', '黄色', '无色', '蓝色', '青色', '黑色', '红色', '棕色', '粉色', '绿色', '浅色', '炫彩'],
      chromaticMarkNames: ['橙色', '白色', '紫色', '黄色', '蓝色', '青色', '黑色', '红色', '棕色', '粉色', '绿色', '浅色'],
      wildcards: ['无色', '炫彩'],
      wildcardRule: '无色或炫彩标识可替代任意一种固定色标识（各消耗 1 个 wildcard 计数）。',
    },
    dmSettlement: {
      required: true,
      description: '标识与额外 SP 由 DM 团队根据模组/游玩结算发放；面板不自动执行「游玩结束授予标识」类技能效果。',
      advisorRule: '回答中不得假设玩家已持有某色彩标识，除非 characterSnapshot.color_marks 为 true。',
    },
    milestonesRelated: [
      { level: 3, note: '解锁第三阶天赋树（另需 50 经验值门槛）' },
      { level: 4, note: '获取一项特殊专长' },
      { level: 5, note: '开启主职业三条进阶途径' },
      { level: 7, note: '允许兼职（须满足子职门槛且职业兼容）' },
    ],
  };
}

function buildRulesSummary() {
  return {
    meta: { layer: 'L0', version: '1.0.0' },
    bullets: [
      '斯诺德跑团规则与 D&D 不同，顾问不得套用 D&D 法术位/短休长休等概念。',
      '学 1 个带标识技能通常消耗 1 sp_points 与对应 color_marks。',
      '主职 7 级可兼职 1 个兼容基础职业；子职等级上限 = 主职等级 - 5。',
      '主职 5 级开启三条进阶途径；子职 11 级开启子职进阶。',
      '4 / 8 / 13 级各获取一项特殊专长（主职表）。',
      '进阶具体技能树未全面入库前，仅提供门槛与名称方向推测（须标注置信度）。',
      '控场/异常 build 须引用 status_conditions.json 中状态定义，不得仅凭状态名称猜测效果。',
      '专注效果在施展者进入惑控或失能状态时中断；控场 build 可针对敌方施法者使用沉默等。',
    ],
  };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  ensureDir(OUT_RULES);
  ensureDir(OUT_CHARGEN);

  const refLevelup = loadPanelConst('REF_LEVELUP');
  const refBackgrounds = loadPanelConst('REF_BACKGROUNDS');
  const refClasses = loadPanelConst('REF_CLASSES');
  const racesRaw = loadRaces();
  const helpMain = parseHelpMainLeveling();
  const helpSub = parseHelpSubLeveling();
  const multiclass = parseMulticlassFromHelp();

  // Leveling: help.html XP is authoritative; merge panel fields
  const panelMainByLevel = Object.fromEntries(refLevelup.main_class.levels.map((l) => [l.level, l]));
  const mainLevels = helpMain.map((h) => {
    const p = panelMainByLevel[h.level] || {};
    const xpMismatch = p.xp != null && p.xp !== h.xp;
    return enrichLevelSpecial({
      ...h,
      ...(p.rank && !h.rank ? { rank: p.rank } : {}),
      _source: xpMismatch ? { xpFrom: '帮助.html', panelXp: p.xp } : { xpFrom: '帮助.html' },
    });
  });

  const panelSubByLevel = Object.fromEntries(refLevelup.sub_class.levels.map((l) => [l.level, l]));
  const subLevels = helpSub.map((h) => ({ ...h, _source: { xpFrom: '帮助.html' } }));

  const leveling = {
    meta: {
      layer: 'L0',
      version: '1.0.0',
      sources: ['斯诺德跑团/帮助.html', '斯诺德跑团/panel_data.js → REF_LEVELUP'],
      generatedAt: new Date().toISOString().slice(0, 10),
      notes: [
        '主职经验值以 帮助.html 为准（panel_data 中 LV.5 xp=20300 为已知笔误，已忽略）。',
        '子职：主职 7 级解锁；等级上限 = 主职 - 5；附赠职业上限 5 级（剧情获取）。',
      ],
    },
    mainClass: { levels: mainLevels },
    subClass: {
      unlockRule: '主职业 7 级解锁兼职',
      levelCapRule: '子职业等级上限 = 主职业等级 - 5',
      bonusClassCap: 5,
      bonusClassNote: '附赠职业通过剧情获取，上限 5 级',
      levels: subLevels,
    },
    featMilestones: mainLevels
      .filter((l) => l.other && l.other.includes('特殊专长'))
      .map((l) => ({ level: l.level, reward: l.other })),
    advancementMilestones: [
      { level: 5, scope: 'main', reward: '开启主职业的三条进阶职业途径' },
      { level: 11, scope: 'sub', reward: '开启子职业的三条进阶职业途径' },
    ],
    talentTierUnlocks: mainLevels
      .filter((l) => l.other && l.other.includes('天赋树'))
      .map((l) => ({ level: l.level, reward: l.other })),
  };

  const mageReq = multiclass.requirements.find((r) => r.class === '法师');
  const mageClassRaw = refClasses['法师'];
  const mageClass = {
    id: '法师',
    name: '法师',
    keyAttr: mageClassRaw.key_attr,
    armor: mageClassRaw.armor,
    weapons: mageClassRaw.weapons,
    saves: mageClassRaw.saves,
    skills: mageClassRaw.skills,
    startingFeatures: mageClassRaw.starting_features,
    startingChoice: mageClassRaw.starting_choice,
    hpFormula: mageClassRaw.hp_formula,
    fpFormula: mageClassRaw.fp_formula,
    multiclassRequirements: mageReq,
  };

  const backgrounds = Object.values(refBackgrounds).map((bg) => {
    const skills = parseBackgroundSkills(bg.base_skills, bg.prof_skills);
    return {
      id: bg.id,
      name: bg.name,
      hpBonus: bg.hp_bonus,
      baseSkills: bg.base_skills,
      profSkills: bg.prof_skills,
      skills,
      other: bg.other,
      funds: bg.funds,
      equipment: bg.equipment,
      description: (bg.description || '').replace(/\\n/g, '\n'),
    };
  });

  const races = racesRaw.map((r) => ({
    name: r.name,
    description: r.description,
    attrBonus: r['属性加成'],
    hpBonus: r['生命值加成'],
    moveSpeed: r['基础移动力'],
    size: r['体型'],
    lifespan: r['寿命'],
    traits: (r['特性'] || []).map((t) => ({ name: t.name, desc: t.desc })),
    intBonus: typeof r['属性加成']?.['智力'] === 'number' ? r['属性加成']['智力'] : null,
  }));

  writeJson(path.join(OUT_RULES, 'leveling.json'), leveling);
  writeJson(path.join(OUT_RULES, 'multiclass.json'), {
    meta: {
      layer: 'L0',
      version: '1.0.0',
      source: '斯诺德跑团/帮助.html §兼职',
      generatedAt: new Date().toISOString().slice(0, 10),
      mainClassUnlockLevel: 7,
    },
    requirements: multiclass.requirements,
    compatibility: multiclass.compatibility,
    classOrder: multiclass.classOrder,
    classShort: multiclass.classShort,
    mageAsMain: {
      compatibleSubclasses: Object.entries(multiclass.compatibility['法师'] || {})
        .filter(([, ok]) => ok === true)
        .map(([n]) => n),
      incompatibleSubclasses: mageReq?.incompatibleWith || [],
    },
  });
  writeJson(path.join(OUT_RULES, 'sp_marks.json'), buildSpMarks());
  writeJson(path.join(OUT_RULES, 'rules_summary.json'), buildRulesSummary());
  const statusConditions = buildStatusConditions(HELP_HTML);
  writeJson(path.join(OUT_RULES, 'status_conditions.json'), statusConditions);
  writeJson(path.join(OUT_CHARGEN, 'races.json'), {
    meta: { layer: 'L1', count: races.length, source: '职业页/数据/races_data.js', generatedAt: new Date().toISOString().slice(0, 10) },
    races,
  });
  writeJson(path.join(OUT_CHARGEN, 'backgrounds.json'), {
    meta: { layer: 'L1', count: backgrounds.length, source: '斯诺德跑团/panel_data.js → REF_BACKGROUNDS', generatedAt: new Date().toISOString().slice(0, 10) },
    backgrounds,
  });
  writeJson(path.join(OUT_CHARGEN, 'mage_class.json'), {
    meta: { layer: 'L1', source: '斯诺德跑团/panel_data.js → REF_CLASSES.法师 + 帮助.html', generatedAt: new Date().toISOString().slice(0, 10) },
    ...mageClass,
  });
  writeJson(path.join(OUT_CHARGEN, 'mage_hints.json'), buildMageHints(races, backgrounds, mageClass, multiclass));

  console.log('Phase 1 + 1.5 build complete:');
  console.log('  races:', races.length);
  console.log('  backgrounds:', backgrounds.length);
  console.log('  main levels:', mainLevels.length);
  console.log('  sub levels:', subLevels.length);
  console.log('  multiclass reqs:', multiclass.requirements.length);
  console.log('  status conditions:', statusConditions.meta.conditionCount);
}

main();

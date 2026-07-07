/**
 * Phase 2 — load entity data from game sources (创建页 / panel_data / races_data).
 */
import fs from 'fs';
import path from 'path';

const ATTR_KEYS = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运'];
const MAGE_SKILL_KEYWORDS = ['逻辑', '奥秘', '知识', '专注'];

export function loadPanelConst(panelDataPath, name) {
  const text = fs.readFileSync(panelDataPath, 'utf8');
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

export function loadPanelWeaponProfs(panelDataPath) {
  const text = fs.readFileSync(panelDataPath, 'utf8');
  const m = text.match(/var CLASS_WEAPON_PROFS=(\{[^;]+\});/);
  if (!m) return {};
  return JSON.parse(m[1]);
}

export function loadRacesData(racesDataPath) {
  const text = fs.readFileSync(racesDataPath, 'utf8');
  const m = text.match(/var RACES = (\[[\s\S]*\]);/);
  if (!m) throw new Error('RACES not found in races_data.js');
  return JSON.parse(m[1]);
}

export function loadClassesData(classesDataPath) {
  const text = fs.readFileSync(classesDataPath, 'utf8');
  let CLASSES = [];
  // eslint-disable-next-line no-eval
  eval(text);
  return CLASSES;
}

export function parseCharCreationBgSkillMaps(charCreationHtmlPath) {
  const html = fs.readFileSync(charCreationHtmlPath, 'utf8');
  const mapBlock = html.match(/var BG_SKILL_MAP = (\{[\s\S]*?\});/);
  const catBlock = html.match(/var BG_SKILL_CATS = (\{[\s\S]*?\});/);
  const proBlock = html.match(/var BG_PRO_MAP = (\{[\s\S]*?\});/);
  if (!mapBlock || !catBlock) throw new Error('BG_SKILL_MAP / BG_SKILL_CATS not found in 角色创建页.html');
  // eslint-disable-next-line no-eval
  const BG_SKILL_MAP = eval(`(${mapBlock[1]})`);
  // eslint-disable-next-line no-eval
  const BG_SKILL_CATS = eval(`(${catBlock[1]})`);
  const BG_PRO_MAP = proBlock ? eval(`(${proBlock[1]})`) : {};
  return { BG_SKILL_MAP, BG_SKILL_CATS, BG_PRO_MAP };
}

function splitSkillTokens(s) {
  if (!s || s === '无') return [];
  return s.split(/[、，,]/).map((x) => x.trim()).filter(Boolean);
}

function mapTokenToSkill(token, maps) {
  const mapped = maps.BG_SKILL_MAP[token];
  if (!mapped) return token;
  if (mapped === 'cat') return null;
  const dot = mapped.indexOf('.');
  return dot >= 0 ? mapped.slice(dot + 1) : mapped;
}

function categoryGrant(category, count, maps) {
  const cat = maps.BG_SKILL_CATS[category];
  return {
    kind: 'choice_from_category',
    category,
    count,
    attribute: cat?.attr || null,
    options: cat?.opts || [],
    label: count > 1 ? `任选${count}项${category}子项` : `任选1项${category}子项`,
  };
}

/**
 * Parse background skill grants (aligned with 角色创建页 renderBgProfs / apply).
 */
export function parseBackgroundSkillGrants(baseSkills, profSkills, other, maps) {
  const grants = [];
  const baseText = (baseSkills || '').trim();
  const profText = (profSkills || '').trim();
  const otherText = (other || '').trim();

  if (baseText && baseText !== '无') {
    if (/任选两项知识/.test(baseText)) {
      grants.push(categoryGrant('知识', 2, maps));
    } else if (/任选一项基础熟练/.test(baseText) || baseText === '任选一项熟练度') {
      grants.push({
        kind: 'choice_one',
        count: 1,
        scope: 'any_basic',
        label: '任选一项基础熟练度（全属性技能池）',
      });
    } else {
      for (const token of splitSkillTokens(baseText)) {
        if (token === '任选两项知识') continue;
        const catMatch = token.match(/^任选(?:一|两|三)?项?(奥秘|知识|运动|巧手|表演)$/);
        if (catMatch) {
          grants.push(categoryGrant(catMatch[1], 1, maps));
          continue;
        }
        if (maps.BG_SKILL_MAP[token] === 'cat') {
          grants.push(categoryGrant(token, 1, maps));
          continue;
        }
        const skill = mapTokenToSkill(token, maps);
        if (skill) grants.push({ kind: 'fixed', skills: [skill], label: token });
      }
    }
  }

  if (profText && profText !== '无') {
    if (/任选/.test(profText)) {
      grants.push({
        kind: 'free_text',
        field: 'professional',
        label: profText,
      });
    } else {
      for (const token of splitSkillTokens(profText)) {
        if (maps.BG_PRO_MAP[token] != null) {
          grants.push({ kind: 'fixed_professional', skills: [token], label: token });
        } else {
          grants.push({ kind: 'fixed_professional', skills: [token], label: token });
        }
      }
    }
  }

  if (/任选两门语言/.test(otherText)) {
    grants.push({ kind: 'choice_language', count: 2, label: '任选两门语言' });
  } else if (/任选一门语言/.test(otherText)) {
    grants.push({ kind: 'choice_language', count: 1, label: '任选一门语言' });
  }
  if (/任选两门乐器/.test(otherText)) {
    grants.push({ kind: 'note', label: '任选两门乐器（创建页自选）' });
  }
  if (/任选一种赌具/.test(otherText)) {
    grants.push({ kind: 'note', label: '任选一种赌具（创建页自选）' });
  }

  return grants;
}

export function flattenSkillGrants(grants) {
  const skills = new Set();
  for (const g of grants || []) {
    if (g.skills) g.skills.forEach((s) => skills.add(s));
    if (g.kind === 'fixed' || g.kind === 'fixed_professional') {
      (g.skills || []).forEach((s) => skills.add(s));
    }
  }
  return [...skills];
}

export function computeMageSkillHits(skills, grants) {
  const flat = new Set([...(skills || []), ...flattenSkillGrants(grants)]);
  for (const g of grants || []) {
    if (g.category === '奥秘' || g.category === '知识') {
      flat.add(g.category);
    }
  }
  return MAGE_SKILL_KEYWORDS.filter((k) => [...flat].some((s) => s.includes(k)));
}

export function normalizeRaceFromSource(race) {
  const attrBonus = {};
  const raw = race['属性加成'] || race.attrBonus || {};
  for (const k of ATTR_KEYS) attrBonus[k] = raw[k] ?? 0;
  const traits = (race['特性'] || race.traits || []).map((t) => ({
    name: t.name,
    desc: t.desc || t.description || '',
  }));
  return {
    name: race.name,
    description: race.description || race['描述'] || '',
    attrBonus,
    traits,
    hpBonus: race['生命值加成'] ?? race.hpBonus ?? 0,
    moveSpeed: race['基础移动力'] || race.moveSpeed || null,
    size: race['体型'] || race.size || null,
    lifespan: race['寿命'] || race.lifespan || null,
    intBonus: attrBonus['智力'] ?? null,
  };
}

export function normalizeBackgroundFromSource(bg, maps, xlsxExtra = null) {
  const baseSkills = bg.base_skills || bg.baseSkills || xlsxExtra?.baseSkills || '';
  const profSkills = bg.prof_skills || bg.profSkills || xlsxExtra?.profSkills || '无';
  const other = bg.other || xlsxExtra?.other || '无';
  const skillGrants = parseBackgroundSkillGrants(baseSkills, profSkills, other, maps);
  const skills = [
    ...new Set([
      ...flattenSkillGrants(skillGrants),
      ...splitSkillTokens(baseSkills).filter((t) => !/任选/.test(t)),
      ...splitSkillTokens(profSkills).filter((t) => t !== '无' && !/任选/.test(t)),
    ]),
  ].filter(Boolean);

  let languageChoiceCount = 0;
  if (/任选两门语言/.test(other)) languageChoiceCount = 2;
  else if (/任选一门语言/.test(other)) languageChoiceCount = 1;

  return {
    id: bg.id || bg.name,
    name: bg.name,
    hpBonus: bg.hp_bonus ?? bg.hpBonus ?? xlsxExtra?.hpBonus ?? null,
    baseSkills,
    profSkills,
    other: other === '无' ? null : other,
    funds: bg.funds || xlsxExtra?.funds || null,
    equipment: bg.equipment || xlsxExtra?.equipment || xlsxExtra?.equipmentList || null,
    description: (xlsxExtra?.intro || bg.description || '').replace(/\\n/g, '\n').trim(),
    traitName: xlsxExtra?.traitName || null,
    skills,
    skillGrants,
    languageChoiceCount,
    mageSkillHits: computeMageSkillHits(skills, skillGrants),
  };
}

export function normalizeClassFromSource(refClass, classesRow, weaponProfs, slugClassJson = null) {
  const mc = slugClassJson || {};
  const name = refClass.name || refClass.id || mc.name;
  const savesRaw = refClass.saves || classesRow?.['豁免'] || mc.saves;
  const saves = Array.isArray(savesRaw)
    ? savesRaw
    : String(savesRaw || '').split(/、/).map((s) => s.trim()).filter(Boolean);

  return {
    id: name,
    name,
    description: classesRow?.description || mc.description || refClass.description || '',
    rolePositioning: classesRow?.['职责定位'] || mc.rolePositioning || '',
    keyAttr: refClass.key_attr || classesRow?.['关键属性'] || mc.keyAttr || '',
    armor: refClass.armor || classesRow?.['护甲'] || mc.armor || '',
    weapons: refClass.weapons || classesRow?.['武器'] || mc.weapons || '',
    weaponProfCategories: weaponProfs[name] || mc.weaponProfCategories || [],
    weaponCategoryNote: mc.weaponCategoryNote || null,
    saves,
    skills: refClass.skills || classesRow?.['技巧'] || mc.skills || '',
    hpFormula: mc.hpFormula || {
      first: refClass.hp_formula?.first ? String(refClass.hp_formula.first) : undefined,
      levelUp: refClass.hp_formula?.levelUp ? String(refClass.hp_formula.levelUp) : undefined,
    },
    fpFormula: mc.fpFormula || {
      first: refClass.fp_formula?.first ? String(refClass.fp_formula.first) : undefined,
      levelUp: refClass.fp_formula?.levelUp ? String(refClass.fp_formula.levelUp) : undefined,
    },
    startingFeatures: (refClass.starting_features || mc.startingFeatures || []).map((f) => ({
      name: f.name,
      desc: f.desc || f.description || '',
    })),
    startingChoice: refClass.starting_choice ?? mc.startingChoice ?? 2,
    specializations: mc.specializations?.length
      ? mc.specializations
      : (refClass.specializations || []).map((s) => ({
        id: s.name,
        name: s.name,
        effect: s.desc || s.effect || '',
      })),
  };
}

/** @deprecated use normalizeClassFromSource */
export function normalizeMageClassFromSource(refMage, classesMage, weaponProfs, mageClassJson = null) {
  const row = normalizeClassFromSource(refMage, classesMage, weaponProfs, mageClassJson);
  return {
    ...row,
    weaponCategoryNote: row.weaponCategoryNote
      || '角色创建页「武器」为具体类型（法杖/魔棒/匕首/手弩/简易）；面板武器熟练类别为法器/剑类/弓箭/简易（法器含法杖与魔棒，剑类含匕首，弓箭含手弩）。',
    hpFormula: row.hpFormula?.first ? row.hpFormula : {
      first: '8+体质调整值',
      levelUp: '每法师等级+2+体质调整值',
    },
    fpFormula: row.fpFormula?.first ? row.fpFormula : {
      first: '12+关键属性调整值',
      levelUp: '每法师等级+1',
    },
  };
}

export function buildSearchText(parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function attrBonusSummary(attrBonus) {
  if (!attrBonus) return '';
  return Object.entries(attrBonus)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`)
    .join(' ');
}

export function toRaceCard(race, sources) {
  const traitNames = (race.traits || []).map((t) => t.name).join(' ');
  return {
    entityType: 'race',
    id: race.name,
    name: race.name,
    aliases: [],
    searchText: buildSearchText([
      race.name,
      race.description,
      traitNames,
      attrBonusSummary(race.attrBonus),
      race.moveSpeed,
      race.size,
    ]),
    source: sources,
    ...race,
  };
}

export function toBackgroundCard(bg, sources) {
  const equip = Array.isArray(bg.equipment) ? bg.equipment.join('、') : (bg.equipment || '');
  return {
    entityType: 'background',
    id: bg.id || bg.name,
    name: bg.name,
    aliases: [],
    searchText: buildSearchText([
      bg.name,
      bg.description,
      (bg.skills || []).join(' '),
      bg.baseSkills,
      bg.profSkills,
      bg.other,
      equip,
      ...(bg.skillGrants || []).map((g) => g.label || g.category || ''),
    ]),
    source: sources,
    ...bg,
  };
}

export function toClassCard(cl, sources) {
  const specNames = (cl.specializations || []).map((s) => s.name).join(' ');
  const featNames = (cl.startingFeatures || []).map((f) => f.name).join(' ');
  const kitText = (cl.startingGearKits || []).map((k) => `套装${k.letter} ${k.summary}`).join(' ');
  const aliases = cl.name === '法师' ? ['mage'] : [];
  return {
    entityType: 'class',
    id: cl.id || cl.name,
    name: cl.name,
    aliases,
    searchText: buildSearchText([
      cl.name,
      ...aliases,
      cl.description,
      cl.rolePositioning,
      cl.weapons,
      cl.armor,
      (cl.saves || []).join(' '),
      cl.skills,
      specNames,
      featNames,
      kitText,
      (cl.weaponProfCategories || []).join(' '),
      '起始装备',
      '起手套装',
    ]),
    source: sources,
    ...cl,
    skillPickRule: cl.skills,
    skillPickCount: cl.skillPickCount ?? 4,
  };
}

export function loadBackgroundMerge(chargenBackgroundsPath, refBgs) {
  const merged = [];
  const xlsxByName = {};
  if (fs.existsSync(chargenBackgroundsPath)) {
    for (const b of readJson(chargenBackgroundsPath).backgrounds || []) {
      xlsxByName[b.name] = b;
    }
  }
  for (const bg of Object.values(refBgs)) {
    merged.push({ panel: bg, extra: xlsxByName[bg.name] || xlsxByName[bg.id] || null });
  }
  for (const [name, extra] of Object.entries(xlsxByName)) {
    if (!merged.some((m) => m.panel?.name === name || m.extra?.name === name)) {
      merged.push({ panel: { id: name, name, ...extra }, extra });
    }
  }
  return merged;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadPhase2Sources(root) {
  const panelData = path.join(root, '斯诺德跑团', 'panel_data.js');
  const racesData = path.join(root, '职业页', '数据', 'races_data.js');
  const classesData = path.join(root, '职业页', '数据', 'classes_data.js');
  const charCreation = path.join(root, '斯诺德跑团', '角色创建页.html');
  const chargenBg = path.join(root, 'advisor', 'chargen', 'backgrounds.json');
  const mageClassJson = path.join(root, 'advisor', 'chargen', 'mage_class.json');

  const maps = parseCharCreationBgSkillMaps(charCreation);
  const refBgs = loadPanelConst(panelData, 'REF_BACKGROUNDS');
  const refMage = loadPanelConst(panelData, 'REF_CLASSES')['法师'];
  const weaponProfs = loadPanelWeaponProfs(panelData);
  const races = loadRacesData(racesData).map(normalizeRaceFromSource);
  const classesMage = loadClassesData(classesData).find((c) => c.name === '法师');
  const bgMerged = loadBackgroundMerge(chargenBg, refBgs);
  const backgrounds = bgMerged.map(({ panel, extra }) =>
    normalizeBackgroundFromSource(panel, maps, extra),
  );
  const mageClassJsonData = fs.existsSync(mageClassJson)
    ? readJson(mageClassJson)
    : null;
  const mageClass = normalizeMageClassFromSource(
    refMage,
    classesMage,
    weaponProfs,
    mageClassJsonData,
  );

  return {
    sources: {
      races: ['职业页/数据/races_data.js'],
      backgrounds: ['斯诺德跑团/panel_data.js → REF_BACKGROUNDS', 'advisor/chargen/backgrounds.json'],
      classes: ['斯诺德跑团/panel_data.js → REF_CLASSES.法师', '职业页/数据/classes_data.js'],
      skillMaps: ['斯诺德跑团/角色创建页.html → BG_SKILL_MAP'],
    },
    races,
    backgrounds,
    mageClass,
  };
}

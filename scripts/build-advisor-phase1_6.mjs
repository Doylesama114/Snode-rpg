#!/usr/bin/env node
/**
 * Build Advisor — Phase 1.6: chargen enrichment + mage docx + equipment subset.
 * Run: node scripts/build-advisor-phase1_6.mjs
 * Requires: node scripts/build-advisor-phase1.mjs first (or run standalone — calls phase1).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_RULES = path.join(ROOT, 'advisor', 'rules');
const OUT_CHARGEN = path.join(ROOT, 'advisor', 'chargen');
const OUT_ITEMS = path.join(ROOT, 'advisor', 'items');

const HELP_HTML = path.join(ROOT, '斯诺德跑团', '帮助.html');
const MAGE_DOCX = path.join(ROOT, '基础职业-法师.docx');
const PANEL_DATA = path.join(ROOT, '斯诺德跑团', 'panel_data.js');
const MAGE_JSON = path.join(ROOT, '职业页', '数据', '法师.json');
const ITEMS_DATA = path.join(ROOT, '职业页', '数据', 'items_data.js');
const EQUIP_JSON = path.join(ROOT, '职业页', '数据', 'equipment.json');
const CATALOG_JSON = path.join(ROOT, '职业页', '数据', 'equipment_catalog.json');

const STYLE_SUMMARIES = {
  塑能: '以火焰、冰霜、雷电、强酸等元素直射与 AOE 伤害为主；常见冻结、灼烧、减速等异常状态，是典型输出/半控场风格。',
  咒法: '召唤生物、开启传送门、次元储物与实用法术；偏团队后勤、位移与战场布置。',
  预言: '侦测、预知、信息获取与命运干预；强化察觉与战术预判，控场偏软。',
  防护: '护盾、反制、增益屏障与伤害减免；提升生存与打断敌方施法。',
  附魔: '魅惑、命令、属性增强与心智影响；偏惑控与团队增益。',
  死灵: '生命流失、诅咒、负向能量与不死相关效果；持续压迫与资源消耗。',
  幻术: '幻象、隐形、感知干扰与误导；创造战术欺骗与脱身空间。',
  变化: '变形术、物质转化与体质/智力豁免控制；可将敌人变为无害形态或改造物件。',
};

const MAGE_GEAR_ITEM_NAMES = [
  '匕首', '手弩', '箭矢', '学徒魔棒', '魔棒', '布衣', '皮甲', '旅行腰包', '背包',
  '亚麻布毯', '羊绒毯', '活力药水', '探索工具', '写作工具', '魔法水晶球', '水袋', '水晶球',
];

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadPanelConst(name) {
  const text = fs.readFileSync(PANEL_DATA, 'utf8');
  const marker = `const ${name} = JSON.parse('`;
  const start = text.indexOf(marker);
  let i = start + marker.length;
  let raw = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === "'") { raw += "'"; i += 2; continue; }
    if (c === "'") break;
    raw += c;
    i++;
  }
  return JSON.parse(raw);
}

function calcMod(v) {
  return Math.floor((v - 10) / 2);
}

function calcAttrCost(v) {
  if (v <= 8) return 0;
  if (v <= 13) return v - 8;
  return 5 + (v - 13) * 2;
}

function buildPointBuy() {
  const attrs = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运'];
  const table = [];
  for (let v = 8; v <= 15; v++) {
    table.push({ attrValue: v, pointCost: calcAttrCost(v), modifier: calcMod(v) });
  }
  return {
    meta: {
      layer: 'L1',
      phase: '1.6',
      source: '斯诺德跑团/角色创建页.html (calcAttrCost, TOTAL_POINTS=32)',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    totalPoints: 32,
    maxPointsPerAttr: 9,
    defaultUnspentValue: 8,
    attrs,
    table,
    rules: [
      '未花费费用的属性默认为 8（调整值 -1）。',
      '单项属性至多分配 9 点费用（属性值 15，调整值 +2）。',
      '13→14 花费 2，14→15 花费 2；8→13 每级 1 费用。',
      '种族属性加值在 32 点分配完成后额外叠加。',
    ],
  };
}

function buildProficiencies() {
  const profDefs = {
    力量: ['豁免', '威力', '承重', '运动-跳跃', '运动-攀爬', '运动-游泳', '运动-自定义'],
    敏捷: ['豁免', '体操', '骑乘', '隐匿', '巧手-偷窃', '巧手-开锁', '巧手-拆除', '巧手-自定义'],
    体质: ['豁免', '专注', '耐力'],
    智力: ['豁免', '宗教', '调查', '估价', '伪造', '读唇', '逻辑', '奥秘-魔法学识', '奥秘-炼金术', '奥秘-神奇道具', '奥秘-多元宇宙', '知识-历史', '知识-地理', '知识-人文', '知识-政治', '知识-神秘学', '知识-工程学', '知识-珠宝学', '知识-草药学', '知识-医药', '知识-烹饪', '知识-自定义'],
    感知: ['豁免', '洞悉', '导航', '自然', '驯兽', '感悟', '聆听', '察觉', '警惕值'],
    魅力: ['豁免', '欺瞒', '恐吓', '说服', '表演-歌唱', '表演-舞蹈', '表演-自定义'],
    意志: ['豁免', '求生', '激励', '决策'],
    幸运: ['豁免', '机遇', '探索'],
  };
  const skillCats = {
    运动: ['运动-跳跃', '运动-攀爬', '运动-游泳'],
    巧手: ['巧手-偷窃', '巧手-开锁', '巧手-拆除'],
    奥秘: ['奥秘-魔法学识', '奥秘-炼金术', '奥秘-神奇道具', '奥秘-多元宇宙'],
    知识: ['知识-历史', '知识-地理', '知识-人文', '知识-政治', '知识-神秘学', '知识-工程学', '知识-珠宝学', '知识-草药学', '知识-医药', '知识-烹饪'],
    表演: ['表演-歌唱', '表演-舞蹈', '表演-演奏'],
  };
  return {
    meta: {
      layer: 'L1',
      phase: '1.6',
      source: '斯诺德跑团/panel_engine.js _profDefs + 角色创建页 SKILL_CATS',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    byAttribute: profDefs,
    parentCategories: skillCats,
    mageMulticlassProfTargets: ['逻辑', '奥秘-魔法学识', '奥秘-炼金术', '奥秘-神奇道具', '奥秘-多元宇宙', '知识-历史', '知识-地理', '知识-人文', '知识-政治', '知识-神秘学', '知识-工程学', '知识-珠宝学', '知识-草药学', '知识-医药', '知识-烹饪'],
    mageMulticlassNote: '兼职法师门槛：奥秘、知识、逻辑熟练度共计 +6（可来自职业四项 + 背景 + 专精）。',
    classSkillPick: {
      法师: '从专注、调查、逻辑、奥秘、知识、洞悉、感悟、聆听中选择四项各 +1（选奥秘/知识时需指定子项）。',
    },
  };
}

function parseTalentTierUnlocksFromHelp() {
  const html = fs.readFileSync(HELP_HTML, 'utf8');
  const section = html.match(/id="s3"[\s\S]*?<h3>子职业<\/h3>/)[0];
  const rows = [...section.matchAll(
    /<tr><td[^>]*><b>LV\.(\d+)<\/b><\/td><td[^>]*>[^<]*<\/td><td[^>]*>[^<]*<\/td><td[^>]*>[^<]*<\/td><td[^>]*>[^<]*<\/td><td>([^<]*)<\/td>/g
  )];
  const tierMap = { 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unlocks = [];
  for (const r of rows) {
    const level = Number(r[1]);
    const other = r[2].trim();
    if (!other.includes('天赋树')) continue;
    const tierKey = other.match(/第([三四五六七八九])阶/);
    if (!tierKey) continue;
    const xpM = other.match(/[（(](\d+)点经验值[）)]/);
    unlocks.push({
      tier: tierMap[tierKey[1]],
      tierLabel: `${tierKey[1]}阶`,
      unlockAtMainLevel: level,
      extraXpRequired: xpM ? Number(xpM[1]) : null,
      note: other,
    });
  }
  return {
    meta: { source: '斯诺德跑团/帮助.html §升级·主职业', phase: '1.6' },
    tiersOneAndTwoFreeAtLevel: 1,
    unlocks,
    sameLayerTalentCap: 5,
    sameLayerTalentCapSource: '帮助.html §关键词·天赋',
  };
}

function enhanceLeveling(existing) {
  const talent = parseTalentTierUnlocksFromHelp();
  const { talentTierUnlocks: _legacy, ...rest } = existing;
  return {
    ...rest,
    meta: {
      ...existing.meta,
      version: '1.1.0',
      phase: '1.6',
      sources: [...(existing.meta.sources || []), '帮助.html §升级（天赋位阶 XP）'],
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    talentTierUnlocks: talent,
    profCapNote: '单项熟练度上限见各级 prof_cap；升级时新增熟练度不可使任一单项超过当前上限。',
    attrCapNote: '单项属性值上限见各级 attr_cap；超出需等待升级解锁更高上限。',
  };
}

function extractMageDocxText() {
  const out = execSync(`python "${path.join(__dirname, 'extract-mage-docx.py')}" "${MAGE_DOCX}"`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(out.trim());
}

const MAGE_GEAR_RULES_FALLBACK = {
  匕首: '对一名角色造成1D4点穿刺伤害.灵巧.双持.单手武器.近战.匕首武器',
  '手弩+20支箭矢': '消耗一发箭矢，对一名角色造成2D4点穿刺伤害.装填.单手武器.远程.弓箭武器',
  学徒魔棒: '部分戏法和法术要求必须持有魔棒才能够施展.法术媒介',
  布衣: '防御等级11+敏捷调整值（至多为2）.隐匿劣势.轻甲',
  皮甲: '防御等级11+敏捷调整值（至多为2）.轻甲',
  旅行腰包: '获得额外5格装备槽位',
  背包: '获得额外10格装备槽位',
  亚麻布毯: '一块质地粗糙的亚麻布毯子',
  羊绒毯: '一块粗加工的羊毛毯子，具备保暖作用',
  活力药水: '为饮用者回复4点疲劳值',
  '任意法术学派的基础书籍': '正式游玩前确定学派；幕间阅读可学对应派系法术或戏法',
  写作工具: '包含羽毛笔、墨水和一些用于书写的纸张',
  探索工具: '持有者视作拥有探索的熟练度',
  魔法水晶球: '高超奥秘/神秘学知识者或可通过水晶球显像答案（传闻）',
  水袋: '能够盛放1升的水源',
};

function parseMageDocxGear(paras) {
  const items = { ...MAGE_GEAR_RULES_FALLBACK };
  let inList = false;
  for (const p of paras) {
    if (/装备列表/.test(p)) { inList = true; continue; }
    if (inList && (/法师专精/.test(p) || p === '初始专长')) break;
    if (inList) {
      const idx = p.search(/[:：]/);
      if (idx > 0) items[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
    }
  }
  const kits = {};
  for (const p of paras) {
    const m = p.match(/^([A-D])[·.](.+)/);
    if (m) kits[m[1]] = { letter: m[1], summary: m[2], items: m[2].split(/[。.]/).filter(Boolean) };
  }
  if (Object.keys(kits).length === 0) {
    const mageEquip = JSON.parse(fs.readFileSync(EQUIP_JSON, 'utf8')).法师 || [];
    for (const k of mageEquip) {
      kits[k.letter] = { letter: k.letter, summary: k.text, items: k.text.split(/[、.]/).filter(Boolean) };
    }
  }
  return { items, kits };
}

function buildCombatStyles(mageSkills) {
  const byStyle = {};
  for (const s of mageSkills) {
    if (!s.style || s.type === 'starting') continue;
    if (!byStyle[s.style]) byStyle[s.style] = { skills: [], tags: {} };
    byStyle[s.style].skills.push(s.name);
    for (const t of s.tags || []) {
      byStyle[s.style].tags[t] = (byStyle[s.style].tags[t] || 0) + 1;
    }
  }
  return Object.entries(STYLE_SUMMARIES).map(([name, advisorSummary]) => {
    const data = byStyle[name] || { skills: [], tags: {} };
    const topTags = Object.entries(data.tags).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
    return {
      name,
      advisorSummary,
      skillCount: data.skills.length,
      sampleSkills: data.skills.slice(0, 8),
      commonTags: topTags,
    };
  });
}

function buildMageClass(refMage, paras) {
  const gear = parseMageDocxGear(paras);
  const mageSkills = JSON.parse(fs.readFileSync(MAGE_JSON, 'utf8')).skills;
  const text = paras.join('\n');
  const roleBlock = text.split('---------------------------------------------------------------------')[0];

  return {
    meta: {
      layer: 'L1',
      phase: '1.6',
      source: '基础职业-法师.docx + REF_CLASSES + 法师.json',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    id: '法师',
    name: '法师',
    roleSummary: {
      positioning: ['法术输出', '团队增益', '控制局势'],
      blurb: roleBlock.split('\n').slice(2, 4).join(' ').trim(),
    },
    keyAttr: refMage.key_attr,
    armor: refMage.armor,
    weapons: refMage.weapons,
    saves: refMage.saves,
    skills: refMage.skills,
    hpFormula: { first: '8+体质调整值', levelUp: '每法师等级+2+体质调整值' },
    fpFormula: { first: '12+关键属性调整值', levelUp: '每法师等级+1' },
    startingFeatures: refMage.starting_features,
    startingChoice: refMage.starting_choice,
    specializations: [
      {
        id: '奥法学者',
        name: '奥法学者',
        effect: '法师职业等级每提升 1 级，额外获得 1 个仅可用于法术或戏法的技能槽位；可选奥秘子项 +1 熟练度。',
        buildHint: '法术位/槽位型 build；优先选魔法学识等奥秘子项。',
        profChoices: ['奥秘-魔法学识', '奥秘-炼金术', '奥秘-神奇道具', '奥秘-多元宇宙'],
      },
      {
        id: '知识传承',
        name: '知识传承',
        effect: '可通过幕间物语向他人/魔典/强大生物学习新法术；可选知识子项 +1 熟练度。',
        buildHint: '长期扩展法术列表；适合学者型法师与幕间投资。',
        profChoices: ['知识-历史', '知识-地理', '知识-人文', '知识-政治', '知识-神秘学', '知识-工程学', '知识-珠宝学', '知识-草药学', '知识-医药', '知识-烹饪'],
      },
      {
        id: '魔法学派',
        name: '魔法学派',
        effect: '最多四种战斗风格；须选一个对立学派且永远无法获得该风格能力；第三、第四种风格能力可能有额外条件。',
        buildHint: '规划八学派中最多四门；对立学派永久排除一条路线。',
      },
    ],
    combatStyles: buildCombatStyles(mageSkills),
    startingGearKits: gear.kits,
    gearItemRules: gear.items,
  };
}

function buildMageStartingGear(mageClass) {
  return {
    meta: { layer: 'L1', phase: '1.6', source: 'equipment.json + 基础职业-法师.docx', generatedAt: new Date().toISOString().slice(0, 10) },
    kits: mageClass.startingGearKits,
    itemRules: mageClass.gearItemRules,
    kitAdvisorNotes: [
      { kit: 'A', note: '神秘主义者：水晶球 + 写作工具，偏奥秘/预言 RP 与幕间学习。' },
      { kit: 'B', note: '团队施法：魔棒 + 活力药水，通用冒险起手。' },
      { kit: 'C', note: '学院派：魔棒 + 学派书籍，配合幕间阅读扩展法术。' },
      { kit: 'D', note: '顾问型：手弩 + 皮甲 + 探索工具，稍偏生存与远程。' },
    ],
  };
}

function buildMageEquipmentRules() {
  return {
    meta: { layer: 'L1', phase: '1.6', source: '基础职业-法师.docx + REF_CLASSES', generatedAt: new Date().toISOString().slice(0, 10) },
    allowedWeapons: ['法杖', '魔棒', '匕首', '手弩', '简易武器'],
    allowedArmor: ['轻甲'],
    keyRules: [
      '未着装护甲时 AC = 10 + 敏捷调整值。',
      '布衣/皮甲：AC 11 + 敏捷调整值（敏捷加成至多为 2）。布衣有隐匿劣势。',
      '学徒魔棒：部分戏法/法术需持魔棒；视为法术媒介。',
      '手弩：远程，消耗箭矢；相邻或超距有命中劣势（见基础规则战斗章）。',
    ],
  };
}

function loadItemsData() {
  const text = fs.readFileSync(ITEMS_DATA, 'utf8');
  const m = text.match(/var ITEM_DATA = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('ITEM_DATA not found');
  return JSON.parse(m[1]);
}

function buildEquipmentIndex(catalog, docxItems) {
  const itemsData = loadItemsData();
  const picked = [];
  const seen = new Set();

  const add = (entry) => {
    const key = entry.name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    picked.push(entry);
  };

  for (const [name, rule] of Object.entries(docxItems)) {
    add({
      name: name.replace('+20支箭矢', ''),
      category: 'chargen',
      source: '基础职业-法师.docx',
      effect: rule,
      price: itemsData[name.split('+')[0]]?.price || null,
      weight: itemsData[name.split('+')[0]]?.weight || null,
    });
  }

  for (const key of MAGE_GEAR_ITEM_NAMES) {
    if (itemsData[key]) {
      add({
        name: key,
        category: 'items_data',
        source: '职业页/数据/items_data.js',
        effect: itemsData[key].description || '',
        price: itemsData[key].price,
        weight: itemsData[key].weight,
        tags: itemsData[key].tags,
      });
    }
  }

  for (const [cat, items] of Object.entries(catalog)) {
    for (const it of items) {
      const req = it.requirement || '';
      if (/法师、术士或魔契师以外|未拥有施法者职业/.test(req)) continue;
      const n = it.name || '';
      const relevant =
        cat === '护甲' ||
        (cat === '武器' && /匕首|手弩|魔棒|法杖/.test(n + (it.subcategory || ''))) ||
        (cat === '神奇道具' && /水晶球|魔棒|水袋|背包|腰包|药水|工具|毯/.test(n));
      if (relevant) {
        add({
          name: it.name,
          category: it.catalogCategory || cat,
          subcategory: it.subcategory,
          type: it.type,
          requirement: it.requirement,
          effect: it.effect,
          price: it.price,
          weight: it.weight,
          source: 'equipment_catalog.json',
        });
      }
    }
  }

  return {
    meta: {
      layer: 'L1',
      phase: '1.6',
      source: 'items_data.js + equipment_catalog.json + 基础职业-法师.docx',
      count: picked.length,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    items: picked,
  };
}

function parseBackgroundSkills(baseStr, profStr) {
  const split = (s) => (s || '')
    .split(/[、，,]/)
    .map((x) => x.trim())
    .filter((x) => x && x !== '无' && !/^任选/.test(x));
  return [...new Set([...split(baseStr), ...split(profStr)])];
}

function computeMageSkillHits(skills) {
  return ['逻辑', '奥秘', '知识', '专注'].filter((k) => skills.some((s) => s.includes(k)));
}

function mergeBackgrounds(refBgs, xlsxRaw) {
  const xlsxByName = Object.fromEntries((xlsxRaw.backgrounds || []).map((b) => [b.name, b]));
  const merged = [];
  const seen = new Set();
  for (const [id, bg] of Object.entries(refBgs)) {
    const x = xlsxByName[id] || xlsxByName[bg.name];
    const skills = parseBackgroundSkills(
      bg.base_skills || x?.baseSkills,
      bg.prof_skills || x?.profSkills,
    );
    merged.push({
      id: bg.id,
      name: bg.name,
      hpBonus: bg.hp_bonus ?? x?.hpBonus,
      baseSkills: bg.base_skills || x?.baseSkills,
      profSkills: bg.prof_skills || x?.profSkills,
      skills,
      other: bg.other,
      funds: bg.funds,
      equipment: bg.equipment,
      description: (bg.description || '').replace(/\\n/g, '\n'),
      lore: x?.lore || null,
      location: x?.location || null,
      personality: x?.personality || null,
      bonds: x?.bonds || null,
      flaws: x?.flaws || null,
      traitName: x?.traitName || null,
      intro: x?.intro || null,
      mageSkillHits: computeMageSkillHits(skills),
    });
    seen.add(bg.name);
  }
  for (const x of xlsxRaw.backgrounds || []) {
    if (seen.has(x.name)) continue;
    const skills = parseBackgroundSkills(x.baseSkills, x.profSkills);
    merged.push({
      id: x.name,
      name: x.name,
      hpBonus: x.hpBonus,
      baseSkills: x.baseSkills,
      profSkills: x.profSkills,
      skills,
      other: x.other,
      funds: x.funds,
      equipment: x.equipmentList || x.equipment,
      description: x.traitDesc || '',
      lore: x.lore,
      location: x.location,
      personality: x.personality,
      bonds: x.bonds,
      flaws: x.flaws,
      intro: x.intro,
      mageSkillHits: computeMageSkillHits(skills),
    });
  }
  return merged;
}

function buildMageHints(mageClass, backgrounds) {
  const multiclass = JSON.parse(fs.readFileSync(path.join(OUT_RULES, 'multiclass.json'), 'utf8'));
  const intPositive = JSON.parse(fs.readFileSync(path.join(OUT_CHARGEN, 'races.json'), 'utf8')).races
    .filter((r) => typeof r.intBonus === 'number' && r.intBonus > 0)
    .map((r) => ({ name: r.name, intBonus: r.intBonus }))
    .sort((a, b) => b.intBonus - a.intBonus);

  const bgForMage = backgrounds
    .map((bg) => ({ ...bg, score: (bg.mageSkillHits || []).length }))
    .filter((bg) => bg.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    meta: { layer: 'L1', phase: '1.6', targetClass: '法师', generatedAt: new Date().toISOString().slice(0, 10) },
    primaryAttr: { name: '智力', targetAtCreation: 15, reason: '法师本职与奇械师兼职均要求智力 15' },
    roleSummary: mageClass.roleSummary,
    specializationHints: mageClass.specializations.map((s) => ({ name: s.name, buildHint: s.buildHint })),
    styleHints: mageClass.combatStyles.map((s) => ({
      name: s.name,
      summary: s.advisorSummary,
      sampleSkills: s.sampleSkills.slice(0, 4),
    })),
    recommendedRaces: { high: intPositive.slice(0, 8) },
    recommendedBackgrounds: bgForMage.slice(0, 12).map((bg) => ({
      name: bg.name,
      skills: bg.skills,
      mageSkillHits: bg.mageSkillHits,
      loreSnippet: (bg.intro || bg.description || '').slice(0, 120),
    })),
    multiclassAsMain: {
      unlockLevel: 7,
      compatibleSubclasses: multiclass.mageAsMain?.compatibleSubclasses || [],
      incompatibleSubclasses: multiclass.mageAsMain?.incompatibleSubclasses || [],
    },
    startingGearHint: 'B/C 魔棒起手最通用；C 配合学派书扩展法术；D 需皮甲熟练（法师轻甲可穿）。',
    advisorNotes: [
      '32 点购点优先智力 15；背景/专精补充逻辑、奥秘、知识熟练。',
      '标识由 DM 团队结算；勿建议刷标识。',
      '最多 4 个战斗风格 + 1 个永久对立学派。',
    ],
  };
}

function patchRulesSummary(existing) {
  const bullets = [...(existing.bullets || [])];
  const add = [
    '同一层天赋树至多 5 项不同天赋；槽位满需先移除再学。',
    '天赋位阶：除一/二阶外，解锁三阶及以上还需额外 XP（见 leveling.talentTierUnlocks）。',
    '标识由 DM 根据模组主题结算；顾问不得建议刻意刷标识。',
  ];
  for (const b of add) {
    if (!bullets.includes(b)) bullets.push(b);
  }
  return { ...existing, meta: { ...existing.meta, phase: '1.6' }, bullets };
}

function main() {
  execSync('node scripts/build-advisor-phase1.mjs', { cwd: ROOT, stdio: 'inherit' });
  execSync('python scripts/extract-backgrounds-xlsx.py', { cwd: ROOT, stdio: 'inherit' });

  const xlsxRaw = JSON.parse(fs.readFileSync(path.join(OUT_CHARGEN, '_backgrounds_xlsx_raw.json'), 'utf8'));
  const refBgs = loadPanelConst('REF_BACKGROUNDS');
  const refMage = loadPanelConst('REF_CLASSES')['法师'];
  const paras = extractMageDocxText();
  const mageClass = buildMageClass(refMage, paras);
  delete mageClass.multiclassRequirements;
  const mcPath = path.join(OUT_CHARGEN, 'mage_class.json');
  const existingMc = JSON.parse(fs.readFileSync(mcPath, 'utf8'));
  mageClass.multiclassRequirements = JSON.parse(fs.readFileSync(path.join(OUT_RULES, 'multiclass.json'), 'utf8'))
    .requirements.find((r) => r.class === '法师');

  const backgrounds = mergeBackgrounds(refBgs, xlsxRaw);
  const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));

  writeJson(path.join(OUT_CHARGEN, 'point_buy.json'), buildPointBuy());
  writeJson(path.join(OUT_CHARGEN, 'proficiencies.json'), buildProficiencies());
  writeJson(path.join(OUT_RULES, 'leveling.json'), enhanceLeveling(JSON.parse(fs.readFileSync(path.join(OUT_RULES, 'leveling.json'), 'utf8'))));
  writeJson(path.join(OUT_RULES, 'rules_summary.json'), patchRulesSummary(JSON.parse(fs.readFileSync(path.join(OUT_RULES, 'rules_summary.json'), 'utf8'))));
  writeJson(mcPath, { ...existingMc, ...mageClass });
  writeJson(path.join(OUT_CHARGEN, 'mage_starting_gear.json'), buildMageStartingGear(mageClass));
  writeJson(path.join(OUT_CHARGEN, 'mage_equipment_rules.json'), buildMageEquipmentRules());
  writeJson(path.join(OUT_ITEMS, 'equipment_index.json'), buildEquipmentIndex(catalog, mageClass.gearItemRules));
  writeJson(path.join(OUT_CHARGEN, 'backgrounds.json'), {
    meta: {
      layer: 'L1',
      phase: '1.6',
      count: backgrounds.length,
      sources: ['panel_data.js REF_BACKGROUNDS', '个性与背景创建规则.xlsx'],
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    backgrounds,
  });
  writeJson(path.join(OUT_CHARGEN, 'mage_hints.json'), buildMageHints(mageClass, backgrounds));

  fs.unlinkSync(path.join(OUT_CHARGEN, '_backgrounds_xlsx_raw.json'));

  console.log('Phase 1.6 complete:');
  console.log('  backgrounds:', backgrounds.length);
  console.log('  combat styles:', mageClass.combatStyles.length);
  console.log('  equipment index:', JSON.parse(fs.readFileSync(path.join(OUT_ITEMS, 'equipment_index.json'), 'utf8')).meta.count);
}

main();

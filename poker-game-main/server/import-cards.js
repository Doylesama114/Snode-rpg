import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// Known effects for the original 15 cards (matched by name)
// Source: src/data/cards.ts
// ============================================================
const knownEffects = {
  '辛勤的苦工': [
    { timing: 'onDeploy', type: 'extraPlay', description: '在这张牌进场后，你可以立即从手牌中额外打出一张牌' }
  ],
  '驮用马': [
    { timing: 'onDeploy', type: 'createSlot', description: '创建一个额外槽位' },
    { timing: 'onField', type: 'modifyPower', description: '如果部署的卡牌带有"武器/护甲/物件"的关键词，这张牌的战力+2', targetKeywords: ['武器', '护甲', '物件'], value: 2, stackable: false }
  ],
  '法师': [
    { timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张拥有"魔法"关键词的战术牌后，这张牌的战力+2', targetKeywords: ['魔法'], value: 2, stackable: true }
  ],
  '见习冒险者': [
    { timing: 'onField', type: 'conditional', description: '你的场上每拥有一种不同的关键词，这张牌的战力+1（不计算这张牌上的关键词）', stackable: false }
  ],
  '矮人铁匠': [
    { timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张带有"武器/护甲"关键词的卡牌，那张卡牌的战力+2', targetKeywords: ['武器', '护甲'], value: 2, stackable: true }
  ],
  '野猪': [
    { timing: 'onField', type: 'conditional', description: '如果你场上拥有"猎人/农夫/冒险者"关键词的卡牌，这张卡的战力-2', value: -2, targetKeywords: ['猎人', '农夫', '冒险者'], stackable: false },
    { timing: 'onField', type: 'conditional', description: '如果你场上拥有"农田/森林"名称的卡牌，这张牌的战力+2', value: 2, stackable: false }
  ],
  '民兵': [
    { timing: 'onDestroy', type: 'protect', description: '当你一名带有"居民"关键词的卡牌将要被摧毁时，可以用这张牌代替被摧毁', targetKeywords: ['居民'] }
  ],
  '战士': [
    { timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张拥有"武器"关键词的卡牌后，这张牌的战力+1', targetKeywords: ['武器'], value: 1, stackable: true }
  ],
  '狮鹫': [
    { timing: 'onDeploy', type: 'createSlot', description: '你可以将其他单位牌部署在这张牌上' }
  ],
  '农田': [
    { timing: 'onField', type: 'conditional', description: '这张牌上每部署一张带有"务农"关键词的单位牌，这张牌的战力+1', targetKeywords: ['务农'], value: 1, stackable: true }
  ],
  '橡木武器店': [
    { timing: 'onField', type: 'modifyPower', description: '你的带有"战士/士兵/冒险者"关键词的卡牌战力+3', targetKeywords: ['战士', '士兵', '冒险者'], value: 3, stackable: false }
  ],
  '铁匠铺': [
    { timing: 'onField', type: 'conditional', description: '如果你拥有"矮人铁匠"，"锻炉"和"板甲"，这张牌的战力+15', value: 15, stackable: false }
  ],
  '金牌烤火鸡': [
    { timing: 'onReveal', type: 'modifyPower', description: '揭示后为你场上一张带有"居民/冒险者"关键词的卡牌战力+2', targetKeywords: ['居民', '冒险者'], value: 2, stackable: false }
  ],
  '生命药水': [
    { timing: 'onReveal', type: 'modifyPower', description: '揭示后为你的场上带有"职业者"关键词的卡牌战力+2', targetKeywords: ['职业者'], value: 2, stackable: false }
  ],
  '魔法飞弹': [
    { timing: 'onReveal', type: 'modifyCost', description: '揭示后使你左手边第一名玩家当前能量值-2', value: -2, stackable: false }
  ]
};

// ============================================================
// Column indices (0-based from sheet_to_json output)
// Actual xlsx columns: B=类别, C=名称, D=关键词, E=属性, F=战力, G=费用, H=效果
// ============================================================
const COL_CATEGORY = 0;   // 类别
const COL_NAME = 1;       // 名称
const COL_KEYWORDS = 2;   // 关键词
const COL_ATTRIBUTE = 3;  // 属性
const COL_POWER = 4;      // 战力
const COL_COST = 5;       // 费用
const COL_EFFECT = 6;     // 效果

// ============================================================
// Main
// ============================================================
const xlsxPath = path.resolve(__dirname, '..', '..', '斯诺德对决卡牌列表（已开出）.xlsx');

if (!fs.existsSync(xlsxPath)) {
  console.error(`ERROR: xlsx file not found at ${xlsxPath}`);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

let cardId = 1;
const cards = [];

for (const row of rows) {
  if (!Array.isArray(row) || row.length === 0) continue;

  const category = (row[COL_CATEGORY] ?? '').toString().trim();
  const name = (row[COL_NAME] ?? '').toString().trim();

  // Skip header rows (where 类别 == "类别")
  if (category === '类别') continue;
  // Skip template rows (where name == "名称") and empty names
  if (name === '名称' || name === '') continue;

  // ---- Determine card type ----
  const powerStr = (row[COL_POWER] ?? '').toString().trim();
  const costStr = (row[COL_COST] ?? '').toString().trim();

  let type = 'unit';
  if (powerStr.includes('战术') || costStr.includes('战术')) {
    type = 'tactic';
  } else if (powerStr.includes('环境') || costStr.includes('环境')) {
    type = 'environment';
  }

  // ---- Parse keywords ----
  const kwStr = (row[COL_KEYWORDS] ?? '').toString().trim();
  const keywords = kwStr
    ? kwStr.split(/[\/、,，]/).map(k => k.trim()).filter(k => k.length > 0)
    : [];

  // ---- Parse attribute ----
  const attribute = (row[COL_ATTRIBUTE] ?? '无').toString().trim() || '无';

  // ---- Parse basePower ----
  let basePower = 0;
  if (type === 'unit') {
    const pn = parseInt(powerStr, 10);
    if (!isNaN(pn)) basePower = pn;
  }

  // ---- Parse cost ----
  let cost = 0;
  const cn = parseInt(costStr, 10);
  if (!isNaN(cn)) cost = cn;

  // ---- Effects ----
  const effects = knownEffects[name]
    ? JSON.parse(JSON.stringify(knownEffects[name])) // deep clone to avoid mutation
    : (() => {
        const effectText = (row[COL_EFFECT] ?? '').toString().trim();
        return effectText
          ? [{ timing: 'onReveal', type: 'custom', description: effectText }]
          : [];
      })();

  // ---- Build card object ----
  const id = `card_${String(cardId).padStart(3, '0')}`;

  cards.push({
    id,
    name,
    type,
    keywords,
    attribute,
    basePower,
    cost,
    effects
  });

  cardId++;
}

// ---- Write output ----
const outputPath = path.resolve(__dirname, 'card-seed.json');
fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2), 'utf-8');
console.log(`✅ Generated ${cards.length} cards → card-seed.json`);

// Summary by type
const counts = { unit: 0, environment: 0, tactic: 0 };
for (const c of cards) counts[c.type]++;
console.log(`   Units: ${counts.unit}, Environments: ${counts.environment}, Tactics: ${counts.tactic}`);

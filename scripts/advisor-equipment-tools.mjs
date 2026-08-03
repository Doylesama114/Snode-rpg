/**
 * Advisor 5.0 batch6 (7070) — equipment / consumables lookup tools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor', 'items');

/** @type {object|null} */
let _catalogCache = null;
/** @type {object|null} */
let _consumablesCache = null;
/** @type {object|null} */
let _generalCache = null;
/** @type {Map<string, object>|null} */
let _byNameCache = null;

const CATEGORY_ALIASES = {
  护甲: ['护甲', '盔甲', '防具', '甲'],
  武器: ['武器', '兵器'],
  神奇道具: ['神奇道具', '奇物', '道具', '魔法道具', '饰品'],
  药水: ['药水', '药剂', '治疗药水', '活力药水'],
  卷轴: ['卷轴', '法术卷轴', '魔法卷轴'],
  食物: ['食物', '餐饮', '料理'],
  消耗品: ['消耗品'],
};

const EQUIP_LOOKUP_RE = /效果|价格|多少钱|多少金币|重量|需要什么|要求|怎么用|是什么|有什么|属性|售价/;
const EQUIP_SEARCH_RE = /有哪些|列表|什么装备|哪些|推荐|可以选|能用/;
const EQUIP_SUBJECT_RE = /武器|护甲|盔甲|神奇|道具|药水|卷轴|装备|消耗品|奇物/;

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, name), 'utf8'));
}

function loadCatalogIndex() {
  if (!_catalogCache) _catalogCache = loadJson('equipment_catalog_index.json');
  return _catalogCache;
}

function loadConsumablesIndex() {
  if (!_consumablesCache) _consumablesCache = loadJson('consumables_index.json');
  return _consumablesCache;
}

function loadGeneralItemsIndex() {
  if (!_generalCache) _generalCache = loadJson('general_items_index.json');
  return _generalCache;
}

function buildByNameMap() {
  if (_byNameCache) return _byNameCache;
  const map = new Map();
  for (const it of loadCatalogIndex().items || []) {
    map.set(it.name, it);
  }
  for (const it of loadConsumablesIndex().items || []) {
    if (!map.has(it.name)) map.set(it.name, it);
  }
  for (const it of loadGeneralItemsIndex().items || []) {
    if (!map.has(it.name)) map.set(it.name, it);
  }
  return (_byNameCache = map);
}

export function resetEquipmentToolsCache() {
  _catalogCache = null;
  _consumablesCache = null;
  _generalCache = null;
  _byNameCache = null;
}

/**
 * @param {string} query
 */
export function resolveEquipmentNamesFromQuery(query) {
  const q = String(query || '');
  const byName = buildByNameMap();
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const found = [];
  let rest = q;
  for (const name of names) {
    if (rest.includes(name)) {
      found.push(name);
      rest = rest.split(name).join(' ');
    }
  }
  return found;
}

export function resolveEquipmentNameFromQuery(query) {
  return resolveEquipmentNamesFromQuery(query)[0] || null;
}

/**
 * @param {string} query
 */
export function resolveEquipmentCategoryFromQuery(query) {
  const q = String(query || '');
  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) return cat;
  }
  if (/法师.*护甲|护甲.*法师/.test(q)) return '护甲';
  if (/卷轴/.test(q)) return '卷轴';
  if (/药水/.test(q)) return '药水';
  return null;
}

/**
 * @param {string} name
 */
export function lookupEquipment(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const hit = buildByNameMap().get(n);
  if (hit) return { ...hit, found: true };
  const catalog = loadCatalogIndex().items || [];
  const partial = catalog.filter((it) => it.name.includes(n) || n.includes(it.name));
  if (partial.length === 1) return { ...partial[0], found: true, matchedVia: 'partial' };
  return null;
}

/**
 * @param {string} query
 * @param {{ category?: string|null, limit?: number }} [opts]
 */
export function searchEquipment(query, opts = {}) {
  const q = String(query || '');
  const limit = opts.limit ?? 24;
  const cat = opts.category || resolveEquipmentCategoryFromQuery(q);
  const catalog = loadCatalogIndex().items || [];
  const consumables = loadConsumablesIndex().items || [];
  let pool = [...catalog];

  if (cat === '药水' || cat === '卷轴' || cat === '食物' || cat === '消耗品') {
    pool = consumables.filter((it) => {
      if (cat === '药水') return it.kind === 'potion';
      if (cat === '卷轴') return it.kind === 'scroll';
      if (cat === '食物') return it.kind === 'food';
      return true;
    });
  } else if (cat) {
    pool = catalog.filter((it) => it.category === cat || it.subcategory === cat);
  }

  const tokens = q.split(/[\s，,、？?！!。]+/).filter((t) => t.length >= 2 && !EQUIP_SUBJECT_RE.test(t));
  let hits = pool;
  if (tokens.length) {
    hits = pool.filter((it) => {
      const blob = `${it.name}${it.effect || ''}${it.category || ''}${it.subcategory || ''}`;
      return tokens.some((t) => blob.includes(t));
    });
  }

  if (/法师/.test(q) && cat === '护甲') {
    hits = hits.filter((it) => !/(中甲|重甲|板甲|链甲|鳞甲)/.test(`${it.name}${it.effect || ''}${it.requirement || ''}`));
  }

  return {
    category: cat,
    query: q,
    total: hits.length,
    items: hits.slice(0, limit),
    truncated: hits.length > limit,
    sourceFiles: ['equipment_catalog_index.json', 'consumables_index.json'],
  };
}

/**
 * @param {string} query
 */
export function detectEquipmentQuestion(query) {
  const q = String(query || '');

  if (/熟练度|熟练项|武器熟练|哪些.*职业|技能|可以学|效果一样|战技|法术|状态|异常|专长|命中加值|兼职|相同.*技能/.test(q)) {
    return null;
  }
  if (/这个技能|哪些职业.*学|初始职业.*武器/.test(q)) return null;

  const itemNames = resolveEquipmentNamesFromQuery(q);
  const itemName = itemNames[0] || null;

  if (itemName && EQUIP_LOOKUP_RE.test(q)) {
    return { intent: 'equipment_lookup', itemName, itemNames, query: q };
  }

  if (EQUIP_SEARCH_RE.test(q) && EQUIP_SUBJECT_RE.test(q)) {
    if (/熟练|职业.*武器|初始职业|锤子|锤类/.test(q)) return null;
    return {
      intent: 'equipment_search',
      category: resolveEquipmentCategoryFromQuery(q),
      query: q,
    };
  }

  if (itemName && q.trim() === itemName) {
    return { intent: 'equipment_lookup', itemName, query: q };
  }

  return null;
}

function formatItemLine(it) {
  const parts = [`**${it.name}**`];
  if (it.category) parts.push(`[${it.category}${it.subcategory ? `·${it.subcategory}` : ''}]`);
  if (it.price) parts.push(`价格：${it.price}`);
  if (it.weight) parts.push(`重量：${it.weight}`);
  if (it.requirement && it.requirement !== '无') parts.push(`要求：${it.requirement}`);
  return parts.join(' · ');
}

/**
 * @param {{ intent: string, itemName?: string, category?: string, query?: string }} detected
 */
export function buildEquipmentToolContext(detected) {
  if (!detected) return null;

  if (detected.intent === 'equipment_lookup') {
    const names = (detected.itemNames && detected.itemNames.length ? detected.itemNames : [detected.itemName]).filter(Boolean);
    const items = names.map((n) => lookupEquipment(n)).filter((x) => x && x.found);
    const missing = names.filter((n) => !items.some((x) => x.name === n));
    if (!items.length) {
      return {
        intent: 'equipment_lookup',
        promptProfile: 'equipment_lookup',
        text: [
          '### Tools 层 · 装备/物品查询（server-side · 事实）',
          `- 未在 equipment_catalog_index / consumables_index 中找到「${detected.itemName}」`,
          '- LLM 须如实说明未收录；勿编造价格/效果。',
        ].join('\n'),
        meta: { itemName: detected.itemName, found: false },
      };
    }
    const lines = ['### Tools 层 · 装备/物品详情（equipment_catalog_index · 事实 · 勿改数字）'];
    for (const item of items) {
      lines.push(`- 名称：${item.name}`);
      lines.push(`- 类别：${item.category || '—'}${item.subcategory ? ` · ${item.subcategory}` : ''}`);
      lines.push(`- 来源：${item.source}`);
      if (item.type) lines.push(`- 类型：${item.type}`);
      if (item.requirement) lines.push(`- 要求：${item.requirement}`);
      if (item.price) lines.push(`- 价格：${item.price}`);
      if (item.weight) lines.push(`- 重量：${item.weight}`);
      if (item.tags?.length) lines.push(`- 标签：${item.tags.join('、')}`);
      lines.push(`- 效果：${String(item.effect || '—').replace(/\n/g, '；')}`);
    }
    if (missing.length) {
      lines.push(`- 未收录：${missing.join('、')}（未在索引中找到，勿编造价格/效果）`);
    }
    lines.push('- LLM 须完整转述效果与价格；未出现在上文的数据不得编造。');
    return {
      intent: 'equipment_lookup',
      promptProfile: 'equipment_lookup',
      text: lines.join('\n'),
      meta: { itemName: items[0]?.name, itemNames: items.map((x) => x.name), found: true, source: items[0]?.source },
    };
  }

  if (detected.intent === 'equipment_search') {
    const result = searchEquipment(detected.query, { category: detected.category });
    const lines = [
      '### Tools 层 · 装备/物品检索（server-side · 完整列表）',
      `- 解析类别：${result.category || '（未限定 · 关键词匹配）'}`,
      `- 命中 ${result.total} 项${result.truncated ? `（展示前 ${result.items.length} 项）` : ''}`,
      `- 语料：${result.sourceFiles.join('、')}`,
      '- LLM 须完整列出下列条目（名称+关键效果/价格），不可只举示例：',
    ];
    for (const it of result.items) {
      lines.push(`- ${formatItemLine(it)}`);
      if (it.effect) lines.push(`  ${String(it.effect).replace(/\n/g, '；').slice(0, 240)}`);
    }
    if (!result.items.length) lines.push('- （语料交集为空 — 如实说明）');
    lines.push('- 法师护甲问法：仅列轻甲/无中重甲限制条目；以 requirement 字段为准。');
    return {
      intent: 'equipment_search',
      promptProfile: 'equipment_search',
      text: lines.join('\n'),
      meta: { category: result.category, total: result.total, shown: result.items.length },
    };
  }

  return null;
}

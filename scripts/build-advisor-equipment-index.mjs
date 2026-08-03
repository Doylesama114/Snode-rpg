#!/usr/bin/env node
/**
 * Advisor 5.0 batch6 (7070) — full equipment catalog + consumables index.
 * Run: node scripts/build-advisor-equipment-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'advisor', 'items');
const CATALOG_JSON = path.join(ROOT, '职业页', '数据', 'equipment_catalog.json');
const ITEMS_DATA = path.join(ROOT, '职业页', '数据', 'items_data.js');

function writeJson(rel, data) {
  const fp = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return fp;
}

function loadItemsData() {
  const text = fs.readFileSync(ITEMS_DATA, 'utf8');
  const m = text.match(/var ITEM_DATA = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('ITEM_DATA not found in items_data.js');
  return JSON.parse(m[1]);
}

function buildCatalogIndex(catalog) {
  const items = [];
  for (const [category, list] of Object.entries(catalog || {})) {
    for (const it of list || []) {
      if (!it?.name) continue;
      items.push({
        name: it.name,
        category: it.category || category,
        subcategory: it.subcategory || null,
        type: it.type || null,
        requirement: it.requirement || null,
        effect: it.effect || '',
        price: it.price ?? null,
        weight: it.weight ?? null,
        source: 'equipment_catalog.json',
        kind: 'equipment',
      });
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return {
    meta: {
      layer: 'L1',
      phase: '7070',
      source: '职业页/数据/equipment_catalog.json',
      count: items.length,
      categories: [...new Set(items.map((i) => i.category))].sort(),
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    items,
  };
}

function classifyConsumableKind(name, tags = [], desc = '') {
  const blob = `${name}${(tags || []).join('')}${desc}`;
  if (/卷轴/.test(blob)) return 'scroll';
  if (/药水|药剂|治疗|活力|解毒/.test(blob)) return 'potion';
  if (/食物|餐饮|肉|汤|蛋|面包|香肠|鱼|虾|蟹|土豆|番茄|玉米|洋葱/.test(blob)) return 'food';
  return 'consumable';
}

function buildConsumablesIndex(itemsData) {
  const items = [];
  for (const [name, row] of Object.entries(itemsData || {})) {
    const tags = row.tags || [];
    const tagStr = tags.join(',');
    const desc = row.description || '';
    const isConsumable = tags.some((t) => /消耗品|卷轴|药水|食物/.test(t))
      || /卷轴|药水|消耗|食物|餐饮/.test(`${name}${desc}`);
    if (!isConsumable) continue;
    items.push({
      name,
      category: tagStr || '消耗品',
      effect: desc,
      price: row.price ?? null,
      weight: row.weight ?? null,
      tags,
      source: 'items_data.js',
      kind: classifyConsumableKind(name, tags, desc),
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return {
    meta: {
      layer: 'L1',
      phase: '7070',
      source: '职业页/数据/items_data.js',
      count: items.length,
      kinds: [...new Set(items.map((i) => i.kind))].sort(),
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    items,
  };
}

function buildGeneralItemsIndex(itemsData, catalogItems, consumableNames) {
  const existingNames = new Set([
    ...(catalogItems || []).map((i) => i.name),
    ...(consumableNames || []),
  ]);
  const items = [];
  for (const [name, row] of Object.entries(itemsData || {})) {
    if (existingNames.has(name)) continue;
    const tags = row.tags || [];
    const tagStr = tags.join(',');
    items.push({
      name,
      category: tagStr || '物品',
      subcategory: null,
      type: null,
      requirement: row.requirement || null,
      effect: row.description || row.effect || '',
      price: row.price ?? null,
      weight: row.weight ?? null,
      tags,
      source: 'items_data.js',
      kind: 'general',
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return {
    meta: {
      layer: 'L1',
      phase: '7167',
      source: '职业页/数据/items_data.js（非消耗品通用物品）',
      count: items.length,
      categories: [...new Set(items.map((i) => i.category))].sort(),
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    items,
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
const itemsData = loadItemsData();
const catalogIndex = buildCatalogIndex(catalog);
const consumablesIndex = buildConsumablesIndex(itemsData);
const generalIndex = buildGeneralItemsIndex(
  itemsData,
  catalogIndex.items,
  (consumablesIndex.items || []).map((i) => i.name),
);

const catalogPath = writeJson('equipment_catalog_index.json', catalogIndex);
const consumablesPath = writeJson('consumables_index.json', consumablesIndex);
const generalPath = writeJson('general_items_index.json', generalIndex);

console.log(`Wrote ${catalogPath} (${catalogIndex.meta.count} items)`);
console.log(`Wrote ${consumablesPath} (${consumablesIndex.meta.count} items)`);
console.log(`Wrote ${generalPath} (${generalIndex.meta.count} items)`);
console.log(`Catalog categories: ${catalogIndex.meta.categories.join('、')}`);
console.log(`Consumable kinds: ${consumablesIndex.meta.kinds.join('、')}`);

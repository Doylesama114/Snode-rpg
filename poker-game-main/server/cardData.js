// 服务器端卡牌数据 — 支持全151卡牌池与玩家自定义牌组
// 默认从 server/card-seed.json 加载，缺失时回退到内置15张基础卡牌

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── 内置回退卡牌（原15张基础牌组，card-seed.json 缺失时使用）───────────────
const FALLBACK_CARDS = [
  { id: 'card_001', name: '辛勤的苦工', type: 'unit', keywords: ['居民'], attribute: '无', basePower: 1, currentPower: 1, cost: 1, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onDeploy', type: 'extraPlay', description: '在这张牌进场后，你可以立即从手牌中额外打出一张牌' }] },
  { id: 'card_002', name: '驮用马', type: 'unit', keywords: ['野兽', '载具'], attribute: '土', basePower: 1, currentPower: 1, cost: 1, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onDeploy', type: 'createSlot', description: '创建一个额外槽位' }, { timing: 'onField', type: 'modifyPower', description: '如果部署的卡牌带有"武器/护甲/物件"的关键词，这张牌的战力+2', targetKeywords: ['武器', '护甲', '物件'], value: 2, stackable: false }] },
  { id: 'card_003', name: '法师', type: 'unit', keywords: ['魔法', '职业者'], attribute: '无', basePower: 1, currentPower: 1, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张拥有"魔法"关键词的战术牌后，这张牌的战力+2', targetKeywords: ['魔法'], value: 2, stackable: true }] },
  { id: 'card_004', name: '见习冒险者', type: 'unit', keywords: ['居民', '职业者'], attribute: '无', basePower: 2, currentPower: 2, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onField', type: 'conditional', description: '你的场上每拥有一种不同的关键词，这张牌的战力+1（不计算这张牌上的关键词）', stackable: false }] },
  { id: 'card_005', name: '矮人铁匠', type: 'unit', keywords: ['居民'], attribute: '钢', basePower: 2, currentPower: 2, cost: 1, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张带有"武器/护甲"关键词的卡牌，那张卡牌的战力+2', targetKeywords: ['武器', '护甲'], value: 2, stackable: true }] },
  { id: 'card_006', name: '野猪', type: 'unit', keywords: ['野兽'], attribute: '土', basePower: 3, currentPower: 3, cost: 1, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onField', type: 'conditional', description: '如果你场上拥有"猎人/农夫/冒险者"关键词的卡牌，这张卡的战力-2', value: -2, targetKeywords: ['猎人', '农夫', '冒险者'], stackable: false }, { timing: 'onField', type: 'conditional', description: '如果你场上拥有"农田/森林"名称的卡牌，这张牌的战力+2', value: 2, stackable: false }] },
  { id: 'card_007', name: '民兵', type: 'unit', keywords: ['士兵'], attribute: '无', basePower: 3, currentPower: 3, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onDestroy', type: 'protect', description: '当你一名带有"居民"关键词的卡牌将要被摧毁时，可以用这张牌代替被摧毁', targetKeywords: ['居民'] }] },
  { id: 'card_008', name: '战士', type: 'unit', keywords: ['职业者'], attribute: '无', basePower: 3, currentPower: 3, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onOtherPlay', type: 'modifyPower', description: '每当你打出一张拥有"武器"关键词的卡牌后，这张牌的战力+1', targetKeywords: ['武器'], value: 1, stackable: true }] },
  { id: 'card_009', name: '狮鹫', type: 'unit', keywords: ['野兽', '载具', '飞行'], attribute: '风', basePower: 5, currentPower: 5, cost: 3, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onDeploy', type: 'createSlot', description: '你可以将其他单位牌部署在这张牌上' }] },
  { id: 'card_010', name: '农田', type: 'environment', keywords: ['自然', '务农'], attribute: '土', basePower: 0, currentPower: 0, cost: 1, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onField', type: 'conditional', description: '这张牌上每部署一张带有"务农"关键词的单位牌，这张牌的战力+1', targetKeywords: ['务农'], value: 1, stackable: true }] },
  { id: 'card_011', name: '橡木武器店', type: 'environment', keywords: ['武器', '建筑'], attribute: '木', basePower: 0, currentPower: 0, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onField', type: 'modifyPower', description: '你的带有"战士/士兵/冒险者"关键词的卡牌战力+3', targetKeywords: ['战士', '士兵', '冒险者'], value: 3, stackable: false }] },
  { id: 'card_012', name: '铁匠铺', type: 'environment', keywords: ['护甲', '建筑'], attribute: '钢', basePower: 0, currentPower: 0, cost: 2, slotRequired: 1, isPersistent: true, effects: [{ timing: 'onField', type: 'conditional', description: '如果你拥有"矮人铁匠"，"锻炉"和"板甲"，这张牌的战力+15', value: 15, stackable: false }] },
  { id: 'card_013', name: '金牌烤火鸡', type: 'tactic', keywords: ['食物'], attribute: '火', basePower: 0, currentPower: 0, cost: 1, slotRequired: 1, isPersistent: false, effects: [{ timing: 'onReveal', type: 'modifyPower', description: '揭示后为你场上一张带有"居民/冒险者"关键词的卡牌战力+2', targetKeywords: ['居民', '冒险者'], value: 2, stackable: false }] },
  { id: 'card_014', name: '生命药水', type: 'tactic', keywords: ['药剂'], attribute: '无', basePower: 0, currentPower: 0, cost: 1, slotRequired: 1, isPersistent: false, effects: [{ timing: 'onReveal', type: 'modifyPower', description: '揭示后为你的场上带有"职业者"关键词的卡牌战力+2', targetKeywords: ['职业者'], value: 2, stackable: false }] },
  { id: 'card_015', name: '魔法飞弹', type: 'tactic', keywords: ['魔法', '奥术'], attribute: '无', basePower: 0, currentPower: 0, cost: 1, slotRequired: 1, isPersistent: false, effects: [{ timing: 'onReveal', type: 'modifyCost', description: '揭示后使你左手边第一名玩家当前能量值-2', value: -2, stackable: false }] },
]

// ── 默认牌组ID（原15张基础卡牌）────────────────────────────────────────────
const DEFAULT_DECK_CARD_IDS = Array.from(
  { length: 15 },
  (_, i) => `card_${String(i + 1).padStart(3, '0')}`
)

// ── 卡牌数据库 ────────────────────────────────────────────────────────────
const CardDatabase = new Map()

// ── 辅助函数 ──────────────────────────────────────────────────────────────

/**
 * 将卡片数组或对象填充到 CardDatabase Map 中
 * @param {Array|Object} cards
 */
function populateDatabase(cards) {
  CardDatabase.clear()
  if (Array.isArray(cards)) {
    cards.forEach(card => CardDatabase.set(card.id, card))
  } else if (cards && typeof cards === 'object') {
    Object.values(cards).forEach(card => {
      if (card && card.id) CardDatabase.set(card.id, card)
    })
  }
}

// ── 公开 API ──────────────────────────────────────────────────────────────

/**
 * 从 JSON 文件加载卡牌数据，填充 CardDatabase
 * @param {string} jsonPath — 相对于 server/ 目录的路径，默认 'card-seed.json'
 * @returns {Map<string, object>} 以卡牌ID为键的 Map
 */
export function loadCardsFromJSON(jsonPath = 'card-seed.json') {
  const resolvedPath = resolve(__dirname, jsonPath)

  if (!existsSync(resolvedPath)) {
    console.warn(`[cardData] ${jsonPath} not found, using built-in fallback (${FALLBACK_CARDS.length} cards)`)
    populateDatabase(FALLBACK_CARDS)
    return CardDatabase
  }

  try {
    const raw = readFileSync(resolvedPath, 'utf-8')
    const cards = JSON.parse(raw)
    populateDatabase(cards)
    console.log(`[cardData] Loaded ${CardDatabase.size} cards from ${jsonPath}`)
    return CardDatabase
  } catch (err) {
    console.error(`[cardData] Failed to load ${jsonPath}: ${err.message}`)
    console.warn(`[cardData] Falling back to built-in cards (${FALLBACK_CARDS.length})`)
    populateDatabase(FALLBACK_CARDS)
    return CardDatabase
  }
}

/**
 * 初始化卡牌数据库
 * - 无参数时：从 server/card-seed.json 加载
 * - 传入 Map 时：直接使用
 * @param {Map<string, object>} [customMap] — 可选的预填充 Map
 * @returns {Map<string, object>}
 */
export function initializeCardDatabase(customMap) {
  if (customMap instanceof Map && customMap.size > 0) {
    CardDatabase.clear()
    customMap.forEach((card, id) => CardDatabase.set(id, card))
    console.log(`[cardData] Initialized with ${CardDatabase.size} cards from custom map`)
    return CardDatabase
  }

  return loadCardsFromJSON()
}

/**
 * 根据ID获取卡牌的深拷贝
 * @param {string} id — 卡牌ID（支持 _unique 后缀）
 * @returns {object|null}
 */
export function getCard(id) {
  const baseId = id.replace(/_unique$/, '')
  const cardDef = CardDatabase.get(baseId)
  if (!cardDef) return null

  return JSON.parse(JSON.stringify(cardDef))
}

/**
 * 获取默认牌组的卡牌ID列表（card_001 ~ card_015）
 * @returns {string[]}
 */
export function getDefaultDeckCardIds() {
  return [...DEFAULT_DECK_CARD_IDS]
}

/**
 * 根据卡牌ID数组创建牌组（每张卡加 _unique 后缀）
 * @param {string[]} cardIds — 恰好15个不重复的卡牌ID
 * @returns {object[]} 卡牌对象数组
 */
export function createDeckFromCardIds(cardIds) {
  if (!Array.isArray(cardIds)) {
    throw new Error('cardIds must be an array')
  }
  if (cardIds.length !== 15) {
    throw new Error(`A deck must contain exactly 15 cards, got ${cardIds.length}`)
  }
  if (new Set(cardIds).size !== 15) {
    throw new Error('A deck must contain 15 unique card IDs')
  }

  const deck = []
  for (const id of cardIds) {
    const card = getCard(id)
    if (!card) {
      throw new Error(`Card not found in database: ${id}`)
    }
    card.id = `${card.id}_unique`
    deck.push(card)
  }
  return deck
}

/**
 * 创建默认牌组（原15张基础卡牌）
 * @returns {object[]}
 */
export function createDefaultDeck() {
  return createDeckFromCardIds(DEFAULT_DECK_CARD_IDS)
}

/**
 * 获取数据库中所有卡牌（深拷贝数组）
 * @returns {object[]}
 */
export function getAllCards() {
  return Array.from(CardDatabase.values()).map(card =>
    JSON.parse(JSON.stringify(card))
  )
}

/**
 * 洗牌（Fisher-Yates）
 * @param {object[]} deck
 * @returns {object[]}
 */
export function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ── 模块加载时自动初始化 ──────────────────────────────────────────────────
initializeCardDatabase()

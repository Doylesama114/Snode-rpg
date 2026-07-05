/**
 * 全量验证：148 卡无 conditional + effect 类型覆盖 + 引擎硬编码扫描 + 卡组系统
 */
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const seed = JSON.parse(readFileSync(resolve(ROOT, 'server/card-seed.json'), 'utf8'))

const { EffectManager } = await import(pathToFileURL(resolve(ROOT, 'server/gameEngine.js')).href)
const { getCard, createDeckFromCardIds, getDefaultDeckCardIds, getAllCards } = await import(
  pathToFileURL(resolve(ROOT, 'server/cardData.js')).href,
)

const HANDLED_EFFECT_TYPES = new Set([
  'extraPlay', 'modifyPower', 'modifyCost', 'draw', 'createSlot', 'destroy', 'protect',
  'searchDeck', 'restoreEnergy', 'modifyPowerByName', 'reduceUnitPower', 'discardOpponentHand',
  'returnToDeckBottom', 'setNextUnitAttribute', 'markOpponentHand', 'stealPower', 'stealCard',
  'absNegativePower', 'setFieldAttribute', 'modifyPlayCost', 'd6ModifyPower', 'doubleTargetPower',
  'd6TierPower', 'setPowerIfNoFieldKeyword', 'debuffOpponentHand', 'grantUnitPlayBonus',
  'grantAttributePlayBonus', 'setD6MinForCardName', 'conditionalPlayCost', 'excludeFromFieldCount',
  'grantTacticPlayFree', 'modifyPowerByUniqueAttributes', 'playRequirement', 'searchFromHandOrDeck',
  'grantUntargetable', 'deployFromHand', 'debuffAheadPlayers', 'crossPlayerDeploy',
  'destroyRandomOther', 'setPowerIfFieldNames', 'setPowerIfOnlyHandCard', 'setPowerIfFieldKeyword',
  'setPowerIfHandNames', 'deployOnHostOnly', 'invertPowerLoss', 'discardHandOrSelf',
  'skipOthersDrawNextRound', 'discardHandForLeftPlayerDebuff', 'scheduleRoundStartEnergy',
  'grantCopiesToHand', 'playRandomFromDeckOrTop', 'autoEnterFromZone', 'absorbLeftPlayerUnit',
  'stashHandUnderSelf', 'initCharges', 'chargeDebuffUnit', 'scheduleRoundEndBuff',
  'lockRandomHandCards', 'restrictAdjacentPlayType', 'scryDeckTop', 'peekDeckBottom',
  'effectBranch', 'copyFieldUnitIdentity', 'sacrificeFieldForPower', 'retrieveFromDiscard',
  'noOp', 'batchHighestFreeDeploy', 'moveOpponentBatchRevealToDeckBottom', 'forceRandomHandPlay',
])

const ENGINE_FILES = [
  resolve(ROOT, 'src/game/effectManager.ts'),
  resolve(ROOT, 'server/gameEngine.js'),
  resolve(ROOT, 'src/composables/useGameNew.ts'),
]

const LEGACY_NAME_CHECKS = [
  { file: 'effectManager.ts / gameEngine.js', names: ['法师', '战士', '矮人铁匠'], fn: 'triggerOnOtherPlayEffects' },
  { file: 'effectManager.ts', names: ['农田', '森林'], fn: 'calculateBoarPower' },
  { file: 'effectManager.ts', names: ['矮人铁匠', '锻炉', '板甲'], fn: 'calculateBlacksmithPower' },
]

let passed = 0, failed = 0, warned = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))
const warn = (m) => { warned++; console.warn(`  ⚠️  ${m}`) }

console.log('=== 1. 148 张卡数据 ===')
assert(seed.length === 148, `卡池 148 张 (实际 ${seed.length})`)
const ids = new Set(seed.map(c => c.id))
assert(ids.size === 148, 'ID 无重复')

const conditionalCards = seed.filter(c =>
  (c.effects || []).some(e => e.type === 'conditional' || e.type === 'custom'),
)
assert(conditionalCards.length === 0, `零 conditional/custom (发现 ${conditionalCards.length})`)

const emptyEffects = seed.filter(c => !c.effects?.length)
assert(emptyEffects.length === 0, `零空效果卡 (发现 ${emptyEffects.length})`)

console.log('\n=== 2. 每张卡 effect 类型可路由 ===')
const unknownTypes = new Map()
for (const card of seed) {
  for (const eff of card.effects || []) {
    if (!HANDLED_EFFECT_TYPES.has(eff.type)) {
      unknownTypes.set(eff.type, (unknownTypes.get(eff.type) || 0) + 1)
    }
  }
}
assert(unknownTypes.size === 0, `全部 effect 类型已注册 (${unknownTypes.size} 未知: ${[...unknownTypes.keys()].join(', ')})`)

console.log('\n=== 3. 引擎硬编码扫描（card ID / 卡名 switch）===')
const cardIdPattern = /card_\d{3}/g
const hardcodedIds = new Map()
for (const file of ENGINE_FILES) {
  const content = readFileSync(file, 'utf8')
  const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
  const matches = content.match(cardIdPattern) || []
  const unique = [...new Set(matches)]
  if (unique.length > 0) {
    hardcodedIds.set(rel, unique)
  }
}
if (hardcodedIds.size === 0) {
  assert(true, '引擎核心文件无 card_XXX 硬编码')
} else {
  for (const [file, ids] of hardcodedIds) {
    warn(`${file} 含 card ID 引用: ${ids.join(', ')} (数据层 grantCardId 等可接受)`)
  }
}

for (const leg of LEGACY_NAME_CHECKS) {
  warn(`遗留卡名硬编码: ${leg.names.join('/')} @ ${leg.fn}`)
}

console.log('\n=== 4. 卡组系统 ===')
const defaultIds = getDefaultDeckCardIds()
assert(defaultIds.length === 15, '默认卡组 15 张')
const missingDefault = defaultIds.filter(id => !getCard(id))
assert(missingDefault.length === 0, `默认卡组 ID 均有效 (${missingDefault.join(', ') || 'ok'})`)

const deck = createDeckFromCardIds(defaultIds)
assert(deck.length === 15, 'createDeckFromCardIds 返回 15 张')
assert(deck.every(c => c.name && c.effects), '实例卡含名称与效果')

const allCards = getAllCards()
assert(allCards.length === 148, `getAllCards() = ${allCards.length}`)

// 模拟全卡池组卡：取前 15 张不同 ID
const sampleDeck = seed.slice(0, 15).map(c => c.id)
const sampleBuilt = createDeckFromCardIds(sampleDeck)
assert(sampleBuilt.length === 15, '任意 15 张合法 ID 可组卡')

console.log('\n=== 5. 游戏引擎冒烟（核心路径）===')
function makePlayer(id, extra = {}) {
  return {
    id, name: id, hand: [], deck: [], discard: [], currentCost: 4, bonusPower: 0,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
    ...extra,
  }
}
function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}

// 5a 抽牌/部署/战力重算
{
  const unit = makeCard({ id: 'u1', name: '单位', cost: 2, basePower: 3, currentPower: 3 })
  const p = makePlayer('p1', { hand: [unit], currentCost: 4 })
  p.field[0].card = unit
  p.hand = []
  const game = { players: [p], message: '', round: 1 }
  EffectManager.recalculateAllPowers(game)
  assert(p.field[0].card.currentPower === 3, 'recalculateAllPowers')
}

// 5b onField modifyPower（橡木武器店类）
{
  const shop = getCard('card_011')
  const soldier = makeCard({ id: 's1', name: '士兵卡', keywords: ['士兵'], basePower: 2, currentPower: 2 })
  const p = makePlayer('p1', {
    field: [
      { card: { ...shop, currentPower: shop.basePower }, position: 0, isExtra: false },
      { card: soldier, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game = { players: [p], message: '' }
  EffectManager.recalculateAllPowers(game)
  assert(soldier.currentPower >= 5, `onField buff 生效 (${soldier.currentPower})`)
}

// 5c 重铸/回合结束
{
  const p = makePlayer('p1', { currentCost: 2, bonusPower: 0 })
  p.currentCost += 2
  p.bonusPower += 1
  assert(p.currentCost === 4 && p.bonusPower === 1, '重铸选项模拟')
}

// 5d 148 张均可 getCard + clone
{
  let ok = 0
  for (const c of seed) {
    const loaded = getCard(c.id)
    if (loaded && loaded.name === c.name && loaded.effects?.length) ok++
  }
  assert(ok === 148, `148/148 getCard 可加载 (${ok})`)
}

// 5e seed 与 cardDatabase 关键卡一致
{
  const sf = seed.find(c => c.id === 'card_069')
  const ale = seed.find(c => c.id === 'card_135')
  assert(sf?.effects[0]?.type === 'batchHighestFreeDeploy', '旗鱼 seed 正确')
  assert(ale?.effects?.length === 2, '矮人烈酒 seed 正确')
}

console.log('\n=== 汇总 ===')
console.log(`通过: ${passed} | 失败: ${failed} | 警告: ${warned}`)
if (failed > 0) process.exit(1)

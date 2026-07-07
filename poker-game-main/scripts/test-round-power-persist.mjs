/**
 * 回合战力持久化 + 额外槽部署 回归
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const { getCard } = await import(pathToFileURL(resolve(__dirname, '../server/cardData.js')).href)

function initCard(c) {
  const card = JSON.parse(JSON.stringify(c))
  card.currentPower = card.currentPower ?? card.basePower ?? 0
  card.stackedBonus = 0
  return card
}
let pass = 0
let fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

function makePlayer(id, fieldCards = []) {
  const field = fieldCards.map((card, i) => ({ card, position: i, isExtra: false }))
  return {
    id, name: id, hand: [], deck: [], discard: [], field,
    currentCost: 5, bonusPower: 0, hasPlayedThisTurn: false,
  }
}

function makeGame(players) {
  return { players, round: 2, phase: 'action', message: '', currentPlayerIndex: 0 }
}

console.log('--- roundEnd modifyPower 经 recalculate 保留 ---')
{
  const warrior = initCard(getCard('card_007'))
  const campfire = initCard(getCard('card_071'))
  const p = makePlayer('p1', [campfire, warrior])
  const game = makeGame([p])
  EffectManager.triggerRoundEffects('roundEnd', game)
  assert(warrior.currentPower === warrior.basePower + 1, `篝火后战士 ${warrior.currentPower}`)
  EffectManager.recalculateAllPowers(game)
  assert(warrior.currentPower === warrior.basePower + 1, `recalculate 后仍 +1 (got ${warrior.currentPower})`)
}

console.log('\n--- 寒脊山脉 全局 debuff/buff ---')
{
  const iceEnv = initCard(getCard('card_119'))
  const fireUnit = initCard(getCard('card_072'))
  const iceUnit = initCard(getCard('card_087'))
  const p = makePlayer('p1', [iceEnv, fireUnit, iceUnit])
  const game = makeGame([p])
  EffectManager.triggerRoundEffects('roundEnd', game)
  EffectManager.recalculateAllPowers(game)
  assert(fireUnit.currentPower === fireUnit.basePower - 1, `非冰 -1 (got ${fireUnit.currentPower})`)
  assert(iceUnit.currentPower === iceUnit.basePower + 1, `冰 +1 (got ${iceUnit.currentPower})`)
}

console.log('\n--- 回春术 pendingRoundEndBuff ---')
{
  const unit = initCard(getCard('card_007'))
  const p = makePlayer('p1', [unit])
  p.pendingRoundEndBuffs = [{ targetCardId: unit.id, powerDelta: 1, roundsLeft: 1 }]
  const game = makeGame([p])
  EffectManager.triggerRoundEffects('roundEnd', game)
  EffectManager.recalculateAllPowers(game)
  assert(unit.currentPower === unit.basePower + 1, `回春 +1 保留 (got ${unit.currentPower})`)
}

console.log('\n--- 箭袋 chargeDebuffUnit ---')
{
  const quiver = initCard(getCard('card_018'))
  quiver.charges = 3
  const enemy = initCard(getCard('card_007'))
  const p1 = makePlayer('p1', [quiver])
  const p2 = makePlayer('p2', [enemy])
  const game = makeGame([p1, p2])
  const fx = quiver.effects.find(e => e.type === 'chargeDebuffUnit')
  EffectManager.applyRoundEffect(fx, quiver, p1, game)
  EffectManager.recalculateAllPowers(game)
  assert(enemy.currentPower === enemy.basePower - 1, `箭袋 debuff 保留 (got ${enemy.currentPower})`)
}

console.log('\n--- 额外槽：点击宿主解析 ---')
{
  const pen = initCard(getCard('card_114'))
  const wagon = initCard(getCard('card_002'))
  const p = makePlayer('p1', [pen])
  EffectManager.appendExtraSlot(p, 0, { deployKeywords: ['载具'], deployCardType: 'unit' })
  const extraIdx = EffectManager.resolveDeploySlotIndex(p, wagon, 0)
  assert(extraIdx === 1, `兽栏宿主点击→额外槽 ${extraIdx}`)
  assert(EffectManager.canDeployOnExtraSlot(wagon, p.field[extraIdx]), '驮用马可部署')
}

console.log('\n--- 温馨的旅馆 额外槽 ---')
{
  const inn = initCard(getCard('card_102'))
  const warrior = initCard(getCard('card_007'))
  const p = makePlayer('p1', [inn])
  EffectManager.appendExtraSlot(p, 0, { deployKeywords: ['职业者', '冒险者'], deployCardType: 'unit' })
  const resolved = EffectManager.resolveDeploySlotIndex(p, warrior, 0)
  assert(resolved === 1, `点击旅馆→额外槽 ${resolved}`)
}

console.log('\n--- 海港 额外槽 ---')
{
  const harbor = initCard(getCard('card_109'))
  const p = makePlayer('p1', [harbor])
  EffectManager.appendExtraSlot(p, 0, { deployKeywords: ['船'], deployCardType: 'unit' })
  assert(p.field.length === 2, '海港创建额外槽')
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)

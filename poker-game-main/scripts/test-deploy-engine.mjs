/**
 * 部署引擎 smoke：额外槽位规则 / 属性部署加成 / D6 下限
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- slotRulesFromEffect / buildExtraSlot ---')
{
  const effect = {
    type: 'createSlot',
    slotDeployKeywords: ['船'],
    slotDeployedPowerBonus: 3,
    slotExcludeFromFieldCount: true,
  }
  const rules = EffectManager.slotRulesFromEffect(effect)
  assert(rules.deployKeywords?.[0] === '船', '解析 deployKeywords')
  assert(rules.deployedPowerBonus === 3, '解析 deployedPowerBonus')
  assert(rules.excludeFromFieldCount === true, '解析 excludeFromFieldCount')
  const slot = EffectManager.buildExtraSlot(0, 1, rules)
  assert(slot.isExtra && slot.parentSlot === 0 && slot.deployRules === rules, 'buildExtraSlot 结构')
}

console.log('--- canDeployOnExtraSlot 关键词限制 ---')
{
  const slot = EffectManager.buildExtraSlot(0, 1, { deployKeywords: ['船'] })
  const ship = makeCard({ name: '小艇', keywords: ['船'] })
  const beast = makeCard({ name: '狼', keywords: ['野兽'] })
  assert(EffectManager.canDeployOnExtraSlot(ship, slot), '船可部署到船槽')
  assert(!EffectManager.canDeployOnExtraSlot(beast, slot), '非船不可部署到船槽')
  const sailboat = makeCard({ name: '帆船', type: 'environment', keywords: ['载具'], attribute: '水' })
  assert(EffectManager.canDeployOnExtraSlot(sailboat, slot), '帆船(名称含船)可部署到海港槽')
}

console.log('--- getAvailableSlotIndices 过滤 ---')
{
  const shipSlot = EffectManager.buildExtraSlot(0, 1, { deployKeywords: ['船'] })
  const player = makePlayer('p1', {
    field: [
      { card: makeCard({ name: '海港' }), position: 0, isExtra: false },
      shipSlot,
    ],
  })
  const ship = makeCard({ name: '小艇', keywords: ['船'] })
  const wolf = makeCard({ name: '狼', keywords: ['野兽'] })
  const shipSlots = EffectManager.getAvailableSlotIndices(player, ship)
  const wolfSlots = EffectManager.getAvailableSlotIndices(player, wolf)
  assert(shipSlots.includes(1), '船单位可见额外槽')
  assert(!wolfSlots.includes(1), '非船单位不可见船槽')
}

console.log('--- applyExtraSlotDeployModifiers ---')
{
  const slot = EffectManager.buildExtraSlot(0, 1, {
    deployedPowerBonus: 3,
    excludeFromFieldCount: true,
  })
  const card = makeCard({ name: '狮鹫', basePower: 2, currentPower: 2 })
  const msgs = EffectManager.applyExtraSlotDeployModifiers(card, slot)
  assert(card.basePower === 5 && card.currentPower === 5, '槽位部署 +3 战力')
  assert(card.excludeFromFieldCount === true, '标记不计入终局数量')
  assert(msgs.some(m => m.includes('+3')), '部署加成消息')
}

console.log('--- grantAttributePlayBonus → applyUnitDeployBonuses 消耗 ---')
{
  const player = makePlayer('p1')
  const effect = { type: 'grantAttributePlayBonus', value: 1, targetAttributes: ['风', '火', '水', '土'] }
  EffectManager.applyDeployEffect(effect, makeCard({ name: '萨满祭司' }), player, { players: [player] })
  assert(player.unitPlayAttributeBonus?.风 === 1, '萨满祭司赋予风属性加成')
  const windUnit = makeCard({ name: '风元素', attribute: '风', basePower: 1, currentPower: 1 })
  EffectManager.applyUnitDeployBonuses(windUnit, player)
  assert(windUnit.currentPower === 2, '风单位部署 +1')
  assert(player.unitPlayAttributeBonus?.风 === undefined, '风加成已消耗')
  assert(player.unitPlayAttributeBonus?.火 === 1, '火加成仍保留')
}

console.log('--- setD6MinForCardName → rollD6TierValue 珍珠档 ---')
{
  const player = makePlayer('p1')
  const pearlEffect = {
    type: 'setD6MinForCardName',
    targetName: '贝壳',
    d6Min: 5,
  }
  EffectManager.applyDeployEffect(pearlEffect, makeCard({ name: '珍珠商人' }), player, { players: [player] })
  assert(player.d6MinByCardName?.贝壳 === 5, '贝壳 D6 下限设为 5')
  const shell = makeCard({ name: '贝壳', basePower: 0, currentPower: 0 })
  const d6Effect = {
    type: 'd6TierPower',
    d6Tiers: [
      { min: 1, max: 2, value: 0 },
      { min: 3, max: 4, value: 1 },
      { min: 5, max: 6, value: 5 },
    ],
  }
  // 模拟低掷骰被下限抬高
  const origRoll = EffectManager.rollD6
  EffectManager.rollD6 = () => 1
  const { roll, value } = EffectManager.rollD6TierValue(d6Effect, player, shell)
  EffectManager.rollD6 = origRoll
  assert(roll === 5, '掷骰结果被下限抬高到 5')
  assert(value === 5, '对应珍珠档 +5 战力')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

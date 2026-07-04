/**
 * 4Y smoke：温馨的旅馆 / 哥布林杂兵 / 狂战士
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return {
    id, name: id, hand: [], deck: [], discard: [], currentCost: 4, bonusPower: 0,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
    ...extra,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
{
  const inn = seed.find(x => x.id === 'card_102')
  assert(inn?.effects?.some(e => e.type === 'createSlot'), '温馨的旅馆 createSlot')
  assert(inn?.effects?.some(e => e.requireDeployedOnSelf), '温馨的旅馆 requireDeployedOnSelf')
  const goblin = seed.find(x => x.id === 'card_050')
  assert(goblin?.effects?.[0]?.type === 'discardHandOrSelf', '哥布林杂兵 discardHandOrSelf')
  const berserker = seed.find(x => x.id === 'card_074')
  assert(berserker?.effects?.[0]?.type === 'invertPowerLoss', '狂战士 invertPowerLoss')
}

console.log('--- 温馨的旅馆 roundEnd ---')
{
  const inn = makeCard({
    name: '温馨的旅馆', type: 'environment', basePower: 1, currentPower: 1,
    effects: seed.find(x => x.id === 'card_102').effects,
  })
  const guest = makeCard({ name: '圣洁骑士', keywords: ['职业者'], type: 'unit' })
  const me = makePlayer('p1', {
    field: [
      { card: inn, position: 0, isExtra: false },
      { card: guest, position: 6, isExtra: true, parentSlot: 0, deployRules: { deployKeywords: ['职业者', '冒险者'], deployCardType: 'unit', excludeFromFieldCount: true } },
      ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false })),
    ],
  })
  const game = { players: [me], message: '' }
  assert(EffectManager.countDeployedOnHost(inn, me) === 1, '宿主上有1张部署')
  const energyFx = inn.effects.find(e => e.timing === 'roundEnd' && e.type === 'restoreEnergy')
  const r1 = EffectManager.applyRoundEffect(energyFx, inn, me, game)
  assert(me.currentCost === 5, `回复1能量 (got ${me.currentCost})`)
  assert(r1.messages.some(m => m.includes('恢复')), '有恢复消息')
  const powerFx = inn.effects.find(e => e.timing === 'roundEnd' && e.type === 'modifyPower')
  EffectManager.applyRoundEffect(powerFx, inn, me, game)
  assert(inn.currentPower === 2, `旅馆战力+1 (got ${inn.currentPower})`)
  const emptyInn = makeCard({ name: '温馨的旅馆', type: 'environment', basePower: 1, currentPower: 1, effects: inn.effects })
  const me2 = makePlayer('p2', { field: [{ card: emptyInn, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const before = me2.currentCost
  EffectManager.applyRoundEffect(energyFx, emptyInn, me2, { players: [me2], message: '' })
  assert(me2.currentCost === before, '无部署时不触发')
}

console.log('--- 哥布林杂兵 discardHandOrSelf ---')
{
  const goblin = makeCard({ name: '哥布林杂兵', effects: seed.find(x => x.id === 'card_050').effects })
  const handCard = makeCard({ name: '测试手牌' })
  const me = makePlayer('p1', { hand: [handCard], field: [{ card: goblin, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const fx = goblin.effects[0]
  const r = EffectManager.applyRevealEffect(fx, goblin, me, { players: [me], message: '' })
  assert(me.hand.length === 0 && me.discard.length === 1, '有手牌时弃置手牌')
  assert(me.field[0].card === goblin, '哥布林仍在场上')
  const goblin2 = makeCard({ name: '哥布林杂兵', effects: goblin.effects })
  const me2 = makePlayer('p2', { field: [{ card: goblin2, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  EffectManager.applyRevealEffect(fx, goblin2, me2, { players: [me2], message: '' })
  assert(me2.field[0].card === null && me2.discard.some(c => c.name === '哥布林杂兵'), '无手牌时自身进弃牌区')
}

console.log('--- 狂战士 invertPowerLoss ---')
{
  const berserker = makeCard({ name: '狂战士', basePower: 2, currentPower: 2, effects: seed.find(x => x.id === 'card_074').effects })
  const me = makePlayer('p1')
  EffectManager.applyDeployEffect(berserker.effects[0], berserker, me, { players: [me], message: '' })
  assert(berserker.invertPowerLoss === true, '标记 invertPowerLoss')
  const delta = EffectManager.applyCardPowerDelta(berserker, -3)
  assert(delta === 3 && berserker.currentPower === 5, `战力-3变+3 (got ${berserker.currentPower})`)
  const destroyFx = { type: 'destroy', value: -2, destroyThreshold: 0 }
  berserker.currentPower = 4
  berserker.basePower = 4
  const r = EffectManager.applyDestroyToTarget(berserker, destroyFx, { players: [me], message: '' })
  assert(!r.destroyed && berserker.currentPower === 6, `减战力变加且不摧毁 (got ${berserker.currentPower})`)
}

console.log(`\n--- 4Y: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

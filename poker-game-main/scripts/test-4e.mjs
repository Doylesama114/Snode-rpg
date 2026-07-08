/**
 * 4E 批次 smoke：季风 / 篝火 / 垂钓客
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return { id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无', basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: false, ...o }
}
function makePlayer(id, field = [], deck = [], hand = []) {
  return { id, name: id, hand: [...hand], deck: [...deck], discard: [], field: field.map((c, i) => ({ card: c, position: i, isExtra: false })), currentCost: 4, canPlayExtra: false }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 季风 getEffectivePlayCost ---')
{
  const monsoon = makeCard({
    name: '季风', type: 'environment', attribute: '风',
    effects: [{ timing: 'onField', type: 'modifyPlayCost', value: -1, targetAttributes: ['风'], description: '' }],
  })
  const windUnit = makeCard({ name: '风单位', attribute: '风', cost: 3 })
  const fireUnit = makeCard({ name: '火单位', attribute: '火', cost: 3 })
  const player = makePlayer('p1', [monsoon])
  assert(EffectManager.getEffectivePlayCost(windUnit, player) === 2, '风属性费用 3→2')
  assert(EffectManager.getEffectivePlayCost(fireUnit, player) === 3, '非风属性费用不变')
  assert(EffectManager.getEffectivePlayCost(makeCard({ attribute: '风', cost: 0 }), player) === 0, '费用不低于 0')
}

console.log('--- 篝火 roundEnd targetOtherOnField ---')
{
  const campfire = makeCard({ name: '篝火', type: 'unit', attribute: '火' })
  const ally = makeCard({ name: '盟友', type: 'unit', attribute: '火', currentPower: 2, basePower: 2 })
  const water = makeCard({ name: '水人', type: 'unit', attribute: '水', currentPower: 1, basePower: 1 })
  const player = makePlayer('p1', [campfire, ally, water])
  const r = EffectManager.applyRoundEffect({
    type: 'modifyPower', value: 1, targetOtherOnField: true, excludeSelf: true,
    targetCardType: 'unit', excludeAttributes: ['水'], timing: 'roundEnd',
  }, campfire, player, { players: [player], message: '' })
  assert(ally.currentPower === 3 && water.currentPower === 1 && campfire.currentPower === 1, '仅非水其他单位 +1')
  assert(r.messages.length === 1, '有触发消息')
}

console.log('--- 垂钓客 d6Min draw ---')
{
  const fisher = makeCard({ name: '垂钓客' })
  const deckCard = makeCard({ name: '抽到的牌' })
  const player = makePlayer('p1', [fisher], [deckCard])
  const origRoll = EffectManager.rollD6
  EffectManager.rollD6 = () => 2
  const rLow = EffectManager.applyRoundEffect({ type: 'draw', drawCount: 1, d6Min: 4, timing: 'roundStart' }, fisher, player, { players: [player], message: '' })
  assert(player.hand.length === 0 && rLow.messages.some(m => m.includes('未触发')), 'D6=2 不抽牌')
  EffectManager.rollD6 = () => 5
  const rHigh = EffectManager.applyRoundEffect({ type: 'draw', drawCount: 1, d6Min: 4, timing: 'roundStart' }, fisher, player, { players: [player], message: '' })
  assert(player.hand.length === 1 && player.hand[0].name === '抽到的牌', 'D6=5 抽牌')
  EffectManager.rollD6 = origRoll
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

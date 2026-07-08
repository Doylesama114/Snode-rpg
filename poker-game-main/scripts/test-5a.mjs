/**
 * 5A smoke：雪怪 / 寒铁虎 / 间歇泉
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
  const yeti = seed.find(x => x.id === 'card_088')
  assert(yeti?.effects?.[0]?.type === 'conditionalPlayCost', '雪怪 conditionalPlayCost')
  assert(yeti?.effects?.[0]?.playCostValue === 1, '雪怪费用 1')
  const tiger = seed.find(x => x.id === 'card_089')
  assert(tiger?.effects?.[0]?.directDestroy === true, '寒铁虎 directDestroy')
  const geyser = seed.find(x => x.id === 'card_137')
  assert(geyser?.effects?.[0]?.type === 'scheduleRoundStartEnergy', '间歇泉 scheduleRoundStartEnergy')
}

console.log('--- 雪怪 冰环境费用 ---')
{
  const yeti = makeCard({ name: '雪怪', cost: 2, effects: seed.find(x => x.id === 'card_088').effects })
  const iceEnv = makeCard({ name: '冰原', type: 'environment', attribute: '冰' })
  const p1 = makePlayer('p1', {
    field: [{ card: iceEnv, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  assert(EffectManager.getEffectivePlayCost(yeti, p1) === 1, `有冰环境费用 1 (got ${EffectManager.getEffectivePlayCost(yeti, p1)})`)
  const p2 = makePlayer('p2')
  assert(EffectManager.getEffectivePlayCost(yeti, p2) === 2, '无冰环境费用 2')
}

console.log('--- 寒铁虎 摧毁左手边低战力单位 ---')
{
  const tiger = makeCard({ name: '寒铁虎', effects: seed.find(x => x.id === 'card_089').effects })
  const iceEnv = makeCard({ name: '冰原', type: 'environment', attribute: '冰' })
  const weak = makeCard({ name: '弱单位', type: 'unit', basePower: 2, currentPower: 2 })
  const strong = makeCard({ name: '强单位', type: 'unit', basePower: 3, currentPower: 3 })
  const p1 = makePlayer('p1', {
    field: [{ card: iceEnv, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  const p2 = makePlayer('p2', {
    field: [
      { card: weak, position: 0, isExtra: false },
      { card: strong, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game = { players: [p1, p2], message: '' }
  const fx = tiger.effects[0]
  const targets = EffectManager.getDestroyTargets(game, p1, fx)
  assert(targets.length === 1 && targets[0].name === '弱单位', `仅弱单位可摧毁 (got ${targets.length})`)
  const r = EffectManager.applyRevealEffect(fx, tiger, p1, game)
  assert(p2.field[0].card === null && p2.discard.some(c => c.name === '弱单位'), '弱单位被摧毁')
  assert(p2.field[1].card?.name === '强单位', '强单位仍在')
}

console.log('--- 间歇泉 预约能量 ---')
{
  const geyser = makeCard({ name: '间歇泉', type: 'tactic', effects: seed.find(x => x.id === 'card_137').effects })
  const p1 = makePlayer('p1', { currentCost: 2 })
  const fx = geyser.effects[0]
  EffectManager.applyRevealEffect(fx, geyser, p1, { players: [p1], message: '', isFinalRound: false })
  assert(p1.pendingNextRoundStartEnergy === 3, '预约下回合 +3')
  assert(p1.pendingFinalRoundStartEnergy === 3, '预约最后一轮 +3')
  const msgs = EffectManager.applyPendingRoundStartEnergy({ players: [p1], isFinalRound: false })
  assert(p1.currentCost === 5 && p1.pendingNextRoundStartEnergy === 0, `下回合触发 +3 (cost ${p1.currentCost})`)
  assert(p1.pendingFinalRoundStartEnergy === 3, '最后一轮预约仍保留')
  p1.currentCost = 2
  const msgs2 = EffectManager.applyPendingRoundStartEnergy({ players: [p1], isFinalRound: true })
  assert(p1.currentCost === 5 && p1.pendingFinalRoundStartEnergy === 0, `最后一轮 +3 (cost ${p1.currentCost})`)
}

console.log(`\n--- 5A: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

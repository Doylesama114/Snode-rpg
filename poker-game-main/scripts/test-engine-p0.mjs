/**
 * P0 盖牌批次引擎 smoke：batchHighestFreeDeploy / moveOpponentBatchReveal / forceRandomHandPlay
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
  return {
    id, name: id, hand: [], deck: [], discard: [], currentCost: 4, bonusPower: 0,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
    ...extra,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- getBatchEffectivePower ---')
{
  assert(EffectManager.getBatchEffectivePower(makeCard({ type: 'unit', currentPower: 3 })) === 3, '单位战力')
  assert(EffectManager.getBatchEffectivePower(makeCard({ type: 'tactic' })) === 0, '战术=0')
  assert(EffectManager.getBatchEffectivePower(makeCard({ type: 'environment', currentPower: 2 })) === 2, '环境战力')
}

console.log('--- batchHighestFreeDeploy ---')
{
  const sailfish = makeCard({
    id: 'sf', name: '旗鱼', type: 'unit', currentPower: 5, cost: 4,
    effects: [{ timing: 'onBatchReveal', type: 'batchHighestFreeDeploy', description: 'x' }],
  })
  const weak = makeCard({ id: 'w', name: '弱单位', type: 'unit', currentPower: 2 })
  const p1 = makePlayer('p1', { currentCost: 0 })
  const p2 = makePlayer('p2', { currentCost: 2 })
  p1.field[0].card = sailfish
  p2.field[0].card = weak
  const game = {
    players: [p1, p2],
    message: '',
    pendingReveals: {
      p1: [{ card: sailfish, slotIndex: 0, playCost: 4 }],
      p2: [{ card: weak, slotIndex: 0, playCost: 2 }],
    },
  }
  const r = EffectManager.resolveRevealBatch(game)
  assert(p1.currentCost === 4, '旗鱼退还4费用')
  assert(r.messages.some(m => m.includes('战力最高')), '有退还消息')
}

console.log('--- moveOpponentBatchRevealToDeckBottom ---')
{
  const oppUnit = makeCard({ id: 'ou', name: '对手单位', type: 'unit', currentPower: 3 })
  const ale = makeCard({
    id: 'ale', name: '矮人烈酒', type: 'tactic',
    effects: [{ timing: 'onReveal', type: 'moveOpponentBatchRevealToDeckBottom', targetLeftPlayer: true, batchResolveOnly: true, description: 'x' }],
  })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { deck: [] })
  p2.field[0].card = oppUnit
  p1.field[1].card = ale
  const game = {
    players: [p1, p2],
    message: '',
    pendingReveals: {
      p1: [{ card: ale, slotIndex: 1, playCost: 0 }],
      p2: [{ card: oppUnit, slotIndex: 0, playCost: 3 }],
    },
  }
  const r = EffectManager.resolveRevealBatch(game)
  assert(p2.field[0].card === null, '对手单位离场')
  assert(p2.deck[0]?.name === '对手单位', '置于牌库底')
  assert(r.messages.some(m => m.includes('牌库底')), '有置库底消息')
}

console.log('--- forceRandomHandPlay ---')
{
  const forced = makeCard({ id: 'fh', name: '被迫牌', type: 'unit', currentPower: 2, cost: 3 })
  const ale = makeCard({
    id: 'ale2', name: '烈酒', type: 'tactic',
    effects: [
      { timing: 'onReveal', type: 'forceRandomHandPlay', targetLeftPlayer: true, batchResolveOnly: true, description: 'x' },
    ],
  })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { hand: [forced], currentCost: 1 })
  p1.field[0].card = ale
  const game = {
    players: [p1, p2],
    message: '',
    pendingReveals: {
      p1: [{ card: ale, slotIndex: 0, playCost: 0 }],
    },
  }
  EffectManager.resolveRevealBatch(game)
  assert(p2.hand.length === 0, '手牌被打出')
  assert(p2.field.some(s => s.card?.name === '被迫牌'), '强制部署到场')
  assert(p2.currentCost === -2, '费用可降至负数')
}

console.log(`\nP0 engine smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

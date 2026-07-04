/**
 * 5E smoke：旗鱼 / 矮人烈酒
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

console.log('--- card-seed 结构化 ---')
for (const id of ['card_069', 'card_135']) {
  const c = seed.find(x => x.id === id)
  assert(c && !c.effects.every(e => e.type === 'conditional'), `${c?.name} (${id}) 已结构化`)
}

console.log('--- 旗鱼 batchHighestFreeDeploy ---')
{
  const sailfishSeed = seed.find(x => x.id === 'card_069')
  assert(sailfishSeed.effects[0].type === 'batchHighestFreeDeploy', 'effect type')
  assert(sailfishSeed.effects[0].timing === 'onBatchReveal', 'timing onBatchReveal')

  const sailfish = { ...makeCard({ id: 'sf', name: '旗鱼', currentPower: 5, cost: 4 }), effects: sailfishSeed.effects }
  const weak = makeCard({ id: 'w', name: '弱单位', currentPower: 2 })
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
  EffectManager.resolveRevealBatch(game)
  assert(p1.currentCost === 4, '战力最高退还4费用')
}

console.log('--- 矮人烈酒 双效果 ---')
{
  const aleSeed = seed.find(x => x.id === 'card_135')
  assert(aleSeed.effects.length === 2, '两条结构化效果')
  assert(aleSeed.effects.every(e => e.batchResolveOnly), 'batchResolveOnly')
  assert(aleSeed.effects[0].type === 'moveOpponentBatchRevealToDeckBottom', '置库底')
  assert(aleSeed.effects[1].type === 'forceRandomHandPlay', '强打手牌')

  const oppUnit = makeCard({ id: 'ou', name: '对手单位', type: 'unit', currentPower: 3 })
  const forced = makeCard({ id: 'fh', name: '被迫牌', type: 'unit', cost: 2 })
  const ale = { ...makeCard({ id: 'ale', name: '矮人烈酒', type: 'tactic' }), effects: aleSeed.effects }
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { hand: [forced], deck: [], currentCost: 1 })
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
  EffectManager.resolveRevealBatch(game)
  assert(p2.deck[0]?.name === '对手单位', '展示牌置库底')
  assert(p2.field.some(s => s.card?.name === '被迫牌'), '强制打出')
}

console.log(`\n5E smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

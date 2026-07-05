/**
 * 揭示批次：按玩家顺序结算，费用被降至零以下时退回手牌
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 3, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return {
    id, name: id, hand: [], deck: [], discard: [], currentCost: 0, bonusPower: 0,
    hasPlayedThisTurn: true,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
    ...extra,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 费用降至零以下：后手玩家退回手牌 ---')
{
  const missile = makeCard({
    id: 'm', name: '魔法飞弹', type: 'tactic', cost: 0,
    effects: [{
      timing: 'onReveal', type: 'modifyCost', value: -2, targetLeftPlayer: true, batchResolveOnly: true,
    }],
  })
  const unit = makeCard({ id: 'u', name: '士兵', cost: 3, currentPower: 3 })
  const p1 = makePlayer('p1', { currentCost: 4 })
  const p2 = makePlayer('p2', { currentCost: 0, hand: [] })
  p1.field[0].card = missile
  p2.field[1].card = unit
  const game = {
    players: [p1, p2],
    message: '',
    pendingReveals: {
      p1: [{ card: missile, slotIndex: 0, playCost: 0 }],
      p2: [{ card: unit, slotIndex: 1, playCost: 3 }],
    },
  }
  const r = EffectManager.resolveRevealBatch(game)
  assert(p2.hand.length === 1 && p2.hand[0].name === '士兵', '士兵退回手牌')
  assert(p2.field[1].card === null, '场上槽位清空')
  assert(p2.currentCost === -2, '费用不退还，保持被飞弹扣除后的-2')
  assert(!p2.hasPlayedThisTurn, '视为未出牌')
  assert(r.messages.some(m => m.includes('退回手牌')), '有退回消息')
}

console.log(`\nreveal cost void: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

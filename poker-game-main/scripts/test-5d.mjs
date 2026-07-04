/**
 * 5D smoke：14 张 P1 就绪卡
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

const IDS = [
  'card_018', 'card_048', 'card_065', 'card_068', 'card_081', 'card_082', 'card_085',
  'card_096', 'card_097', 'card_098', 'card_106', 'card_123', 'card_131', 'card_142',
]

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

console.log('--- card-seed 14 张结构化 ---')
for (const id of IDS) {
  const c = seed.find(x => x.id === id)
  assert(c && !c.effects.every(e => e.type === 'conditional'), `${c?.name} (${id}) 已结构化`)
}

console.log('--- 箭袋 充能 ---')
{
  const fx = seed.find(x => x.id === 'card_018').effects
  assert(fx.some(e => e.type === 'initCharges'), 'initCharges')
  assert(fx.some(e => e.type === 'chargeDebuffUnit'), 'chargeDebuffUnit')
}

console.log('--- 刺客 摧毁 ---')
{
  const fx = seed.find(x => x.id === 'card_098').effects[0]
  const victim = makeCard({ id: 'v1', name: '弱兵', type: 'unit', basePower: 2, currentPower: 2 })
  const assassin = makeCard({ name: '刺客', effects: [fx] })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { field: [{ card: victim, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  EffectManager.applyRevealEffect(fx, assassin, p1, { players: [p1, p2], message: '' })
  assert(p2.field[0].card === null, '摧毁低战力单位')
}

console.log('--- 棕榈树 检索+计数 ---')
{
  const palm = makeCard({ id: 'palm', name: '棕榈树', type: 'environment', basePower: 1, currentPower: 1, effects: seed.find(x => x.id === 'card_106').effects })
  const wood = makeCard({ name: '木牌', attribute: '木' })
  const light = makeCard({ name: '光牌', attribute: '光' })
  const p1 = makePlayer('p1', { deck: [wood], hand: [light] })
  const game = { players: [p1], message: '' }
  EffectManager.applyRevealEffect(palm.effects[0], palm, p1, game)
  EffectManager.applyRevealEffect(palm.effects[1], palm, p1, game)
  assert(p1.hand.some(c => c.attribute === '木') && palm.currentPower >= 2, `检索木牌+光木计数 (power=${palm.currentPower})`)
}

console.log('--- 回春术 战术 ---')
{
  const fx = seed.find(x => x.id === 'card_131').effects[0]
  assert(fx.timing === 'onReveal' && fx.type === 'scheduleRoundEndBuff', '回春术 onReveal scheduleRoundEndBuff')
}

console.log('--- 冰锥术 封锁 ---')
{
  const fx = seed.find(x => x.id === 'card_142').effects[0]
  const ice = makeCard({ name: '冰牌', attribute: '冰' })
  const handCard = makeCard({ id: 'h2', name: '对方手牌' })
  const tactic = makeCard({ name: '冰锥术', type: 'tactic', effects: [fx] })
  const p1 = makePlayer('p1', { hand: [ice] })
  const p2 = makePlayer('p2', { hand: [handCard] })
  EffectManager.applyRevealEffect(fx, tactic, p1, { players: [p1, p2], message: '' })
  assert(p1.hand.length === 0 && p2.lockedHandCards?.h2 === 'finalRoundOnly', '弃冰牌并封锁对手手牌')
}

console.log(`\n5D smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

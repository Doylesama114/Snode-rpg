/**
 * 5B smoke：征募官 / 强盗 / 攀爬工具
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
  const recruiter = seed.find(x => x.id === 'card_035')
  assert(recruiter?.effects?.[0]?.type === 'grantCopiesToHand', '征募官 grantCopiesToHand')
  assert(recruiter?.effects?.[0]?.grantCostOverride === 0, '征募官 0费民兵')
  const bandit = seed.find(x => x.id === 'card_031')
  assert(bandit?.effects?.some(e => e.type === 'stealCard'), '强盗 stealCard')
  assert(bandit?.effects?.some(e => e.requireGlobalFieldKeyword === '士兵'), '强盗 士兵减战力')
  const climb = seed.find(x => x.id === 'card_023')
  assert(climb?.effects?.[0]?.type === 'playRandomFromDeckOrTop', '攀爬工具 playRandomFromDeckOrTop')
}

console.log('--- 征募官 民兵 x2 ---')
{
  const recruiter = makeCard({ name: '征募官', effects: seed.find(x => x.id === 'card_035').effects })
  const p1 = makePlayer('p1')
  const fx = recruiter.effects[0]
  EffectManager.applyRevealEffect(fx, recruiter, p1, { players: [p1], message: '' })
  assert(p1.hand.length === 2, `手牌+2 (got ${p1.hand.length})`)
  assert(p1.hand.every(c => c.name === '民兵' && c.cost === 0), '两张0费民兵')
}

console.log('--- 强盗 偷牌 + 士兵减战力 ---')
{
  const bandit = makeCard({ name: '强盗', basePower: 1, currentPower: 1, effects: seed.find(x => x.id === 'card_031').effects })
  const handCard = makeCard({ name: '对方手牌' })
  const soldier = makeCard({ name: '利剑中队', keywords: ['士兵'] })
  const p1 = makePlayer('p1', { field: [{ card: bandit, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const p2 = makePlayer('p2', { hand: [handCard], field: [{ card: soldier, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const game = { players: [p1, p2], message: '' }
  EffectManager.applyRevealEffect(bandit.effects[0], bandit, p1, game)
  assert(p1.hand.length === 1 && p2.hand.length === 0, '偷取手牌')
  bandit.currentPower = 1
  EffectManager.applyRevealEffect(bandit.effects[1], bandit, p1, game)
  assert(bandit.currentPower === -2, `士兵在场战力-3 (got ${bandit.currentPower})`)
}

console.log('--- 攀爬工具 随机打出 ---')
{
  const climb = makeCard({ name: '攀爬工具', effects: seed.find(x => x.id === 'card_023').effects })
  const cheap = makeCard({ name: '苦工', type: 'unit', cost: 1, basePower: 1, currentPower: 1 })
  const p1 = makePlayer('p1', { currentCost: 4, deck: [cheap] })
  const fx = climb.effects[0]
  EffectManager.applyRevealEffect(fx, climb, p1, { players: [p1], message: '' })
  assert(p1.deck.length === 0 && p1.field.some(s => s.card?.name === '苦工'), '成功随机打出')
  assert(p1.currentCost === 3, `支付1费 (got ${p1.currentCost})`)
  const expensive = makeCard({ name: '雷龙', type: 'unit', cost: 12, basePower: 6, currentPower: 6 })
  const p2 = makePlayer('p2', { currentCost: 4, deck: [expensive] })
  EffectManager.applyRevealEffect(fx, climb, p2, { players: [p2], message: '' })
  assert(p2.deck[0]?.name === '雷龙' && p2.field.every(s => !s.card), '费用不足放回牌库顶')
}

console.log(`\n--- 5B: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

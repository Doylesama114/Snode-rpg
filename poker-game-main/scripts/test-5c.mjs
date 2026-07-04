/**
 * 5C smoke：急先锋·罗森弗斯 / 巨鹏 / 走私船
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
  const vanguard = seed.find(x => x.id === 'card_086')
  assert(vanguard?.effects?.[0]?.type === 'autoEnterFromZone', '急先锋 autoEnterFromZone')
  assert(vanguard?.effects?.[0]?.firstRoundOnly === true, '急先锋 firstRoundOnly')
  const roc = seed.find(x => x.id === 'card_084')
  assert(roc?.effects?.[0]?.type === 'absorbLeftPlayerUnit', '巨鹏 absorbLeftPlayerUnit')
  assert(roc?.effects?.[0]?.maxBasePower === 1, '巨鹏 maxBasePower 1')
  const smuggler = seed.find(x => x.id === 'card_055')
  assert(smuggler?.effects?.[0]?.type === 'stashHandUnderSelf', '走私船 stashHandUnderSelf')
  assert(smuggler?.effects?.[0]?.powerPerStashedCard === 5, '走私船 +5/张')
}

console.log('--- 急先锋 首回合自动进场 ---')
{
  const fx = seed.find(x => x.id === 'card_086').effects[0]
  const vanguard = makeCard({
    id: 'card_086', name: '急先锋·罗森弗斯', cost: 11, basePower: 4, currentPower: 4, effects: [fx],
  })
  const p1 = makePlayer('p1', { currentCost: 12, deck: [vanguard] })
  const game = { players: [p1], round: 1, message: '' }
  const msgs = EffectManager.applyFirstRoundAutoEntries(game)
  assert(p1.deck.length === 0 && p1.field.some(s => s.card?.name === '急先锋·罗森弗斯'), '从牌库自动进场')
  assert(p1.currentCost === 1, `支付11费 (got ${p1.currentCost})`)
  assert(msgs.some(m => m.includes('首回合自动进场')), '触发消息')
}

console.log('--- 巨鹏 吸收左手边低战力单位 ---')
{
  const fx = seed.find(x => x.id === 'card_084').effects[0]
  const roc = makeCard({ name: '巨鹏', basePower: 2, currentPower: 2, effects: [fx] })
  const weak = makeCard({ name: '哥布林', type: 'unit', basePower: 1, currentPower: 1 })
  const strong = makeCard({ name: '骑士', type: 'unit', basePower: 3, currentPower: 3 })
  const p1 = makePlayer('p1', {
    field: [{ card: roc, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  const p2 = makePlayer('p2', {
    field: [
      { card: strong, position: 0, isExtra: false },
      { card: weak, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game = { players: [p1, p2], message: '' }
  EffectManager.applyDeployEffect(fx, roc, p1, game)
  assert(p2.field[0]?.card?.name === '骑士', '跳过高战力单位')
  assert(p2.field[1]?.card === null && p2.discard.some(c => c.name === '哥布林'), '吸收低战力单位')
  assert(roc.currentPower === 3 && roc.stackedBonus === 1, `巨鹏战力+1 (got ${roc.currentPower})`)
}

console.log('--- 走私船 隐藏手牌 ---')
{
  const fx = seed.find(x => x.id === 'card_055').effects[0]
  const smuggler = makeCard({ name: '走私船', basePower: 2, currentPower: 2, effects: [fx] })
  const h1 = makeCard({ name: '手牌A' })
  const h2 = makeCard({ name: '手牌B' })
  const p1 = makePlayer('p1', { hand: [h1, h2] })
  EffectManager.applyRevealEffect(fx, smuggler, p1, { players: [p1], message: '' })
  assert(p1.hand.length === 0 && p1.discard.length === 2, '手牌移入弃牌堆')
  assert(smuggler.currentPower === 12 && smuggler.stackedBonus === 10, `2张×+5 (got ${smuggler.currentPower})`)
}

console.log(`\n5C smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

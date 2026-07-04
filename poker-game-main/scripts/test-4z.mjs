/**
 * 4Z smoke：牛头人勇士 / 火蜥蜴 / 雪狼
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
  const minotaur = seed.find(x => x.id === 'card_080')
  assert(minotaur?.effects?.[0]?.type === 'skipOthersDrawNextRound', '牛头人 skipOthersDrawNextRound')
  const salamander = seed.find(x => x.id === 'card_072')
  assert(salamander?.effects?.[0]?.type === 'discardHandForLeftPlayerDebuff', '火蜥蜴 discardHandForLeftPlayerDebuff')
  const wolf = seed.find(x => x.id === 'card_087')
  assert(wolf?.effects?.[0]?.searchAttribute === '冰', '雪狼 searchAttribute 冰')
}

console.log('--- 牛头人勇士 跳过抽牌 ---')
{
  const minotaur = makeCard({ name: '牛头人勇士', effects: seed.find(x => x.id === 'card_080').effects })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { skipDrawNextRound: false })
  const game = { players: [p1, p2], message: '' }
  EffectManager.applyDeployEffect(minotaur.effects[0], minotaur, p1, game)
  assert(p2.skipDrawNextRound === true, '对手标记 skipDrawNextRound')
  assert(!p1.skipDrawNextRound, '自身不标记')
}

console.log('--- 火蜥蜴 roundStart ---')
{
  const salamander = makeCard({
    name: '火蜥蜴', attribute: '火',
    effects: seed.find(x => x.id === 'card_072').effects,
  })
  const fireHand = makeCard({ name: '火球', attribute: '火' })
  const p1 = makePlayer('p1', {
    hand: [fireHand],
    field: [{ card: salamander, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  const p2 = makePlayer('p2', { bonusPower: 0 })
  const game = { players: [p1, p2], message: '' }
  const fx = salamander.effects[0]
  const r = EffectManager.applyRoundEffect(fx, salamander, p1, game)
  assert(p1.hand.length === 0 && p1.discard.length === 1, '弃置火属性手牌')
  assert(p2.bonusPower === -2, `左手边终局-2 (got ${p2.bonusPower})`)
  assert(salamander.roundUsed === true, '标记 oncePerRound')
  const r2 = EffectManager.applyRoundEffect(fx, salamander, p1, game)
  assert(r2.messages.length === 0, '同回合不再触发')
}

console.log('--- 雪狼 searchAttribute ---')
{
  const wolf = makeCard({ name: '雪狼', effects: seed.find(x => x.id === 'card_087').effects })
  const iceCard = makeCard({ name: '冰锥', attribute: '冰' })
  const fireCard = makeCard({ name: '火球', attribute: '火' })
  const p1 = makePlayer('p1', { deck: [fireCard, iceCard] })
  const fx = wolf.effects[0]
  const r = EffectManager.applyRevealEffect(fx, wolf, p1, { players: [p1], message: '' })
  assert(p1.hand.length === 1 && p1.hand[0].attribute === '冰', '检索冰属性')
  assert(p1.deck.length === 1 && p1.deck[0].attribute === '火', '牌库剩非冰牌')
  assert(r.messages.some(m => m.includes('检索')), '有检索消息')
}

console.log(`\n--- 4Z: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

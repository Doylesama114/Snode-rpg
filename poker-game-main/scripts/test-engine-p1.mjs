/**
 * P1 机制引擎 smoke：充能 / 回春 / 封锁 / 限制 / scry / 分支 / 复制 / 牺牲
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

console.log('--- initCharges + chargeDebuffUnit ---')
{
  const quiver = makeCard({ id: 'q1', name: '箭袋', charges: 3, maxCharges: 3 })
  const target = makeCard({ id: 'u1', name: '民兵', type: 'unit', basePower: 2, currentPower: 2 })
  const p1 = makePlayer('p1', { field: [{ card: quiver, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const p2 = makePlayer('p2', { field: [{ card: target, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const fx = { type: 'chargeDebuffUnit', value: -1, oncePerRound: true, timing: 'roundStart' }
  const game = { players: [p1, p2], round: 2, message: '' }
  EffectManager.applyRoundEffect(fx, quiver, p1, game)
  assert(quiver.charges === 2 && target.currentPower === 1, '消耗充能 -1 战力')
}

console.log('--- scheduleRoundEndBuff ---')
{
  const unit = makeCard({ id: 'u2', name: '苦工', basePower: 1, currentPower: 1 })
  const p1 = makePlayer('p1', { field: [{ card: unit, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const fx = { type: 'scheduleRoundEndBuff', roundEndBuffRounds: 2, roundEndBuffPower: 1, selfTarget: false, timing: 'onReveal' }
  const game = { players: [p1], message: '' }
  EffectManager.applyRevealEffect(fx, unit, p1, game)
  assert(p1.pendingRoundEndBuffs?.length === 1, '预约 buff')
  EffectManager.triggerRoundEffects('roundEnd', game)
  assert(unit.currentPower === 2, '第一回合结束 +1')
  EffectManager.triggerRoundEffects('roundEnd', game)
  assert(unit.currentPower === 3 && !p1.pendingRoundEndBuffs, '第二回合结束 +1 并清除')
}

console.log('--- lockRandomHandCards + canPlayHandCard ---')
{
  const locked = makeCard({ id: 'h1', name: '被锁牌' })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', { hand: [locked], lockedHandCards: { h1: 'finalRoundOnly' } })
  const game = { players: [p1, p2], isFinalRound: false, message: '' }
  assert(!EffectManager.canPlayHandCard(locked, p2, game), '非最后一轮不可打出封锁牌')
  game.isFinalRound = true
  EffectManager.unlockFinalRoundHandCards(game)
  assert(EffectManager.canPlayHandCard(locked, p2, game), '最后一轮解锁后可打出')
}

console.log('--- restrictAdjacentPlayType + playerMustSkipTurn ---')
{
  const unit = makeCard({ id: 'u3', name: '单位', type: 'unit' })
  const tactic = makeCard({ id: 't1', name: '战术', type: 'tactic' })
  const singer = makeCard({ name: '潮汐歌者' })
  const p1 = makePlayer('p1', { field: [{ card: singer, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  const p2 = makePlayer('p2', { hand: [tactic], restrictNextPlayType: 'unit' })
  const game = { players: [p1, p2], message: '' }
  const fx = { type: 'restrictAdjacentPlayType', requiredPlayType: 'unit', timing: 'onReveal' }
  EffectManager.applyRevealEffect(fx, singer, p1, game)
  assert(p2.restrictNextPlayType === 'unit', '设置出牌类型限制')
  assert(EffectManager.playerMustSkipTurn(p2, game), '无单位牌应跳过回合')
  p2.hand.push(unit)
  assert(!EffectManager.playerMustSkipTurn(p2, game), '有单位牌可不跳过')
}

console.log('--- scryDeckTop + peekDeckBottom ---')
{
  const low = makeCard({ name: '低', basePower: 1 })
  const high = makeCard({ name: '高', basePower: 5 })
  const mid = makeCard({ name: '中', basePower: 3 })
  const p1 = makePlayer('p1', { deck: [low, mid, high] })
  const game = { players: [p1], message: '' }
  EffectManager.applyRoundEffect({ type: 'scryDeckTop', scryCount: 3, scryTake: 1, timing: 'roundStart' }, makeCard({ name: '塔' }), p1, game)
  assert(p1.hand[0]?.name === '高', '占卜取最高战力')
  assert(p1.deck.length === 2, '其余回库')
  p1.deck = [makeCard({ name: '底牌', id: 'bot' }), ...p1.deck]
  EffectManager.applyRevealEffect({ type: 'peekDeckBottom', peekTake: true, timing: 'onReveal' }, makeCard({ name: '隐士' }), p1, game)
  assert(p1.hand.some(c => c.name === '底牌'), '牌库底加入手牌')
}

console.log('--- effectBranch ---')
{
  const druid = makeCard({ name: '海洋德鲁伊' })
  const water = makeCard({ name: '水牌', attribute: '水' })
  const p1 = makePlayer('p1', { hand: [water], currentCost: 2 })
  const game = { players: [p1], message: '' }
  const fx = {
    type: 'effectBranch', oncePerRound: true, discardHandAttributes: ['水'], branchDefault: 'A', timing: 'roundStart',
    branches: { A: { type: 'restoreEnergy', value: 2 } },
  }
  EffectManager.applyRoundEffect(fx, druid, p1, game)
  assert(p1.currentCost === 4 && p1.hand.length === 0, '弃水牌分支A恢复2能量')
}

console.log('--- copyFieldUnitIdentity + sacrifice + retrieve ---')
{
  const source = makeCard({ id: 'src', name: '源单位', keywords: ['士兵'], effects: [{ timing: 'onDeploy', type: 'restoreEnergy', value: 1, description: 'x' }] })
  const faceless = makeCard({ id: 'face', name: '无貌者' })
  const p1 = makePlayer('p1', {
    field: [
      { card: source, position: 0, isExtra: false },
      { card: faceless, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game = { players: [p1], message: '' }
  EffectManager.applyRevealEffect({ type: 'copyFieldUnitIdentity', timing: 'onReveal' }, faceless, p1, game)
  assert(faceless.name === '源单位' && faceless.keywords.includes('士兵'), '复制身份')

  const victim = makeCard({ id: 'vic', name: '牺牲品', basePower: 3, currentPower: 3 })
  const ghoul = makeCard({ id: 'gh', name: '食尸鬼', basePower: 0, currentPower: 0 })
  const fromDiscard = makeCard({ id: 'fd', name: '弃牌' })
  const p2 = makePlayer('p2', {
    hand: [],
    discard: [fromDiscard],
    field: [
      { card: ghoul, position: 0, isExtra: false },
      { card: victim, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game2 = { players: [p2], message: '' }
  EffectManager.applyRevealEffect({ type: 'sacrificeFieldForPower', timing: 'onReveal' }, ghoul, p2, game2)
  assert(ghoul.currentPower === 3 && p2.discard.some(c => c.name === '牺牲品'), '牺牲获战力')
  EffectManager.applyRevealEffect({ type: 'retrieveFromDiscard', retrieveRandom: false, timing: 'onReveal' }, ghoul, p2, game2)
  assert(p2.hand.some(c => c.name === '弃牌'), '弃牌区取回')
}

console.log(`\nP1 engine smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

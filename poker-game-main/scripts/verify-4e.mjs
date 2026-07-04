/**
 * 4E 卡牌功能验证（季风 / 篝火 / 垂钓客）
 * 覆盖：真实 card-seed 数据、triggerRoundEffects 集成、出牌费用、边界情况
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const { getCard } = await import(pathToFileURL(resolve(__dirname, '../server/cardData.js')).href)

function cloneCard(c) {
  return JSON.parse(JSON.stringify(c))
}

function initCard(c) {
  const card = cloneCard(c)
  card.currentPower = card.currentPower ?? card.basePower ?? 0
  return card
}

function makeSlots(cards) {
  const field = Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false }))
  cards.forEach((c, i) => { if (i < 6) field[i].card = c })
  return field
}

function makePlayer(id, fieldCards = [], deck = [], hand = [], currentCost = 4) {
  return {
    id, name: id, hand: hand.map(initCard), deck: deck.map(initCard), discard: [],
    field: makeSlots(fieldCards.map(initCard)),
    currentCost, canPlayExtra: false, hasPlayedThisTurn: false, bonusPower: 0,
  }
}

function makeGame(players) {
  return { players, message: '', phase: 'action', currentRound: 1, pendingReveals: {} }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

// ── 1. card-seed 三张卡数据结构 ──────────────────────────────────────────
console.log('\n=== 1. card-seed 数据结构 ===')
{
  const fisher = getCard('card_059')
  const campfire = getCard('card_071')
  const monsoon = getCard('card_120')
  assert(fisher?.name === '垂钓客', 'card_059 名称')
  assert(fisher?.effects?.[0]?.type === 'draw' && fisher.effects[0].d6Min === 4, '垂钓客 draw + d6Min:4')
  assert(campfire?.effects?.[0]?.type === 'modifyPower' && campfire.effects[0].targetOtherOnField, '篝火 modifyPower + targetOtherOnField')
  assert(campfire?.effects?.[0]?.excludeAttributes?.includes('水'), '篝火 excludeAttributes 含水')
  assert(monsoon?.effects?.[0]?.type === 'modifyPlayCost' && monsoon.effects[0].timing === 'onField', '季风 onField modifyPlayCost')
  assert(monsoon?.effects?.[0]?.targetAttributes?.includes('风'), '季风 targetAttributes 含风')
}

// ── 2. 季风 — 真实卡牌 + 出牌费用 ───────────────────────────────────────
console.log('\n=== 2. 季风 modifyPlayCost ===')
{
  const monsoon = getCard('card_120')
  const griffin = getCard('card_009') // 狮鹫 风 cost=5
  const farmer = getCard('card_010') // 农田 土

  const player = makePlayer('p1', [monsoon])
  assert(EffectManager.getEffectivePlayCost(griffin, player) === 4, `狮鹫 5→4 (got ${EffectManager.getEffectivePlayCost(griffin, player)})`)
  assert(EffectManager.getEffectivePlayCost(farmer, player) === farmer.cost, '非风属性费用不变')

  // 两张季风叠加 -2
  const player2 = makePlayer('p2', [cloneCard(monsoon), cloneCard(monsoon)])
  assert(EffectManager.getEffectivePlayCost(griffin, player2) === 3, '双季风 5→3')

  // 费用下限 0
  const cheap = getCard('card_059') // cost=1 水
  cheap.attribute = '风'
  assert(EffectManager.getEffectivePlayCost(cheap, player) === 0, '风 cost=1 减1 后为 0')

  // 无季风时不减费
  const alone = makePlayer('p3', [])
  assert(EffectManager.getEffectivePlayCost(griffin, alone) === 5, '无季风时狮鹫仍 5')
}

// ── 3. 篝火 — 真实效果 + triggerRoundEffects ────────────────────────────
console.log('\n=== 3. 篝火 roundEnd ===')
{
  const campfire = getCard('card_071')
  const warrior = getCard('card_007') // 战士 basePower=2
  const water = getCard('card_059') // 垂钓客 水
  const forest = getCard('card_105') // 森林 environment

  // 3a: 正常：buff 第一个符合条件的其他单位
  {
    const p = makePlayer('p1', [campfire, warrior, water, forest])
    const game = makeGame([p])
    EffectManager.triggerRoundEffects('roundEnd', game)
    assert(p.field[1].card.currentPower === 3, `战士 2→3 (got ${p.field[1].card.currentPower})`)
    assert(p.field[2].card.currentPower === 1, `水单位不变 (got ${p.field[2].card.currentPower})`)
    assert(p.field[3].card.currentPower === 1, `环境牌不变 (got ${p.field[3].card.currentPower})`)
    assert(p.field[0].card.currentPower === 1, `篝火自身不变 (got ${p.field[0].card.currentPower})`)
  }

  // 3b: 仅有水单位时无触发
  {
    const p = makePlayer('p2', [getCard('card_071'), getCard('card_059')])
    const game = makeGame([p])
    const msgBefore = game.message
    EffectManager.triggerRoundEffects('roundEnd', game)
    assert(p.field[1].card.currentPower === 1 && game.message === msgBefore, '仅水单位时不触发')
  }

  // 3c: 仅有篝火时无触发
  {
    const campfire3 = getCard('card_071')
    const p = makePlayer('p3', [campfire3])
    const game = makeGame([p])
    const before = game.message
    EffectManager.triggerRoundEffects('roundEnd', game)
    assert(game.message === before, '无其他单位时不触发')
  }

  // 3d: 跳过 slot1 水单位，buff slot2 非水单位
  {
    const cf = getCard('card_071')
    const w1 = getCard('card_059')
    const w2 = getCard('card_007')
    const p = makePlayer('p4', [cf, w1, w2])
    const game = makeGame([p])
    EffectManager.triggerRoundEffects('roundEnd', game)
    assert(p.field[2].card.currentPower === 3 && p.field[1].card.currentPower === 1, '跳过水单位，buff 战士')
  }
}

// ── 4. 垂钓客 — triggerRoundEffects roundStart ───────────────────────────
console.log('\n=== 4. 垂钓客 roundStart D6 抽牌 ===')
{
  const fisher = getCard('card_059')
  const deckCards = [getCard('card_001'), getCard('card_002')]
  const origRoll = EffectManager.rollD6

  // D6=3 不抽
  EffectManager.rollD6 = () => 3
  {
    const p = makePlayer('p1', [fisher], [...deckCards])
    const game = makeGame([p])
    EffectManager.triggerRoundEffects('roundStart', game)
    assert(p.hand.length === 0 && p.deck.length === 2, 'D6=3 不抽牌')
  }

  // D6=4 抽 1 张
  EffectManager.rollD6 = () => 4
  {
    const p = makePlayer('p2', [cloneCard(fisher)], [getCard('card_001'), getCard('card_002')])
    const game = makeGame([p])
    EffectManager.triggerRoundEffects('roundStart', game)
    assert(p.hand.length === 1 && p.deck.length === 1, 'D6=4 抽 1 张')
    assert(game.message.includes('抽到了'), '有抽牌消息')
  }

  // 牌库空时不崩溃
  EffectManager.rollD6 = () => 6
  {
    const p = makePlayer('p3', [cloneCard(fisher)], [])
    const game = makeGame([p])
    EffectManager.triggerRoundEffects('roundStart', game)
    assert(p.hand.length === 0, '空牌库时不抽牌')
  }

  EffectManager.rollD6 = origRoll
}

// ── 5. 出牌流程模拟（季风减费后扣费正确）────────────────────────────────
console.log('\n=== 5. 出牌扣费模拟 ===')
{
  const monsoon = getCard('card_120')
  const griffin = getCard('card_009')
  const player = makePlayer('p1', [monsoon], [], [griffin], 4)

  const playCost = EffectManager.getEffectivePlayCost(griffin, player)
  assert(playCost === 4, `有效费用 4 (got ${playCost})`)
  assert(player.currentCost >= playCost, '4 能量可出狮鹫（季风在场）')

  player.currentCost -= playCost
  assert(player.currentCost === 0, `扣费后剩余 0 (got ${player.currentCost})`)

  // 无季风时 4 能量不够出狮鹫
  const player2 = makePlayer('p2', [], [], [griffin], 4)
  const cost2 = EffectManager.getEffectivePlayCost(griffin, player2)
  assert(cost2 === 5 && player2.currentCost < cost2, '无季风时 4 能量不够出狮鹫')
}

// ── 6. card-seed 与 cardDatabase 关键字段一致（抽样）────────────────────
console.log('\n=== 6. seed 字段完整性 ===')
{
  for (const id of ['card_059', 'card_071', 'card_120']) {
    const c = getCard(id)
    assert(c.effects?.every(e => e.type !== 'conditional'), `${c.name} 无 conditional 占位`)
    assert(c.effects?.[0]?.description?.length > 0, `${c.name} 有描述`)
  }
}

// ── 7. 单机回合切换逻辑（模拟 useGameNew 修复）──────────────────────────
console.log('\n=== 7. 回合切换 round 触发 ===')
{
  function simulateRoundSwitch(prevIndex, playerCount) {
    const nextIndex = (prevIndex + 1) % playerCount
    return playerCount > 1 && nextIndex <= prevIndex
  }
  assert(simulateRoundSwitch(0, 2) === false, 'P0→P1 不触发 round')
  assert(simulateRoundSwitch(1, 2) === true, 'P1→P0 触发 roundEnd/Start')
  assert(simulateRoundSwitch(1, 3) === false, '三人 P1→P2 不触发')
  assert(simulateRoundSwitch(2, 3) === true, '三人 P2→P0 触发')
}

console.log(`\n${'='.repeat(40)}`)
console.log(`验证结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

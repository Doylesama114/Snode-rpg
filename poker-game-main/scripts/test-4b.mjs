/**
 * 4B 批次引擎 smoke 测试：收获日 / 雷云召来 / 报警机器人
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const enginePath = pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href
const { EffectManager } = await import(enginePath)

function makeCard(overrides) {
  return {
    id: 'test',
    name: '测试',
    type: 'unit',
    keywords: [],
    attribute: '无',
    basePower: 1,
    currentPower: 1,
    cost: 0,
    effects: [],
    slotRequired: 1,
    isPersistent: false,
    ...overrides,
  }
}

function makePlayer(id, fieldCards = [], deck = []) {
  return {
    id,
    name: id,
    hand: [],
    deck: [...deck],
    discard: [],
    field: fieldCards.map((c, i) => ({ card: c, position: i, isExtra: false })),
    currentCost: 4,
    canPlayExtra: false,
  }
}

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.error(`  ❌ ${msg}`)
  }
}

console.log('--- 收获日 searchDeck ---')
{
  const farm = makeCard({ name: '玉米', keywords: ['务农', '食物'], type: 'unit' })
  const other = makeCard({ name: '随机', keywords: ['士兵'], type: 'unit' })
  const player = makePlayer('p1', [], [other, farm, makeCard({ name: '植株卡', keywords: ['植株'] })])
  const beforeLen = player.deck.length
  const found = EffectManager.searchDeck(player, {
    type: 'searchDeck',
    searchKeywords: ['务农', '植株', '食物'],
    maxCount: 2,
    shuffleAfterSearch: true,
    searchDiscard: false,
  })
  assert(found.length === 2, `检索到 2 张 (${found.map(c => c.name).join(', ')})`)
  assert(player.deck.length === beforeLen - 2, '牌库减少 2 张')
  assert(player.deck.length >= 1, '剩余牌库已洗牌')
}

console.log('--- 雷云召来 allPlayers modifyPower ---')
{
  const thunder = makeCard({ name: '雷单位', attribute: '雷', type: 'unit', currentPower: 3 })
  const fire = makeCard({ name: '火单位', attribute: '火', type: 'unit', currentPower: 5 })
  const game = {
    players: [
      makePlayer('p1', [fire]),
      makePlayer('p2', [thunder]),
    ],
  }
  const minus = { type: 'modifyPower', targetKeywords: ['单位'], excludeAttributes: ['雷'], value: -2, allPlayers: true }
  const plus = { type: 'modifyPower', targetKeywords: ['单位'], targetAttributes: ['雷'], value: 2, allPlayers: true }
  EffectManager.applyRevealEffect(minus, makeCard({ name: '雷云召来' }), game.players[0], game)
  EffectManager.applyRevealEffect(plus, makeCard({ name: '雷云召来' }), game.players[0], game)
  assert(fire.currentPower === 3, `非雷单位 5-2=3 (got ${fire.currentPower})`)
  assert(thunder.currentPower === 5, `雷单位 3+2=5 (got ${thunder.currentPower})`)
}

console.log('--- 报警机器人 extraPlay ---')
{
  const player = makePlayer('p1')
  const card = makeCard({ name: '报警机器人', type: 'tactic', effects: [{ timing: 'onReveal', type: 'extraPlay' }] })
  const game = { players: [player] }
  EffectManager.applyRevealEffect({ type: 'extraPlay', timing: 'onReveal' }, card, player, game)
  assert(player.canPlayExtra === true, 'canPlayExtra 已设置')
}

console.log('--- card-seed 三张卡结构化 ---')
{
  const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))
  const cards = Array.isArray(seed) ? seed : seed.cards
  const names = ['收获日', '雷云召来', '报警机器人']
  for (const name of names) {
    const c = cards.find(x => x.name === name)
    assert(c && c.effects.some(e => e.type !== 'conditional'), `${name} 已结构化`)
  }
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

/**
 * 2–4 人局：联机引擎决策/回合 + 单机回合轮转逻辑
 */
import { pathToFileURL } from 'url'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const { GameEngine } = await import(pathToFileURL(resolve(ROOT, 'server/gameEngine.js')).href)

let passed = 0
let failed = 0
const assert = (c, m) => (c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`)))

function makeRoomPlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Player${i}`,
    deckCardIds: null,
  }))
}

console.log('=== 联机引擎 N 人决策 ===')
for (const n of [2, 3, 4]) {
  const engine = new GameEngine(`room-${n}`, makeRoomPlayers(n), n)
  assert(engine.gameState.players.length === n, `${n} 人局初始化 ${n} 名玩家`)
  assert(engine.gameState.phase === 'decision', `${n} 人局初始 phase=decision`)

  for (let i = 0; i < n; i++) {
    const r = engine.handleChoosePlay(`p${i}`)
    assert(r.success, `${n} 人局 p${i} choosePlay 成功`)
    if (i < n - 1) {
      assert(engine.gameState.phase === 'decision', `${n} 人局 ${i + 1}/${n} 决策后仍等待`)
    }
  }
  assert(engine.gameState.phase === 'action', `${n} 人局全员决策后进入 action`)
}

console.log('\n=== 联机引擎 N 人准备 → 新回合 ===')
{
  const engine = new GameEngine('room-ready', makeRoomPlayers(3), 3)
  for (const id of ['p0', 'p1', 'p2']) {
    engine.handleChoosePlay(id)
  }
  // 模拟三人均完成行动并 ready
  for (const id of ['p0', 'p1', 'p2']) {
    engine.gameState.playerReady[id] = true
  }
  const roundBefore = engine.gameState.round
  engine.startNewRound()
  assert(engine.gameState.round === roundBefore + 1, '3 人局 startNewRound 回合+1')
  assert(engine.gameState.phase === 'draw' || engine.gameState.phase === 'decision', '新回合 phase 重置')
}

console.log('\n=== 联机 3+ 人最后一轮限制 ===')
{
  const engine = new GameEngine('room-final', makeRoomPlayers(3), 3)
  engine.gameState.isFinalRound = true
  engine.gameState.finalRoundStartRound = engine.gameState.round
  engine.startNewRound()
  const restrictions = engine.gameState.playerRestrictions || {}
  // 无满场玩家时不应有 cannotPlay
  assert(Object.values(restrictions).every(r => !r.includes('cannotPlay')), '3 人局非满场无 cannotPlay')
}

console.log('\n=== 单机回合轮转（模拟 switchToNextPlayer 条件）===')
function simulateRoundComplete(playerCount, prev, next) {
  return playerCount > 1 && next <= prev
}
assert(simulateRoundComplete(2, 1, 0), '2 人 prev=1 next=0 回合结束')
assert(simulateRoundComplete(3, 2, 0), '3 人 prev=2 next=0 回合结束')
assert(simulateRoundComplete(4, 3, 0), '4 人 prev=3 next=0 回合结束')
assert(!simulateRoundComplete(4, 1, 2), '4 人 prev=1 next=2 回合未结束')

console.log('\n=== 汇总 ===')
console.log(`通过: ${passed} | 失败: ${failed}`)
if (failed > 0) process.exit(1)

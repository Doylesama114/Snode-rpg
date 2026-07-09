/**
 * 迭代3 联机 smoke：检索/酒馆/贝壳速攻引擎
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { GameEngine, EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- handleSelectSearchCard ---')
{
  const engine = new GameEngine('r1', [
    { id: 'p1', name: 'A' },
    { id: 'p2', name: 'B' },
  ])
  const p1 = engine.gameState.players[0]
  const c1 = makeCard({ id: 'a', name: '贝壳A' })
  const c2 = makeCard({ id: 'b', name: '贝壳B' })
  p1.deck = [c1, c2]
  p1.hand = []
  engine.gameState.pendingSearchSelection = {
    playerId: 'p1',
    effect: { type: 'searchDeck', searchName: '贝壳', maxCount: 1 },
    candidates: [
      { card: c1, pile: 'deck' },
      { card: c2, pile: 'deck' },
    ],
    timing: 'roundEnd',
  }
  const r = engine.handleSelectSearchCard('p1', 1)
  assert(r.success, '检索选牌成功')
  assert(p1.hand.length === 1 && p1.hand[0].id === 'b', '选中贝壳B')
  assert(!engine.gameState.pendingSearchSelection, '清除 pending')
}

console.log('--- handlePlayTavernLiquor ---')
{
  const engine = new GameEngine('r2', [
    { id: 'p1', name: 'A' },
    { id: 'p2', name: 'B' },
  ])
  const p1 = engine.gameState.players[0]
  const wine = makeCard({ id: 'w', name: '葡萄酒', type: 'tactic', keywords: ['酒水'], cost: 0 })
  p1.hand = [wine]
  p1.currentCost = 3
  engine.gameState.pendingTavernLiquor = { playerId: 'p1', extraCost: 1, handIndices: [0] }
  const r = engine.handlePlayTavernLiquor('p1', 0)
  assert(r.success, '打出酒水成功')
  assert(p1.hand.length === 0, '手牌移除')
  assert(p1.currentCost === 2, '扣除额外费用')
  assert(engine.gameState.pendingReveals.p1.length === 1, '进入待揭示')
}

console.log('--- handleQuickPlayCard 贝壳空槽 ---')
{
  const engine = new GameEngine('r3', [
    { id: 'p1', name: 'A' },
    { id: 'p2', name: 'B' },
  ])
  const p1 = engine.gameState.players[0]
  const shell = makeCard({ id: 'sh', name: '贝壳', quickPlay: true, basePower: 0, currentPower: 0 })
  p1.hand = [shell]
  const r = engine.handleQuickPlayCard(shell, p1, 0, { slotIndex: 0 })
  assert(r.success, '速攻空槽成功')
  assert(p1.hand.length === 0, '从手牌移除')
  assert(p1.field[0].card?.name === '贝壳', '部署到槽位')
  assert(engine.gameState.pendingReveals.p1.length === 1, '待揭示批次')
}

console.log(`\n迭代3 联机 smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

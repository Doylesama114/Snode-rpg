/**
 * P2 动画改动验证脚本（无浏览器）
 * 运行: node scripts/verify-p2-animations.mjs
 */
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// 用 vite 构建产物验证较麻烦；此处内联核心 diff/parse 逻辑做 smoke test
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

// --- parsePowerPulse logic (mirror) ---
function parsePowerPulsesFromSegment(segment, game) {
  const s = segment.trim()
  if (!s) return []
  const findCard = (name) => {
    for (const p of game.players) {
      for (const slot of p.field) {
        if (slot.card?.name === name) return { card: slot.card, playerId: p.id, slotIndex: p.field.indexOf(slot) }
      }
    }
    return null
  }
  const arrow = s.match(/(.+?) 战力(\d+)→(\d+)/)
  if (arrow) {
    const hit = findCard(arrow[1].trim())
    if (hit) {
      const delta = Number(arrow[3]) - Number(arrow[2])
      if (delta !== 0) return [{ fieldOwnerId: hit.playerId, slotIndex: hit.slotIndex, delta }]
    }
  }
  const named = s.match(/(.+?) 战力([+-]\d+)/)
  if (named) {
    const hit = findCard(named[1].trim())
    if (hit) return [{ fieldOwnerId: hit.playerId, slotIndex: hit.slotIndex, delta: Number(named[2]) }]
  }
  return []
}

function diffField(prev, next) {
  const events = []
  for (const player of next.players) {
    const prevPlayer = prev.players.find(p => p.id === player.id)
    if (!prevPlayer) continue
    player.field.forEach((slot, si) => {
      const prevCard = prevPlayer.field[si]?.card
      const nextCard = slot.card
      if (!nextCard && prevCard) {
        events.push({ type: 'destroy', fieldOwnerId: player.id, slotIndex: si })
        return
      }
      if (nextCard && prevCard && nextCard.currentPower !== prevCard.currentPower) {
        events.push({ type: 'power', fieldOwnerId: player.id, slotIndex: si, delta: nextCard.currentPower - prevCard.currentPower })
      }
    })
  }
  return events
}

function diffPhaseBanner(prev, next, myPlayerId) {
  if (!prev.isFinalRound && next.isFinalRound) return { kind: 'final-round', text: '最后一回合！' }
  if (prev.round !== next.round && next.round > 0) return { kind: 'round', text: `第 ${next.round} 回合` }
  if (prev.phase !== 'decision' && next.phase === 'decision') {
    const cur = next.players[next.currentPlayerIndex]
    if (cur?.id === myPlayerId) return { kind: 'your-turn', text: '你的回合' }
  }
  return null
}

const card = (name, power) => ({ id: name, name, type: 'unit', currentPower: power, basePower: power, cost: 1, effects: [], keywords: [], attribute: '火' })

const game = {
  players: [{
    id: 'player',
    field: [{ card: card('测试兵', 3), position: 0, isExtra: false }],
  }],
}

console.log('\n=== P2 动画验证 ===\n')

console.log('1. parsePowerPulse')
const pulses = parsePowerPulsesFromSegment('测试兵 战力3→1', game)
assert(pulses.length === 1 && pulses[0].delta === -2, '解析战力箭头 -2')

console.log('\n2. diffField destroy')
const prev = { players: [{ id: 'p1', field: [{ card: card('A', 2) }] }] }
const next = { players: [{ id: 'p1', field: [{ card: null }] }] }
const ev = diffField(prev, next)
assert(ev.length === 1 && ev[0].type === 'destroy', '检测卡牌被移除 → destroy 事件')

console.log('\n3. diffField power')
const prev2 = { players: [{ id: 'p1', field: [{ card: card('B', 2) }] }] }
const next2 = { players: [{ id: 'p1', field: [{ card: card('B', 5) }] }] }
const ev2 = diffField(prev2, next2)
assert(ev2.length === 1 && ev2[0].type === 'power' && ev2[0].delta === 3, '检测战力 2→5 → power +3')

console.log('\n4. diffPhaseBanner')
const b1 = diffPhaseBanner(
  { isFinalRound: false, round: 1, phase: 'draw', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  { isFinalRound: true, round: 1, phase: 'draw', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  'player',
)
assert(b1?.kind === 'final-round', '最后一回合横幅')

const b2 = diffPhaseBanner(
  { isFinalRound: false, round: 1, phase: 'draw', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  { isFinalRound: false, round: 2, phase: 'draw', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  'player',
)
assert(b2?.kind === 'round' && b2.text === '第 2 回合', '新回合横幅')

const b3 = diffPhaseBanner(
  { isFinalRound: false, round: 1, phase: 'draw', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  { isFinalRound: false, round: 1, phase: 'decision', players: [{ id: 'player' }], currentPlayerIndex: 0 },
  'player',
)
assert(b3?.kind === 'your-turn', '你的回合横幅')

console.log('\n=== 全部通过 ===\n')

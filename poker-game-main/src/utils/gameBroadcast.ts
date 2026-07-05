import type { BroadcastEntry, GameState } from '@/types/game'

const MAX_BROADCAST = 120

export function pushBroadcastEntries(
  game: GameState,
  texts: string | string[],
  source?: string,
) {
  if (!game.broadcastLog) game.broadcastLog = []
  const items = (Array.isArray(texts) ? texts : [texts])
    .map(t => t.trim())
    .filter(Boolean)
  for (const text of items) {
    const dup = game.broadcastLog.some(e => e.round === game.round && e.text === text)
    if (dup) continue
    game.broadcastLog.unshift({
      id: `${game.round}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: game.round,
      text,
      source,
      timestamp: Date.now(),
    })
  }
  if (game.broadcastLog.length > MAX_BROADCAST) {
    game.broadcastLog.length = MAX_BROADCAST
  }
}

/** 从 message 增量同步到 broadcastLog */
export function syncBroadcastFromMessage(game: GameState, prevMessage = '') {
  const msg = game.message?.trim()
  if (!msg) return
  const prevParts = new Set(
    prevMessage.split('|').map(s => s.trim()).filter(Boolean),
  )
  const newParts = msg.split('|').map(s => s.trim()).filter(Boolean)
  const fresh = newParts.filter(p => !prevParts.has(p))
  if (fresh.length) {
    pushBroadcastEntries(game, fresh)
  } else if (!game.broadcastLog?.length && msg) {
    pushBroadcastEntries(game, newParts)
  }
}

export function clearBroadcastLog(game: GameState) {
  game.broadcastLog = []
}

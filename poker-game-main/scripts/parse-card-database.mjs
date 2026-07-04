/**
 * 从 cardDatabase.ts 解析 allCardDefinitions（合法 JS 字面量，用 eval 安全加载）
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_TS = resolve(__dirname, '../src/data/cardDatabase.ts')

let _cache = null

export function loadCardDefinitions(force = false) {
  if (_cache && !force) return _cache

  const src = readFileSync(DB_TS, 'utf8')
  const startMarker = 'export const allCardDefinitions = '
  const start = src.indexOf(startMarker)
  if (start === -1) throw new Error('找不到 allCardDefinitions')

  const arrayStart = start + startMarker.length
  let depth = 0
  let i = arrayStart
  while (i < src.length && src[i] !== '[') i++
  const begin = i

  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        const arrayCode = src.slice(begin, i + 1)
        // eslint-disable-next-line no-eval
        _cache = eval(arrayCode)
        return _cache
      }
    }
  }
  throw new Error('allCardDefinitions 数组未闭合')
}

/** 导出联机 seed 格式（去掉运行时字段） */
export function toSeedCards(cards) {
  return cards.map(card => {
    const {
      currentPower,
      stackedBonus,
      markedForDiscard,
      deployOnCardTarget,
      ...rest
    } = card
    return rest
  })
}

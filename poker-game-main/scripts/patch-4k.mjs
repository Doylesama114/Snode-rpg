/**
 * 4K 批次：奶牛 / 螃蟹 / 退役老兵
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 奶牛 requireFieldName + shuffleAfterSearch
s = s.replace(
  /(\/\/ 021\. 奶牛[\s\S]*?type: 'searchDeck',\s*)searchName: '牛奶',\s*description:/,
  `$1searchName: '牛奶',
      requireFieldName: '挤奶工',
      shuffleAfterSearch: true,
      description:`
)

// 螃蟹 onReveal draw
s = s.replace(
  /(\/\/ 063\. 螃蟹[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：如果你的场上拥有“沙滩”，那么你抽一张牌'/,
  `$1type: 'draw',
      drawCount: 1,
      requireFieldName: '沙滩',
      description: '揭示：如果你的场上拥有「沙滩」，那么你抽一张牌'`
)

// 退役老兵 onDeploy 条件自增
s = s.replace(
  /(\/\/ 032\. 退役老兵[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你的场上没有其他“士兵”关键词的卡牌，但是拥有其他“居民”关键词的卡牌，这张牌的战力\+3'/,
  `$1type: 'modifyPower',
      selfTarget: true,
      value: 3,
      noOtherFieldKeyword: '士兵',
      requireOtherFieldKeyword: '居民',
      description: '如果你的场上没有其他「士兵」关键词的卡牌，但是拥有其他「居民」关键词的卡牌，这张牌的战力+3'`
)

writeFileSync(path, s)
console.log('patch-4k.mjs done')

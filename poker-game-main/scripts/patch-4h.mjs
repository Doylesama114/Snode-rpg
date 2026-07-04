/**
 * 4H 批次：酒吧女招待 / 杂货铺 / 燃烧之手
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 酒吧女招待：searchNames + shuffle
s = s.replace(
  /(\/\/ 020\. 酒吧女招待[\s\S]*?type: 'searchDeck',\s*)searchKeyword: '酒水',\s*description:/,
  `$1searchKeyword: '酒水',
      searchNames: ['酒馆', '吟游诗人'],
      maxCount: 1,
      shuffleAfterSearch: true,
      description:`
)

// 杂货铺：onDeploy searchEachKeyword
s = s.replace(
  /(\/\/ 101\. 杂货铺[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'conditional',\s*description: '揭示：从你的牌库中分别检索"奇械\/物件\/务农\/"各一张牌加入手牌，随后混洗牌库'/,
  `$1timing: 'onDeploy',
      type: 'searchDeck',
      searchEachKeyword: true,
      searchKeywords: ['奇械', '物件', '务农'],
      maxCount: 1,
      shuffleAfterSearch: true,
      description: '揭示：从你的牌库中分别检索"奇械/物件/务农/"各一张牌加入手牌，随后混洗牌库'`
)

// 燃烧之手：debuffOpponentHand
s = s.replace(
  /(\/\/ 141\. 燃烧之手[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '标记左手边第一名玩家的随机三张手牌，这些卡牌的基础战力-2'/,
  `$1timing: 'onDeploy',
      type: 'debuffOpponentHand',
      value: -2,
      handDebuffCount: 3,
      description: '标记左手边第一名玩家的随机三张手牌，这些卡牌的基础战力-2'`
)

writeFileSync(path, s)
console.log('patch-4h.mjs done')

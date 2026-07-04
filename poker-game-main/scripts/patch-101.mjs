/**
 * 杂货铺 patch（curly quotes）
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 101\. 杂货铺[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'conditional',\s*description: '[^']+'/,
  `$1timing: 'onDeploy',
      type: 'searchDeck',
      searchEachKeyword: true,
      searchKeywords: ['奇械', '物件', '务农'],
      maxCount: 1,
      shuffleAfterSearch: true,
      description: '揭示：从你的牌库中分别检索各一张奇械/物件/务农牌加入手牌，随后混洗牌库'`
)

writeFileSync(path, s)
console.log('patch-101 done')

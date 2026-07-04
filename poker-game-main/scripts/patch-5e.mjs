/**
 * 5E 批次：旗鱼 / 矮人烈酒（P0 盖牌批次就绪）
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

const patches = [
  {
    name: '旗鱼',
    old: /(\/\/ 069\. 旗鱼[\s\S]*?effects: \[\s*)\{\s*timing: 'onDeploy',\s*type: 'conditional',\s*description: '当本回合所有玩家均展示卡牌后，如果这张牌为战力值最高的卡牌（环境牌和战术牌没有战力视为0）那么将其免费置于场上'\s*\}/,
    new: `$1{
      timing: 'onBatchReveal',
      type: 'batchHighestFreeDeploy',
      description: '当本回合所有玩家均展示卡牌后，如果这张牌为战力值最高的卡牌（环境牌和战术牌没有战力视为0）那么将其免费置于场上'
    }`,
  },
  {
    name: '矮人烈酒',
    old: /(\/\/ 135\. 矮人烈酒[\s\S]*?effects: \[\s*)\{\s*timing: 'onReveal',\s*type: 'conditional',\s*description: '揭示：将对方当前展示的卡牌置于对方牌库底，随后令对方随机打出一张手牌'\s*\}/,
    new: `$1{
      timing: 'onReveal',
      type: 'moveOpponentBatchRevealToDeckBottom',
      targetLeftPlayer: true,
      batchResolveOnly: true,
      description: '揭示：将对方当前展示的卡牌置于对方牌库底'
    },
    {
      timing: 'onReveal',
      type: 'forceRandomHandPlay',
      targetLeftPlayer: true,
      batchResolveOnly: true,
      description: '随后令对方随机打出一张手牌'
    }`,
  },
]

let ok = 0
for (const p of patches) {
  if (!p.old.test(s)) {
    console.error(`FAIL: ${p.name} pattern not found`)
    process.exit(1)
  }
  s = s.replace(p.old, p.new)
  ok++
}
writeFileSync(path, s)
console.log(`patch-5e.mjs done (${ok} cards)`)

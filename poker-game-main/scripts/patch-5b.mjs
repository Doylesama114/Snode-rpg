/**
 * 5B 批次：征募官 / 强盗 / 攀爬工具
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 035\. 征募官[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：获取两张[\u201c"]民兵[\u201d"]衍生物卡牌，那两张牌的能量消耗变为0'/,
  `$1type: 'grantCopiesToHand',
      grantCardId: 'card_008',
      grantCount: 2,
      grantCostOverride: 0,
      description: '揭示：获取两张「民兵」衍生物卡牌，那两张牌的能量消耗变为0'`,
)

s = s.replace(
  /(\/\/ 031\. 强盗[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'conditional',\s*description: '揭示：选择一名其他玩家，对方需要将一张手牌交给你；如果场上存在[\u201c"]士兵[\u201d"]关键词的卡牌，这张牌的战力-3'/,
  `$1timing: 'onReveal',
      type: 'stealCard',
      description: '揭示：选择一名其他玩家，对方需要将一张手牌交给你'
    },
    {
      timing: 'onReveal',
      type: 'modifyPower',
      selfTarget: true,
      value: -3,
      requireGlobalFieldKeyword: '士兵',
      description: '如果场上存在「士兵」关键词的卡牌，这张牌的战力-3'`,
)

s = s.replace(
  /(\/\/ 023\. 攀爬工具[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：随机打出你牌库中的一张牌，前提是你能够支付其能量消耗，否则将其置于你的牌库顶部'/,
  `$1type: 'playRandomFromDeckOrTop',
      description: '揭示：随机打出你牌库中的一张牌，前提是你能够支付其能量消耗，否则将其置于你的牌库顶部'`,
)

writeFileSync(path, s)
console.log('patch-5b.mjs done')

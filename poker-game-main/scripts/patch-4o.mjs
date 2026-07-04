/**
 * 4O 批次：猎人 / 游客 / 药剂师
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 025\. 游客[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '游戏结束时你的手牌和场上每拥有一张不同属性的卡牌便使战力\+1'/,
  `$1timing: 'onGameEnd',
      type: 'modifyPowerByUniqueAttributes',
      value: 1,
      includeHand: true,
      description: '游戏结束时你的手牌和场上每拥有一张不同属性的卡牌便使战力+1'`
)

s = s.replace(
  /(\/\/ 051\. 药剂师[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你打出的下一张带有[\u201c\u201d"]药剂[\u201c\u201d"]关键词的战术牌不占用行动'/,
  `$1type: 'grantTacticPlayFree',
      targetKeywords: ['药剂'],
      description: '你打出的下一张带有「药剂」关键词的战术牌不占用行动'`
)

s = s.replace(
  /(\/\/ 052\. 猎人[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你的场上拥有[\u201c\u201d"]自然[\u201c\u201d"]关键词的环境牌，那么将这张牌免费置于场上'/,
  `$1type: 'conditionalPlayCost',
      playCostValue: 0,
      requireFieldKeywords: ['自然'],
      requireFieldCardType: 'environment',
      description: '如果你的场上拥有「自然」关键词的环境牌，那么将这张牌免费置于场上'`
)

writeFileSync(path, s)
console.log('patch-4o.mjs done')

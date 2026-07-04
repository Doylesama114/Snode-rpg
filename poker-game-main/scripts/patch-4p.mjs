/**
 * 4P 批次：武僧 / 溪流 / 帆船
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 034\. 武僧[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '每当你为这张卡牌打出一张战术牌后，这张牌的战力便\+1'/,
  `$1timing: 'onOtherPlay',
      type: 'modifyPower',
      value: 1,
      selfTarget: true,
      triggerPlayedCardType: 'tactic',
      stackable: true,
      description: '每当你打出一张战术牌后，这张牌的战力便+1'`,
)

s = s.replace(
  /(\/\/ 108\. 溪流[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你可以将手牌或牌库中一张带有[\u201c\u201d"]鱼[\u201c\u201d"]名称的单位牌放置进场，照常支付其费用随后混洗牌库'/,
  `$1type: 'searchFromHandOrDeck',
      searchName: '鱼',
      targetCardType: 'unit',
      shuffleAfterSearch: true,
      description: '你可以将手牌或牌库中一张带有「鱼」名称的单位牌放置进场，照常支付其费用随后混洗牌库'`,
)

s = s.replace(
  /(\/\/ 110\. 帆船[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你必须在场上拥有水属性的环境牌时才能打出这张牌，复制一张水属性的环境牌效果'/,
  `$1type: 'playRequirement',
      requireFieldAttributes: ['水'],
      requireFieldCardType: 'environment',
      description: '你必须在场上拥有水属性的环境牌时才能打出这张牌（复制环境效果待后续批次）'`,
)

writeFileSync(path, s)
console.log('patch-4p.mjs done')

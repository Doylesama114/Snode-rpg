/**
 * 4R 批次：搬运工 / 锻炉 / 贫民窟
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 024\. 搬运工[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '在这张牌进场后，你可以立即从手牌中将至多两张拥有[\u201c\u201d"]物件[\u201c\u201d"]关键词的单位牌部署在其他可以部署的卡牌上'/,
  `$1type: 'deployFromHand',
      targetKeywords: ['物件'],
      targetCardType: 'unit',
      maxCount: 2,
      description: '在这张牌进场后，你可以立即从手牌中将至多两张拥有「物件」关键词的单位牌部署在其他可以部署的卡牌上'`,
)

s = s.replace(
  /(\/\/ 112\. 锻炉[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '每当你执行重铸行动时，这张牌的战力\+2'/,
  `$1type: 'modifyPower',
      selfTarget: true,
      value: 2,
      stackable: true,
      description: '每当你执行重铸行动时，这张牌的战力+2'`,
)

s = s.replace(
  /(\/\/ 112\. 锻炉[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'modifyPower'/,
  `$1timing: 'onReforge',
      type: 'modifyPower'`,
)

s = s.replace(
  /(\/\/ 122\. 贫民窟[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果游戏结束时你的战力落后于其他玩家，那些玩家的战力-4'/,
  `$1type: 'debuffAheadPlayers',
      value: -4,
      description: '如果游戏结束时你的战力落后于其他玩家，那些玩家的战力-4'`,
)

s = s.replace(
  /(\/\/ 122\. 贫民窟[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'debuffAheadPlayers'/,
  `$1timing: 'onGameEnd',
      type: 'debuffAheadPlayers'`,
)

writeFileSync(path, s)
console.log('patch-4r.mjs done')

/**
 * 4X 批次：板甲 / 三叉戟 / 攀岩爱好者
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 094\. 板甲[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '这张牌无法直接置于场上，仅能够部署在拥有[\u201c"]士兵\/职业者[\u201d"]关键词的卡牌上'/,
  `$1type: 'deployOnHostOnly',
      requireHostKeywords: ['士兵', '职业者'],
      description: '这张牌无法直接置于场上，仅能够部署在拥有「士兵/职业者」关键词的卡牌上'`,
)

s = s.replace(
  /(\/\/ 093\. 三叉戟[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '这张牌无法直接置于场上，仅能够部署在其他单位牌上，如果那张单位牌为水属性则战力\+2'/,
  `$1type: 'deployOnHostOnly',
      requireHostCardType: 'unit',
      hostBonusIfHostAttribute: '水',
      hostBonusValue: 2,
      description: '这张牌无法直接置于场上，仅能够部署在其他单位牌上，如果那张单位牌为水属性则战力+2'`,
)

s = s.replace(
  /(\/\/ 076\. 攀岩爱好者[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你可以将这张牌部署在一张土属性的环境牌上，随后这张牌的战力\+3'/,
  `$1type: 'deployOnHostOnly',
      allowNormalDeploy: true,
      requireHostCardType: 'environment',
      requireHostAttributes: ['土'],
      hostDeploySelfBonus: 3,
      description: '你可以将这张牌部署在一张土属性的环境牌上，随后这张牌的战力+3'`,
)

writeFileSync(path, s)
console.log('patch-4x.mjs done')

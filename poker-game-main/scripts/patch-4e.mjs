/**
 * 4E 批次：更新 cardDatabase.ts 三张卡（季风/篝火/垂钓客）
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 垂钓客：D6>=4 才抽牌
s = s.replace(
  /(\/\/ 059\. 垂钓客[\s\S]*?effects: \[\s*\{\s*timing: 'roundStart',\s*type: 'draw',\s*drawCount: 1,)\s*description:/,
  "$1\n      d6Min: 4,\n      description:"
)

// 篝火：roundEnd 为其他非水单位 +1
s = s.replace(
  /(\/\/ 071\. 篝火[\s\S]*?effects: \[\s*\{\s*)timing: 'roundEnd',\s*type: 'conditional',\s*description: '每个回合结束时，为一张非水属性的其他单位牌增加1点战力'/,
  "$1timing: 'roundEnd',\n      type: 'modifyPower',\n      value: 1,\n      targetOtherOnField: true,\n      excludeSelf: true,\n      targetCardType: 'unit',\n      excludeAttributes: ['水'],\n      description: '每个回合结束时，为一张非水属性的其他单位牌增加1点战力'"
)

// 季风：onField 风属性出牌 -1
s = s.replace(
  /(\/\/ 120\. 季风[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '你的风属性卡牌需要花费的能量值-1'/,
  "$1timing: 'onField',\n      type: 'modifyPlayCost',\n      value: -1,\n      targetAttributes: ['风'],\n      description: '你的风属性卡牌需要花费的能量值-1'"
)

writeFileSync(path, s)
console.log('patch-4e.mjs done')

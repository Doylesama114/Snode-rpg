/**
 * 5A 批次：雪怪 / 寒铁虎 / 间歇泉
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 088\. 雪怪[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你的场上拥有冰属性的环境牌，那么这张牌的费用-1'/,
  `$1type: 'conditionalPlayCost',
      playCostValue: 4,
      requireFieldAttributes: ['冰'],
      requireFieldCardType: 'environment',
      description: '如果你的场上拥有冰属性的环境牌，那么这张牌的费用-1'`,
)

s = s.replace(
  /(\/\/ 089\. 寒铁虎[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：如果你的场上拥有冰属性的环境牌，摧毁左手边第一名玩家场上一张基础战力低于3的单位牌'/,
  `$1type: 'destroy',
      requireFieldAttributes: ['冰'],
      requireFieldCardType: 'environment',
      targetLeftPlayer: true,
      targetCardType: 'unit',
      maxBasePower: 2,
      directDestroy: true,
      description: '揭示：如果你的场上拥有冰属性的环境牌，摧毁左手边第一名玩家场上一张基础战力低于3的单位牌'`,
)

s = s.replace(
  /(\/\/ 137\. 间歇泉[\s\S]*?timing: 'roundStart',\s*)type: 'conditional',\s*description: '在下一个回合开始和最后一个回合开始时，分别为你回复3点能量值'/,
  `$1type: 'scheduleRoundStartEnergy',
      value: 3,
      onNextRoundStart: true,
      onFinalRoundStart: true,
      description: '在下一个回合开始和最后一个回合开始时，分别为你回复3点能量值'`,
)

// 间歇泉是战术牌，时机改为 onReveal
s = s.replace(
  /(\/\/ 137\. 间歇泉[\s\S]*?effects: \[\s*\{\s*)timing: 'roundStart',\s*type: 'scheduleRoundStartEnergy'/,
  `$1timing: 'onReveal',
      type: 'scheduleRoundStartEnergy'`,
)

writeFileSync(path, s)
console.log('patch-5a.mjs done')

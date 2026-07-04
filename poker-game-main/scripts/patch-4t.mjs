/**
 * 4T 批次：食人魔 / 纪念照 / 金矿
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 037\. 食人魔[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '游戏结束时随机消灭你的一张其他卡牌'/,
  `$1timing: 'onGameEnd',
      type: 'destroyRandomOther',
      description: '游戏结束时随机消灭你的一张其他卡牌'`,
)

s = s.replace(
  /(\/\/ 038\. 纪念照[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '这张牌无法被打出，如果你的场上拥有环境牌以及[\u201c"]摄像机[\u201d"]和[\u201c"]游客[\u201d"]名称的卡牌，那么在游戏结束时这张牌拥有4点战力'/,
  `$1timing: 'onDeploy',
      type: 'playRequirement',
      unplayable: true,
      description: '这张牌无法被打出'
    },
    {
      timing: 'onGameEnd',
      type: 'setPowerIfFieldNames',
      requireFieldNames: ['摄像机', '游客'],
      value: 4,
      description: '如果你的场上拥有环境牌以及「摄像机」和「游客」名称的卡牌，那么在游戏结束时这张牌拥有4点战力'`,
)

s = s.replace(
  /(\/\/ 039\. 金矿[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '这张牌无法被打出，如果游戏结束时这是你唯一的手牌，这张牌的战力变为7点！'/,
  `$1timing: 'onDeploy',
      type: 'playRequirement',
      unplayable: true,
      description: '这张牌无法被打出'
    },
    {
      timing: 'onGameEnd',
      type: 'setPowerIfOnlyHandCard',
      value: 7,
      description: '如果游戏结束时这是你唯一的手牌，这张牌的战力变为7点'`,
)

writeFileSync(path, s)
console.log('patch-4t.mjs done')

/**
 * 4I 批次：葡萄酒商人 / 魔法飞弹 / 暴徒
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 葡萄酒商人 searchDeck
s = s.replace(
  /(\/\/ 027\. 葡萄酒商人[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'conditional',\s*description: '[^']+'/,
  `$1timing: 'onDeploy',
      type: 'searchDeck',
      searchName: '葡萄酒',
      maxCount: 1,
      shuffleAfterSearch: true,
      description: '揭示：从你的牌库中检索一张拥有"葡萄酒"名称的卡牌加入手牌，随后混洗牌库'`
)

// 魔法飞弹 targetLeftPlayer
s = s.replace(
  /(\/\/ 014\. 魔法飞弹[\s\S]*?type: 'modifyCost',\s*description: '揭示后使你左手边第一名玩家当前能量值-2',\s*)value: -2,\s*stackable: false/,
  `$1value: -2,
      targetLeftPlayer: true,
      stackable: false`
)

// 暴徒 noHigherPowerUnitOnField
s = s.replace(
  /(\/\/ 029\. 暴徒[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '如果你的场上没有基础战力高于这张牌的单位牌，那么这张牌的战力\+2'/,
  `$1timing: 'onDeploy',
      type: 'modifyPower',
      value: 2,
      selfTarget: true,
      noHigherPowerUnitOnField: true,
      description: '如果你的场上没有基础战力高于这张牌的单位牌，那么这张牌的战力+2'`
)

writeFileSync(path, s)
console.log('patch-4i.mjs done')

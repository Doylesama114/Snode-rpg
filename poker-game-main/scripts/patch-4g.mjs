/**
 * 4G 批次：贝壳 / 晴天 / 沙滩
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 贝壳 d6TierPower
s = s.replace(
  /(\/\/ 056\. 贝壳[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'conditional',\s*description: '速攻&揭示：打开这个贝壳并掷一颗D6骰\.D1-2这个贝壳中什么也没有\.D3-4\.有一份蚌肉，你的战力\+1\.D5-6\.有一颗珍珠！你的战力\+5'/,
  `$1timing: 'onReveal',
      type: 'd6TierPower',
      d6Tiers: [
        { min: 1, max: 2, value: 0 },
        { min: 3, max: 4, value: 1 },
        { min: 5, max: 6, value: 5 },
      ],
      description: '速攻&揭示：打开这个贝壳并掷一颗D6骰.D1-2这个贝壳中什么也没有.D3-4.有一份蚌肉，你的战力+1.D5-6.有一颗珍珠！你的战力+5'`
)

// 晴天 onGameEnd
s = s.replace(
  /(\/\/ 121\. 晴天[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '如果游戏结束时，你的场上没有其他"气候"关键词的卡牌，那么这张牌的战力为5'/,
  `$1timing: 'onGameEnd',
      type: 'setPowerIfNoFieldKeyword',
      targetKeywords: ['气候'],
      value: 5,
      description: '如果游戏结束时，你的场上没有其他"气候"关键词的卡牌，那么这张牌的战力为5'`
)

// 沙滩 onField requireKeywords
s = s.replace(
  /(\/\/ 115\. 沙滩[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '如果你拥有"晴天"、"大海"和"游客"，这张牌的战力\+15'/,
  `$1timing: 'onField',
      type: 'modifyPower',
      value: 15,
      selfTarget: true,
      requireKeywords: [['晴天'], ['大海'], ['游客']],
      stackable: false,
      description: '如果你拥有"晴天"、"大海"和"游客"，这张牌的战力+15'`
)

writeFileSync(path, s)
console.log('patch-4g.mjs done')

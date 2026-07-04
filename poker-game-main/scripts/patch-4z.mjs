/**
 * 4Z 批次：牛头人勇士 / 火蜥蜴 / 雪狼
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 080\. 牛头人勇士[\s\S]*?effects: \[\s*\{\s*)timing: 'roundStart',\s*type: 'conditional',\s*description: '揭示：其他玩家在下一个回合开始时不会抽牌'/,
  `$1timing: 'onDeploy',
      type: 'skipOthersDrawNextRound',
      description: '揭示：其他玩家在下一个回合开始时不会抽牌'`,
)

s = s.replace(
  /(\/\/ 072\. 火蜥蜴[\s\S]*?timing: 'roundStart',\s*)type: 'conditional',\s*description: '每回合开始限一次：弃置一张火属性的手牌使你左手边第一名玩家的最终战力-2'/,
  `$1type: 'discardHandForLeftPlayerDebuff',
      discardHandAttributes: ['火'],
      debuffBonusPower: -2,
      oncePerRound: true,
      description: '每回合开始限一次：弃置一张火属性的手牌使你左手边第一名玩家的最终战力-2'`,
)

s = s.replace(
  /(\/\/ 087\. 雪狼[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：从你的牌库中检索一张冰属性卡牌加入手牌，随后混洗牌库'/,
  `$1type: 'searchDeck',
      searchAttribute: '冰',
      maxCount: 1,
      shuffleAfterSearch: true,
      searchDiscard: false,
      description: '揭示：从你的牌库中检索一张冰属性卡牌加入手牌，随后混洗牌库'`,
)

writeFileSync(path, s)
console.log('patch-4z.mjs done')

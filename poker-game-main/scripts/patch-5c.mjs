/**
 * 5C 批次：急先锋·罗森弗斯 / 巨鹏 / 走私船
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 086\. 急先锋·罗森弗斯[\s\S]*?timing: 'roundStart',\s*)type: 'conditional',\s*description: '在首个回合开始时，如果这张牌位于你的手牌、牌库或弃牌堆，将会消耗对应能量并立即进场'/,
  `$1type: 'autoEnterFromZone',
      firstRoundOnly: true,
      description: '在首个回合开始时，如果这张牌位于你的手牌、牌库或弃牌堆，将会消耗对应能量并立即进场'`,
)

s = s.replace(
  /(\/\/ 084\. 巨鹏[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '将左手边第一名玩家场上一张战力小于2的单位牌背面朝上置于这张牌下方，视作这张牌战力\+1'/,
  `$1type: 'absorbLeftPlayerUnit',
      targetCardType: 'unit',
      maxBasePower: 1,
      value: 1,
      description: '将左手边第一名玩家场上一张战力小于2的单位牌背面朝上置于这张牌下方，视作这张牌战力+1'`,
)

s = s.replace(
  /(\/\/ 055\. 走私船[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：你可以选择至多三张手牌背面朝下置于这张牌下方，这张牌下方每拥有一张卡牌战力便\+5'/,
  `$1type: 'stashHandUnderSelf',
      stashMaxCount: 3,
      powerPerStashedCard: 5,
      description: '揭示：你可以选择至多三张手牌背面朝下置于这张牌下方，这张牌下方每拥有一张卡牌战力便+5'`,
)

writeFileSync(path, s)
console.log('patch-5c.mjs done')

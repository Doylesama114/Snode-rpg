/**
 * 4Q 批次：蛮斗士 / 蛇颈龙 / 仲夏节庆典
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 036\. 蛮斗士[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你的牌库里不能拥有战术牌'/,
  `$1type: 'playRequirement',
      requireNoTacticsInDeck: true,
      description: '你的牌库里不能拥有战术牌'`,
)

s = s.replace(
  /(\/\/ 070\. 蛇颈龙[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你拥有水属性的环境牌，这张牌便无法被其他玩家选中'/,
  `$1type: 'grantUntargetable',
      requireFieldAttributes: ['水'],
      requireFieldCardType: 'environment',
      description: '如果你拥有水属性的环境牌，这张牌便无法被其他玩家选中'`,
)

// 蛇颈龙改为 onField 持续效果
s = s.replace(
  /(\/\/ 070\. 蛇颈龙[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'grantUntargetable'/,
  `$1timing: 'onField',
      type: 'grantUntargetable'`,
)

s = s.replace(
  /(\/\/ 107\. 仲夏节庆典[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你拥有[\u201c\u201d"]吟游诗人[\u201c\u201d"]、[\u201c\u201d"]鲁特琴[\u201c\u201d"]、[\u201c\u201d"]篝火[\u201c\u201d"]和[\u201c\u201d"]晴天[\u201c\u201d"]，这张牌的战力\+22'/,
  `$1type: 'modifyPower',
      selfTarget: true,
      value: 22,
      requireKeywords: [['吟游诗人'], ['鲁特琴'], ['篝火'], ['晴天']],
      stackable: false,
      description: '如果你拥有「吟游诗人」、「鲁特琴」、「篝火」和「晴天」，这张牌的战力+22'`,
)

writeFileSync(path, s)
console.log('patch-4q.mjs done')

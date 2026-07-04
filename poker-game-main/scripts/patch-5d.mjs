/**
 * 5D 批次：剩余 14 张 P1 就绪卡（不含旗鱼/矮人烈酒）
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

const patches = [
  {
    id: '018',
    name: '箭袋',
    old: /(\/\/ 018\. 箭袋[\s\S]*?effects: \[\s*)\{\s*timing: 'roundStart',\s*type: 'conditional',\s*description: '这张牌拥有3点充能，每个回合开始时可以消耗1点充能选择一名角色的一张单位牌，使其战力-1'\s*\}/,
    new: `$1{
      timing: 'onDeploy',
      type: 'initCharges',
      initialCharges: 3,
      description: '这张牌拥有3点充能'
    },
    {
      timing: 'roundStart',
      type: 'chargeDebuffUnit',
      value: -1,
      oncePerRound: true,
      description: '每个回合开始时可以消耗1点充能选择一名角色的一张单位牌，使其战力-1'
    }`,
  },
  {
    id: '048',
    name: '隐士',
    old: /(\/\/ 048\. 隐士[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：你可以查看自身牌库底部的卡牌，随后选择是否将其加入手牌'/,
    new: `$1type: 'peekDeckBottom',
      peekTake: true,
      description: '揭示：你可以查看自身牌库底部的卡牌，随后选择是否将其加入手牌'`,
  },
  {
    id: '065',
    name: '潮汐歌者',
    old: /(\/\/ 065\. 潮汐歌者[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：你可以声明所有相邻位置的玩家在下一个回合必须打出何种类型的卡牌（单位\/环境\/战术），如果对方不能打出这种卡牌将会直接跳过回合'/,
    new: `$1type: 'restrictAdjacentPlayType',
      requiredPlayType: 'unit',
      description: '揭示：相邻玩家下回合须打出单位牌，否则跳过回合'`,
  },
  {
    id: '068',
    name: '海洋德鲁伊',
    old: /(\/\/ 068\. 海洋德鲁伊[\s\S]*?timing: 'roundStart',\s*)type: 'conditional',\s*description: '每回合开始限一次：弃置一张水属性的手牌选择以下一项A\.回复2点能量\/B\.使一张单位牌的战力\+2\/C\.抽两张牌'/,
    new: `$1type: 'effectBranch',
      oncePerRound: true,
      discardHandAttributes: ['水'],
      branchDefault: 'A',
      branches: {
        A: { type: 'restoreEnergy', value: 2 },
        B: { type: 'modifyPower', value: 2, targetOtherOnField: true, targetCardType: 'unit' },
        C: { type: 'draw', drawCount: 2 },
      },
      description: '每回合开始限一次：弃置一张水属性的手牌选择以下一项A.回复2点能量/B.使一张单位牌的战力+2/C.抽两张牌'`,
  },
  {
    id: '081',
    name: '枭熊',
    old: /(\/\/ 081\. 枭熊[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '暂无效果描述'/,
    new: `$1type: 'noOp',
      description: '暂无效果描述'`,
  },
  {
    id: '082',
    name: '雷龙',
    old: /(\/\/ 082\. 雷龙[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '就是大'/,
    new: `$1type: 'noOp',
      description: '就是大'`,
  },
  {
    id: '085',
    name: '双足飞龙',
    old: /(\/\/ 085\. 双足飞龙[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '暂无效果描述'/,
    new: `$1type: 'noOp',
      description: '暂无效果描述'`,
  },
  {
    id: '096',
    name: '食尸鬼教徒',
    old: /(\/\/ 096\. 食尸鬼教徒[\s\S]*?effects: \[\s*)\{\s*timing: 'onReveal',\s*type: 'conditional',\s*description: '揭示：消灭你的场上的一张卡牌，并将战力附加在这张牌上，随后从你的弃牌区中挑选一张卡牌加入手牌'\s*\}/,
    new: `$1{
      timing: 'onReveal',
      type: 'sacrificeFieldForPower',
      description: '揭示：消灭你的场上的一张卡牌，并将战力附加在这张牌上'
    },
    {
      timing: 'onReveal',
      type: 'retrieveFromDiscard',
      retrieveRandom: false,
      description: '随后从你的弃牌区中挑选一张卡牌加入手牌'
    }`,
  },
  {
    id: '097',
    name: '无貌者',
    old: /(\/\/ 097\. 无貌者[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：复制并替换你场上一张单位牌的名称、关键词和效果'/,
    new: `$1type: 'copyFieldUnitIdentity',
      description: '揭示：复制并替换你场上一张单位牌的名称、关键词和效果'`,
  },
  {
    id: '098',
    name: '刺客',
    old: /(\/\/ 098\. 刺客[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：摧毁一名玩家场上一张战力低于4的单位牌'/,
    new: `$1type: 'destroy',
      targetCardType: 'unit',
      maxBasePower: 3,
      directDestroy: true,
      description: '揭示：摧毁一名玩家场上一张战力低于4的单位牌'`,
  },
  {
    id: '106',
    name: '棕榈树',
    old: /(\/\/ 106\. 棕榈树[\s\S]*?effects: \[\s*)\{\s*timing: 'onReveal',\s*type: 'conditional',\s*description: '揭示：从你的牌库中检索一张木属性卡牌加入手牌，随后混洗牌库\/你每拥有一张光属性和木属性卡牌这张牌的战力便\+1'\s*\}/,
    new: `$1{
      timing: 'onReveal',
      type: 'searchDeck',
      targetAttributes: ['木'],
      maxCount: 1,
      shuffleAfterSearch: true,
      description: '揭示：从你的牌库中检索一张木属性卡牌加入手牌，随后混洗牌库'
    },
    {
      timing: 'onReveal',
      type: 'modifyPower',
      selfTarget: true,
      value: 1,
      countMatchingFieldCards: true,
      targetAttributes: ['光', '木'],
      includeHand: true,
      description: '你每拥有一张光属性和木属性卡牌这张牌的战力便+1'
    }`,
  },
  {
    id: '123',
    name: '星象塔',
    old: /(\/\/ 123\. 星象塔[\s\S]*?timing: 'roundStart',\s*)type: 'conditional',\s*description: '每个回合开始抽牌时你可以选择抽取牌库顶的三张牌，选择其中一张加入手牌，剩余卡牌按照任意顺序放置在牌库顶或牌库底部'/,
    new: `$1type: 'scryDeckTop',
      scryCount: 3,
      scryTake: 1,
      scryRestToBottom: true,
      description: '每个回合开始抽取牌库顶三张，选一张加入手牌，其余置于牌库底'`,
  },
  {
    id: '131',
    name: '回春术',
    old: /(\/\/ 131\. 回春术[\s\S]*?effects: \[\s*)\{\s*timing: 'roundEnd',\s*type: 'conditional',\s*description: '选择一张单位牌，使其在接下来的三个回合结束时每次战力\+1'\s*\}/,
    new: `$1{
      timing: 'onReveal',
      type: 'scheduleRoundEndBuff',
      roundEndBuffRounds: 3,
      roundEndBuffPower: 1,
      description: '选择一张单位牌，使其在接下来的三个回合结束时每次战力+1'
    }`,
  },
  {
    id: '142',
    name: '冰锥术',
    old: /(\/\/ 142\. 冰锥术[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '弃置一张冰属性的手牌封锁每名其他玩家的随机一张手牌，那张牌仅能够在最后一个回合打出'/,
    new: `$1type: 'lockRandomHandCards',
      discardHandAttributes: ['冰'],
      lockHandCount: 1,
      lockHandFinalRoundOnly: true,
      description: '弃置一张冰属性的手牌封锁每名其他玩家的随机一张手牌，那张牌仅能够在最后一个回合打出'`,
  },
]

let ok = 0
for (const p of patches) {
  if (!p.old.test(s)) {
    console.error(`FAIL: ${p.name} (${p.id}) pattern not found`)
    process.exit(1)
  }
  s = s.replace(p.old, p.new)
  ok++
}
writeFileSync(path, s)
console.log(`patch-5d.mjs done (${ok} cards)`)

/**
 * 4U 批次：红宝石 / 蓝宝石 / 绿宝石
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 040\. 红宝石[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '这张牌无法被打出，如果游戏结束时你的场上拥有[\u201c"]贵族[\u201d"]关键词的卡牌，这张牌的战力变为3点'/,
  `$1timing: 'onDeploy',
      type: 'playRequirement',
      unplayable: true,
      description: '这张牌无法被打出'
    },
    {
      timing: 'onGameEnd',
      type: 'setPowerIfFieldKeyword',
      requireFieldKeywords: ['贵族'],
      value: 3,
      description: '如果游戏结束时你的场上拥有「贵族」关键词的卡牌，这张牌的战力变为3点'`,
)

s = s.replace(
  /(\/\/ 041\. 蓝宝石[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '这张牌无法被打出，如果游戏结束时你手牌中拥有[\u201c"]红宝石[\u201d"]，这张牌的战力变为2点'/,
  `$1timing: 'onDeploy',
      type: 'playRequirement',
      unplayable: true,
      description: '这张牌无法被打出'
    },
    {
      timing: 'onGameEnd',
      type: 'setPowerIfHandNames',
      requireHandNames: ['红宝石'],
      value: 2,
      description: '如果游戏结束时你手牌中拥有「红宝石」，这张牌的战力变为2点'`,
)

s = s.replace(
  /(\/\/ 042\. 绿宝石[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '这张牌无法被打出，如果游戏结束时你手牌中拥有[\u201c"]红宝石[\u201d"]和[\u201c"]蓝宝石[\u201d"]，这张牌的战力变为4点'/,
  `$1timing: 'onDeploy',
      type: 'playRequirement',
      unplayable: true,
      description: '这张牌无法被打出'
    },
    {
      timing: 'onGameEnd',
      type: 'setPowerIfHandNames',
      requireHandNames: ['红宝石', '蓝宝石'],
      value: 4,
      description: '如果游戏结束时你手牌中拥有「红宝石」和「蓝宝石」，这张牌的战力变为4点'`,
)

writeFileSync(path, s)
console.log('patch-4u.mjs done')

/**
 * 4F 批次：吟游诗人 / 风笛 / 激励乐章
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 风笛 onGameEnd doubleTargetPower
s = s.replace(
  /(\/\/ 019\. 风笛[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '游戏结束时，你的"吟游诗人"战力翻倍'/,
  "$1timing: 'onGameEnd',\n      type: 'doubleTargetPower',\n      targetName: '吟游诗人',\n      description: '游戏结束时，你的\"吟游诗人\"战力翻倍'"
)

// 吟游诗人 onGameEnd d6ModifyPower
s = s.replace(
  /(\/\/ 090\. 吟游诗人[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '游戏结束时掷一颗D6骰，为这张牌增加等同于掷骰点数的战力'/,
  "$1timing: 'onGameEnd',\n      type: 'd6ModifyPower',\n      description: '游戏结束时掷一颗D6骰，为这张牌增加等同于掷骰点数的战力'"
)

// 激励乐章 useD6Value
s = s.replace(
  /(\/\/ 146\. 激励乐章[\s\S]*?type: 'modifyPower',\s*targetKeywords: \['单位'\],\s*)value: 3,\s*description: '选择一张单位牌并掷一颗D6骰，为其增加对应点数的战力\(D6随机化将在后续实现，暂用平均值3\)'/,
  "$1useD6Value: true,\n      description: '选择一张单位牌并掷一颗D6骰，为其增加对应点数的战力'"
)

writeFileSync(path, s)
console.log('patch-4f.mjs done')

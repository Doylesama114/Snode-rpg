/**
 * 4J 批次：海鸥 / 精准射击 / 气泡酒
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 海鸥 targetLeftPlayer
s = s.replace(
  /(\/\/ 083\. 海鸥[\s\S]*?type: 'stealCard',\s*)value: 1,\s*description:/,
  `$1value: 1,
      targetLeftPlayer: true,
      description:`
)

// 精准射击 value -2
s = s.replace(
  /(\/\/ 127\. 精准射击[\s\S]*?type: 'destroy',\s*)description:/,
  `$1value: -2,
      description:`
)

// 气泡酒 grantUnitPlayBonus
s = s.replace(
  /(\/\/ 138\. 气泡酒[\s\S]*?effects: \[\s*\{\s*)timing: 'onReveal',\s*type: 'modifyPower',\s*value: 1,\s*targetKeywords: \['单位'\],\s*description: '你在这张牌之后打出的每张单位牌战力均\+1'/,
  `$1timing: 'onReveal',
      type: 'grantUnitPlayBonus',
      value: 1,
      description: '你在这张牌之后打出的每张单位牌战力均+1'`
)

writeFileSync(path, s)
console.log('patch-4j.mjs done')

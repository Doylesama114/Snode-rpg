/**
 * 4N 批次：奴隶 / 蔓生怪 / 珊瑚元素
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 028\. 奴隶[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '这张牌不计入终局数量'/,
  `$1type: 'excludeFromFieldCount',
      description: '这张牌不计入终局数量'`
)

s = s.replace(
  /(\/\/ 054\. 蔓生怪[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你的场上拥有木属性的环境牌，这张牌的能量消耗变为1'/,
  `$1type: 'conditionalPlayCost',
      playCostValue: 1,
      requireFieldAttributes: ['木'],
      requireFieldCardType: 'environment',
      description: '如果你的场上拥有木属性的环境牌，这张牌的能量消耗变为1'`
)

s = s.replace(
  /(\/\/ 067\. 珊瑚元素[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '如果你的场上拥有水属性和光属性的环境牌，这张牌的战力\+3'/,
  `$1type: 'modifyPower',
      selfTarget: true,
      value: 3,
      requireAllFieldAttributes: ['水', '光'],
      requireFieldCardType: 'environment',
      description: '如果你的场上拥有水属性和光属性的环境牌，这张牌的战力+3'`
)

writeFileSync(path, s)
console.log('patch-4n.mjs done')

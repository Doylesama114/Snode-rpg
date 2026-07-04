/**
 * 4W 批次：洋葱 / 渔网 / 短柄斧
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

const cropHost = `type: 'deployOnHostOnly',
      requireHostKeywords: ['农田', '载具'],
      description: '速攻：这张牌无法直接置于场上，仅能够部署在带有「农田/载具」关键词的卡牌上'`

s = s.replace(
  /(\/\/ 075\. 洋葱[\s\S]*?timing: 'onPlay',\s*)type: 'conditional',\s*description: '速攻：这张牌无法直接置于场上，仅能够部署在带有"农田\/载具"关键词的卡牌上'/,
  `$1${cropHost}`,
)

s = s.replace(
  /(\/\/ 017\. 渔网[\s\S]*?timing: 'onPlay',\s*)type: 'conditional',\s*description: '速攻：将其置于一张单位牌上'/,
  `$1type: 'deployOnHostOnly',
      requireHostCardType: 'unit',
      description: '速攻：将其置于一张单位牌上'`,
)

s = s.replace(
  /(\/\/ 092\. 短柄斧[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '这张牌无法直接置于场上，仅能够部署在带有[\u201c"]士兵\/蛮斗士\/战士\/冒险者[\u201d"]名称的单位牌上'/,
  `$1type: 'deployOnHostOnly',
      requireHostCardType: 'unit',
      requireHostKeywords: ['士兵', '蛮斗士', '战士', '冒险者'],
      description: '这张牌无法直接置于场上，仅能够部署在带有「士兵/蛮斗士/战士/冒险者」名称的单位牌上'`,
)

writeFileSync(path, s)
console.log('patch-4w.mjs done')

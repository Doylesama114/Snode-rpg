/**
 * 4V 批次：玉米 / 胡萝卜 / 卷心菜
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

const hostEffect = `type: 'deployOnHostOnly',
      requireHostKeywords: ['农田', '载具'],
      description: '速攻：这张牌无法直接置于场上，仅能够部署在带有「农田/载具」关键词的卡牌上'`

for (const name of ['044. 玉米', '045. 胡萝卜', '046. 卷心菜']) {
  s = s.replace(
    new RegExp(`(\\/\\/ ${name}[\\s\\S]*?timing: 'onPlay',\\s*)type: 'conditional',\\s*description: '速攻：这张牌无法直接置于场上，仅能够部署在带有"农田/载具"关键词的卡牌上'`),
    `$1${hostEffect}`,
  )
}

writeFileSync(path, s)
console.log('patch-4v.mjs done')

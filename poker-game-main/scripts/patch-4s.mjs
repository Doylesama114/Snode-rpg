/**
 * 4S 批次：礁石 / 兽栏 / 荒野
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 117\. 礁石[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '将这张牌置于一名场上拥有水属性环境牌的玩家场上'/,
  `$1type: 'crossPlayerDeploy',
      requireFieldAttributes: ['水'],
      requireFieldCardType: 'environment',
      description: '将这张牌置于一名场上拥有水属性环境牌的玩家场上'`,
)

s = s.replace(
  /(\/\/ 114\. 兽栏[\s\S]*?searchKeyword: '载具',\s*description: '进场后从你的牌库或弃牌区检索一张"载具"加入手牌，随后混洗牌库；你可以将"载具"单位牌部署在这张牌上'\s*\},)/,
  `$1
    {
      timing: 'onDeploy',
      type: 'createSlot',
      slotDeployKeywords: ['载具'],
      description: '你可以将「载具」单位牌部署在这张牌上'
    },`,
)

writeFileSync(path, s)
console.log('patch-4s.mjs done')

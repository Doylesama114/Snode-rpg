/**
 * 4Y 批次：温馨的旅馆 / 哥布林杂兵 / 狂战士
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

s = s.replace(
  /(\/\/ 102\. 温馨的旅馆[\s\S]*?effects: \[\s*\{\s*)timing: 'roundEnd',\s*type: 'conditional',\s*description: '你可以将拥有[\u201c"]职业者[\u201d"]关键词或[\u201c"]冒险者[\u201d"]名词的单位牌部署在这张牌上，这些卡牌不再计算终局数量，如果这张牌上有部署卡牌，那么在每个回合结束时为你回复1点能量并使这张牌的战力\+1'/,
  `$1timing: 'onDeploy',
      type: 'createSlot',
      slotDeployKeywords: ['职业者', '冒险者'],
      slotDeployCardType: 'unit',
      slotExcludeFromFieldCount: true,
      description: '你可以将拥有「职业者」关键词或「冒险者」名词的单位牌部署在这张牌上，这些卡牌不再计算终局数量'
    },
    {
      timing: 'roundEnd',
      type: 'restoreEnergy',
      value: 1,
      requireDeployedOnSelf: true,
      description: '若上有部署牌，每回合结束回复1点能量'
    },
    {
      timing: 'roundEnd',
      type: 'modifyPower',
      value: 1,
      requireDeployedOnSelf: true,
      description: '若上有部署牌，每回合结束自身战力+1'`,
)

s = s.replace(
  /(\/\/ 050\. 哥布林杂兵[\s\S]*?timing: 'onReveal',\s*)type: 'conditional',\s*description: '揭示：你必须弃置一张手牌，否则这张牌会立即进入弃牌区'/,
  `$1type: 'discardHandOrSelf',
      description: '揭示：你必须弃置一张手牌，否则这张牌会立即进入弃牌区'`,
)

s = s.replace(
  /(\/\/ 074\. 狂战士[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '当这张牌的战力降低时，改为这张牌的战力提升对应数值'/,
  `$1type: 'invertPowerLoss',
      description: '当这张牌的战力降低时，改为这张牌的战力提升对应数值'`,
)

writeFileSync(path, s)
console.log('patch-4y.mjs done')

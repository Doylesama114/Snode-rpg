/**
 * 4M 批次：萨满祭司 / 珍珠商人 / 海港
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 萨满祭司 onDeploy 风/火/水/土单位 +1
s = s.replace(
  /(\/\/ 033\. 萨满祭司[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你的下一张风、火、水、土属性的单位牌战力分别\+1'/,
  `$1type: 'grantAttributePlayBonus',
      value: 1,
      targetAttributes: ['风', '火', '水', '土'],
      description: '你的下一张风、火、水、土属性的单位牌战力分别+1'`
)

// 珍珠商人 onDeploy 贝壳 D6 下限 5（珍珠档）
s = s.replace(
  /(\/\/ 062\. 珍珠商人[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你的[\u201c\u201d"]贝壳[\u201c\u201d"]卡牌必定能够掷出珍珠'/,
  `$1type: 'setD6MinForCardName',
      targetName: '贝壳',
      d6Min: 5,
      description: '你的「贝壳」卡牌必定能够掷出珍珠'`
)

// 海港 onDeploy 船单位槽 +3 不计终局
s = s.replace(
  /(\/\/ 109\. 海港[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你可以将拥有[\u201c\u201d"]船[\u201c\u201d"]名词的单位牌部署在这张牌上，这些卡牌不再计算终局数量，并且战力\+3'/,
  `$1type: 'createSlot',
      slotDeployKeywords: ['船'],
      slotDeployCardType: 'unit',
      slotDeployedPowerBonus: 3,
      slotExcludeFromFieldCount: true,
      description: '你可以将拥有「船」名词的单位牌部署在这张牌上，这些卡牌不再计算终局数量，并且战力+3'`
)

writeFileSync(path, s)
console.log('patch-4m.mjs done')

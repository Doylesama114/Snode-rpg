/**
 * 4L 批次：海葵 / 翻车鱼 / 拾贝鱼人
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = resolve(__dirname, '../src/data/cardDatabase.ts')
let s = readFileSync(path, 'utf8')

// 海葵 onDeploy 按场上低战力鱼牌计数
s = s.replace(
  /(\/\/ 058\. 海葵[\s\S]*?timing: 'onDeploy',\s*)type: 'conditional',\s*description: '你的场上每拥有一张基础战力不超过1的、拥有“鱼”名词的单位牌战力便\+2'/,
  `$1type: 'modifyPower',
      selfTarget: true,
      value: 2,
      countMatchingFieldCards: true,
      targetKeywords: ['鱼'],
      maxBasePower: 1,
      targetCardType: 'unit',
      description: '你的场上每拥有一张基础战力不超过1的、拥有「鱼」名词的单位牌战力便+2'`
)

// 翻车鱼 onOtherPlay 双倍加野兽打出牌
s = s.replace(
  /(\/\/ 057\. 翻车鱼[\s\S]*?effects: \[\s*\{\s*)timing: 'onDeploy',\s*type: 'conditional',\s*description: '当你打出一张拥有“野兽”关键词的卡牌后，使那张卡牌的战力\+1，这个效果会触发两次'/,
  `$1timing: 'onOtherPlay',
      type: 'modifyPower',
      value: 1,
      targetKeywords: ['野兽'],
      buffPlayedCard: true,
      triggerCount: 2,
      description: '当你打出一张拥有「野兽」关键词的卡牌后，使那张卡牌的战力+1，这个效果会触发两次'`
)

// 拾贝鱼人 shuffleAfterSearch
s = s.replace(
  /(\/\/ 064\. 拾贝鱼人[\s\S]*?type: 'searchDeck',\s*)searchName: '贝壳',\s*description:/,
  `$1searchName: '贝壳',
      shuffleAfterSearch: true,
      description:`
)

writeFileSync(path, s)
console.log('patch-4l.mjs done')

/**
 * 4L smoke：海葵 / 翻车鱼 / 拾贝鱼人
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0, ...extra }
}
function fieldSlot(card, pos = 0) {
  return { card, position: pos, isExtra: false }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const [id, name, type, timing] of [
  ['card_058', '海葵', 'modifyPower', 'onDeploy'],
  ['card_057', '翻车鱼', 'modifyPower', 'onOtherPlay'],
  ['card_064', '拾贝鱼人', 'searchDeck', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}
assert(seed.find(x => x.id === 'card_064')?.effects?.[0]?.shuffleAfterSearch, '拾贝鱼人 shuffleAfterSearch')

console.log('--- 海葵 countMatchingFieldCards ---')
{
  const anemone = makeCard({ name: '海葵', keywords: ['野兽'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    field: [
      fieldSlot(anemone),
      fieldSlot(makeCard({ name: '热带鱼', keywords: ['野兽'], basePower: 1 }), 1),
      fieldSlot(makeCard({ name: '鲈鱼', keywords: ['野兽'], basePower: 1 }), 2),
      fieldSlot(makeCard({ name: '棕熊', keywords: ['野兽'], basePower: 3 }), 3),
    ],
  })
  EffectManager.applyDeployEffect(
    {
      type: 'modifyPower', selfTarget: true, value: 2, countMatchingFieldCards: true,
      targetKeywords: ['鱼'], maxBasePower: 1, targetCardType: 'unit',
    },
    anemone,
    me,
    { players: [me], message: '' },
  )
  assert(anemone.currentPower === 5, `2条鱼 ×2 = 1+4=5 (got ${anemone.currentPower})`)
}

console.log('--- 翻车鱼 buffPlayedCard ×2 ---')
{
  const flounder = makeCard({
    name: '翻车鱼',
    effects: [{
      timing: 'onOtherPlay', type: 'modifyPower', value: 1,
      targetKeywords: ['野兽'], buffPlayedCard: true, triggerCount: 2,
    }],
  })
  const beast = makeCard({ name: '棕熊', keywords: ['野兽'], basePower: 3, currentPower: 3 })
  const me = makePlayer('p1', { field: [fieldSlot(flounder), fieldSlot(beast, 1)] })
  const game = { players: [me], message: '' }
  EffectManager.triggerOnOtherPlayEffects(beast, me, game)
  assert(beast.currentPower === 5, `野兽打出后 +2 → 5 (got ${beast.currentPower})`)
}

console.log('--- 拾贝鱼人 searchDeck + shuffle ---')
{
  const shell = makeCard({ name: '贝壳' })
  const me = makePlayer('p1', { deck: [makeCard({ name: '杂牌' }), shell] })
  EffectManager.applyDeployEffect(
    { type: 'searchDeck', searchName: '贝壳', shuffleAfterSearch: true },
    makeCard({ name: '拾贝鱼人' }),
    me,
    { players: [me] },
  )
  assert(me.hand.length === 1 && me.hand[0].name === '贝壳', '检索贝壳')
  assert(me.deck.length === 1, '剩余牌库 1 张')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

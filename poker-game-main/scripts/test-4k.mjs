/**
 * 4K smoke：奶牛 / 螃蟹 / 退役老兵
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
for (const [id, name, type] of [
  ['card_021', '奶牛', 'searchDeck'],
  ['card_063', '螃蟹', 'draw'],
  ['card_032', '退役老兵', 'modifyPower'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type, `${name} 已结构化 (${c?.effects?.[0]?.type})`)
}

console.log('--- 奶牛 requireFieldName 检索牛奶 ---')
{
  const milk = makeCard({ name: '牛奶', keywords: ['食物'] })
  const me = makePlayer('p1', {
    field: [fieldSlot(makeCard({ name: '挤奶工', keywords: ['居民'] }))],
    deck: [milk, makeCard({ name: '杂牌' })],
  })
  EffectManager.applyDeployEffect(
    { type: 'searchDeck', searchName: '牛奶', requireFieldName: '挤奶工', shuffleAfterSearch: true },
    makeCard({ name: '奶牛' }),
    me,
    { players: [me] },
  )
  assert(me.hand.length === 1 && me.hand[0].name === '牛奶', '有挤奶工时检索牛奶')
}

console.log('--- 奶牛 无挤奶工不触发 ---')
{
  const me = makePlayer('p1', { deck: [makeCard({ name: '牛奶' })] })
  const r = EffectManager.applyDeployEffect(
    { type: 'searchDeck', searchName: '牛奶', requireFieldName: '挤奶工' },
    makeCard({ name: '奶牛' }),
    me,
    { players: [me] },
  )
  assert(me.hand.length === 0 && r.messages.some(m => m.includes('条件不满足')), '无挤奶工不检索')
}

console.log('--- 螃蟹 有沙滩抽牌 ---')
{
  const me = makePlayer('p1', {
    field: [fieldSlot(makeCard({ name: '沙滩', type: 'environment' }))],
    deck: [makeCard({ name: '抽到的卡' })],
  })
  EffectManager.applyRevealEffect(
    { type: 'draw', drawCount: 1, requireFieldName: '沙滩' },
    makeCard({ name: '螃蟹' }),
    me,
    { players: [me] },
  )
  assert(me.hand.length === 1, '有沙滩时抽 1 张')
}

console.log('--- 退役老兵 条件 +3 ---')
{
  const veteran = makeCard({ name: '退役老兵', keywords: ['居民', '士兵'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    field: [
      fieldSlot(veteran),
      fieldSlot(makeCard({ name: '村民', keywords: ['居民'] }), 1),
    ],
  })
  EffectManager.applyDeployEffect(
    {
      type: 'modifyPower', selfTarget: true, value: 3,
      noOtherFieldKeyword: '士兵', requireOtherFieldKeyword: '居民',
    },
    veteran,
    me,
    { players: [me] },
  )
  assert(veteran.currentPower === 4, `战力 1+3=4 (got ${veteran.currentPower})`)
}

console.log('--- 退役老兵 有其他士兵不触发 ---')
{
  const veteran = makeCard({ name: '退役老兵', keywords: ['居民', '士兵'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    field: [
      fieldSlot(veteran),
      fieldSlot(makeCard({ name: '民兵', keywords: ['士兵'] }), 1),
      fieldSlot(makeCard({ name: '村民', keywords: ['居民'] }), 2),
    ],
  })
  EffectManager.applyDeployEffect(
    {
      type: 'modifyPower', selfTarget: true, value: 3,
      noOtherFieldKeyword: '士兵', requireOtherFieldKeyword: '居民',
    },
    veteran,
    me,
    { players: [me] },
  )
  assert(veteran.currentPower === 1, '有其他士兵时不加战力')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

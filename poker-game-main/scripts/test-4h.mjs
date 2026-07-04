/**
 * 4H smoke：酒吧女招待 / 杂货铺 / 燃烧之手
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

function makeCard(o) {
  return { id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无', basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const id of ['card_020', 'card_101', 'card_141']) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type !== 'conditional', `${c?.name} 已结构化`)
}

console.log('--- 酒吧女招待 searchNames ---')
{
  const p = makePlayer('p1', {
    deck: [
      makeCard({ name: '普通卡' }),
      makeCard({ name: '吟游诗人', keywords: ['居民'] }),
    ],
  })
  const found = EffectManager.searchDeck(p, {
    type: 'searchDeck',
    searchKeyword: '酒水',
    searchNames: ['酒馆', '吟游诗人'],
    maxCount: 1,
    shuffleAfterSearch: true,
  })
  assert(found.length === 1 && found[0].name === '吟游诗人', `按名称检索吟游诗人 (got ${found[0]?.name})`)
}

console.log('--- 杂货铺 searchEachKeyword ---')
{
  const p = makePlayer('p1', {
    deck: [
      makeCard({ name: '齿轮', keywords: ['奇械'] }),
      makeCard({ name: '箭袋', keywords: ['物件'] }),
      makeCard({ name: '锄头', keywords: ['务农'] }),
      makeCard({ name: '杂项' }),
    ],
  })
  const found = EffectManager.searchDeck(p, {
    type: 'searchDeck',
    searchEachKeyword: true,
    searchKeywords: ['奇械', '物件', '务农'],
    maxCount: 1,
    shuffleAfterSearch: true,
  })
  assert(found.length === 3, `各关键词各一张 → 3 (got ${found.length})`)
  const kws = found.map(c => c.keywords[0]).sort()
  assert(kws.join(',') === '务农,奇械,物件', `关键词齐全 (${kws.join(',')})`)
}

console.log('--- 燃烧之手 debuffOpponentHand ---')
{
  const left = makePlayer('p2', {
    hand: [
      makeCard({ name: 'A', basePower: 3, currentPower: 3 }),
      makeCard({ name: 'B', basePower: 2, currentPower: 2 }),
      makeCard({ name: 'C', basePower: 1, currentPower: 1 }),
    ],
  })
  const me = makePlayer('p1')
  const game = { players: [me, left] }
  const result = EffectManager.applyDeployEffect(
    { type: 'debuffOpponentHand', value: -2, handDebuffCount: 3 },
    makeCard({ name: '燃烧之手', type: 'tactic' }),
    me,
    game,
  )
  assert(left.hand.every(c => c.basePower === c.currentPower && c.basePower <= 1), '三张手牌 basePower -2')
  assert(result.messages.some(m => m.includes('p2')), `消息含对手名 (${result.messages[0]})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

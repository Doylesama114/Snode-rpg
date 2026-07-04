/**
 * 4I smoke：葡萄酒商人 / 魔法飞弹 / 暴徒
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
for (const id of ['card_027', 'card_014', 'card_029']) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type !== 'conditional', `${c?.name} 已结构化`)
}

console.log('--- 葡萄酒商人 searchName ---')
{
  const p = makePlayer('p1', {
    deck: [makeCard({ name: '杂项' }), makeCard({ name: '葡萄酒', keywords: ['酒水'] })],
  })
  const found = EffectManager.searchDeck(p, { type: 'searchDeck', searchName: '葡萄酒', maxCount: 1, shuffleAfterSearch: true })
  assert(found.length === 1 && found[0].name === '葡萄酒', `检索葡萄酒 (got ${found[0]?.name})`)
}

console.log('--- 魔法飞弹 targetLeftPlayer ---')
{
  const left = makePlayer('p2', { currentCost: 5 })
  const far = makePlayer('p3', { currentCost: 5 })
  const me = makePlayer('p1', { currentCost: 4 })
  const game = { players: [me, left, far] }
  EffectManager.applyRevealEffect(
    { type: 'modifyCost', value: -2, targetLeftPlayer: true },
    makeCard({ name: '魔法飞弹', type: 'tactic' }),
    me,
    game,
  )
  assert(left.currentCost === 3 && far.currentCost === 5, `仅左手边 -2 (left=${left.currentCost}, far=${far.currentCost})`)
}

console.log('--- 暴徒 noHigherPowerUnitOnField ---')
{
  const thug = makeCard({ name: '暴徒', type: 'unit', basePower: 1, currentPower: 1 })
  const p = makePlayer('p1', { field: [{ card: thug, position: 0, isExtra: false }] })
  EffectManager.applyDeployEffect(
    { type: 'modifyPower', value: 2, selfTarget: true, noHigherPowerUnitOnField: true },
    thug, p, { players: [p] },
  )
  assert(thug.currentPower === 3, `无更高单位 +2 → 3 (got ${thug.currentPower})`)
  const thug2 = makeCard({ name: '暴徒', type: 'unit', basePower: 1, currentPower: 1 })
  const big = makeCard({ name: '巨人', type: 'unit', basePower: 5, currentPower: 5 })
  const p2 = makePlayer('p2', {
    field: [
      { card: thug2, position: 0, isExtra: false },
      { card: big, position: 1, isExtra: false },
    ],
  })
  thug2.currentPower = 1
  EffectManager.applyDeployEffect(
    { type: 'modifyPower', value: 2, selfTarget: true, noHigherPowerUnitOnField: true },
    thug2, p2, { players: [p2] },
  )
  assert(thug2.currentPower === 1, `有更高单位不触发 (got ${thug2.currentPower})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

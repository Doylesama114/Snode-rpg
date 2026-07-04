/**
 * 4O smoke：猎人 / 游客 / 药剂师
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
  return { id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0, hasPlayedThisTurn: false, ...extra }
}
function fieldSlot(card, pos = 0) {
  return { card, position: pos, isExtra: false }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const [id, name, type, timing] of [
  ['card_052', '猎人', 'conditionalPlayCost', 'onDeploy'],
  ['card_025', '游客', 'modifyPowerByUniqueAttributes', 'onGameEnd'],
  ['card_051', '药剂师', 'grantTacticPlayFree', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}

console.log('--- 猎人 conditionalPlayCost 免费 ---')
{
  const hunter = seed.find(x => x.id === 'card_052')
  const card = makeCard({ name: '猎人', cost: 3, effects: hunter.effects })
  const withNature = makePlayer('p1', {
    field: [fieldSlot(makeCard({ name: '森林', type: 'environment', keywords: ['自然'], attribute: '木' }))],
  })
  assert(EffectManager.getEffectivePlayCost(card, withNature) === 0, '有自然环境费用 0')
  assert(EffectManager.getEffectivePlayCost(card, makePlayer('p2')) === 3, '无自然环境费用 3')
}

console.log('--- 游客 modifyPowerByUniqueAttributes ---')
{
  const tourist = makeCard({ name: '游客', basePower: 1, currentPower: 1 })
  const effect = seed.find(x => x.id === 'card_025').effects[0]
  const me = makePlayer('p1', {
    field: [fieldSlot(tourist), fieldSlot(makeCard({ name: '火元素', attribute: '火' }), 1)],
    hand: [makeCard({ name: '水元素', attribute: '水' })],
  })
  EffectManager.applyGameEndEffect(effect, tourist, me)
  assert(tourist.currentPower === 3, `3种属性(无/火/水) → 1+2=3 (got ${tourist.currentPower})`)
}

console.log('--- 药剂师 grantTacticPlayFree ---')
{
  const me = makePlayer('p1', { hasPlayedThisTurn: true })
  const effect = seed.find(x => x.id === 'card_051').effects[0]
  EffectManager.applyDeployEffect(effect, makeCard({ name: '药剂师' }), me, { players: [me] })
  assert(me.tacticPlayFreeKeywords?.includes('药剂'), 'pending 药剂免费战术')
  const potion = makeCard({ name: '生命药水', type: 'tactic', keywords: ['药剂'] })
  assert(EffectManager.consumeTacticPlayFreeIfMatch(potion, me), '消耗免费战术')
  assert(!me.hasPlayedThisTurn && !me.tacticPlayFreeKeywords, '行动已恢复且一次性')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

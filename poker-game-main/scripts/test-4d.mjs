/**
 * 4D 批次 smoke：德鲁伊 / 射击俱乐部 / 寒脊山脉
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return { id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无', basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: false, ...o }
}
function makePlayer(id, field = [], deck = []) {
  return { id, name: id, hand: [], deck: [...deck], discard: [], field: field.map((c, i) => ({ card: c, position: i, isExtra: false })), currentCost: 2, canPlayExtra: false }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 德鲁伊 requireField + restoreEnergy ---')
{
  const forest = makeCard({ name: '森林', type: 'environment', keywords: ['自然'], attribute: '木' })
  const druid = makeCard({ name: '德鲁伊', type: 'unit' })
  const player = makePlayer('p1', [forest, druid])
  const game = { players: [player], message: '' }
  const r = EffectManager.applyRoundEffect({
    type: 'restoreEnergy', value: 1, requireFieldKeywords: ['自然'], requireFieldCardType: 'environment', timing: 'roundStart',
  }, druid, player, game)
  assert(player.currentCost === 3, `有自然环境牌时 +1 能量 (${player.currentCost})`)
  const p2 = makePlayer('p2', [druid])
  const r2 = EffectManager.applyRoundEffect({
    type: 'restoreEnergy', value: 1, requireFieldKeywords: ['自然'], requireFieldCardType: 'environment', timing: 'roundStart',
  }, druid, p2, { players: [p2], message: '' })
  assert(p2.currentCost === 2 && r2.messages.length === 0, '无自然环境牌时不触发')
}

console.log('--- 射击俱乐部 roundStart searchDeck ---')
{
  const shooter = makeCard({ name: '精准射击', keywords: ['射击'] })
  const player = makePlayer('p1', [makeCard({ name: '射击俱乐部', type: 'environment' })], [makeCard({ name: '其他' }), shooter])
  const r = EffectManager.applyRoundEffect({
    type: 'searchDeck', searchName: '射击', maxCount: 1, shuffleAfterSearch: true, searchDiscard: false, timing: 'roundStart',
  }, player.field[0].card, player, { players: [player], message: '' })
  assert(player.hand.length === 1 && player.hand[0].name === '精准射击', '检索到射击卡')
}

console.log('--- 寒脊山脉 roundEnd 全场属性改战力 ---')
{
  const ice = makeCard({ name: '冰卡', attribute: '冰', currentPower: 2, basePower: 2 })
  const fire = makeCard({ name: '火卡', attribute: '火', currentPower: 3, basePower: 3 })
  const game = { players: [makePlayer('p1', [ice, fire])], message: '' }
  EffectManager.applyRoundEffect({ type: 'modifyPower', value: -1, allPlayers: true, targetAllCards: true, excludeAttributes: ['冰'], timing: 'roundEnd' }, makeCard({ name: '寒脊山脉', type: 'environment' }), game.players[0], game)
  EffectManager.applyRoundEffect({ type: 'modifyPower', value: 1, allPlayers: true, targetAllCards: true, targetAttributes: ['冰'], timing: 'roundEnd' }, makeCard({ name: '寒脊山脉', type: 'environment' }), game.players[0], game)
  assert(fire.currentPower === 2 && ice.currentPower === 3, `火-1=${fire.currentPower} 冰+1=${ice.currentPower}`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

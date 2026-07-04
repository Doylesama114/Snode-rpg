/**
 * 4J smoke：海鸥 / 精准射击 / 气泡酒
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
for (const id of ['card_083', 'card_127', 'card_138']) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type !== 'conditional', `${c?.name} 已结构化 (${c?.effects?.[0]?.type})`)
}

console.log('--- 海鸥 stealCard targetLeftPlayer ---')
{
  const left = makePlayer('p2', { hand: [makeCard({ name: '手牌A' })] })
  const far = makePlayer('p3', { hand: [makeCard({ name: '手牌B' })] })
  const me = makePlayer('p1')
  const game = { players: [me, left, far] }
  EffectManager.applyRevealEffect(
    { type: 'stealCard', targetLeftPlayer: true },
    makeCard({ name: '海鸥' }),
    me,
    game,
  )
  assert(me.hand.length === 1 && left.hand.length === 0 && far.hand.length === 1, '仅偷左手边')
}

console.log('--- 精准射击 destroy -2 ---')
{
  const target = makeCard({ name: '目标', basePower: 2, currentPower: 2 })
  const owner = makePlayer('p2', { field: [{ card: target, position: 0, isExtra: false }] })
  const game = { players: [makePlayer('p1'), owner] }
  const r = EffectManager.applyDestroyToTarget(target, { type: 'destroy', value: -2 }, game)
  assert(r.destroyed && owner.field[0].card === null, '2-2=0 被摧毁')
}

console.log('--- 气泡酒 grantUnitPlayBonus ---')
{
  const me = makePlayer('p1')
  EffectManager.applyRevealEffect(
    { type: 'grantUnitPlayBonus', value: 1 },
    makeCard({ name: '气泡酒', type: 'tactic' }),
    me,
    { players: [me] },
  )
  assert(me.unitPlayPowerBonus === 1, `bonus=1 (got ${me.unitPlayPowerBonus})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

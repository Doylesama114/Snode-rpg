/**
 * 4C 批次引擎 smoke 测试：休憩曲 / 祈福 / 炎炎夏日
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(overrides) {
  return {
    id: 'test', name: '测试', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: false,
    ...overrides,
  }
}

function makePlayer(id, fieldCards = []) {
  return {
    id, name: id, hand: [], deck: [], discard: [],
    field: fieldCards.map((c, i) => ({ card: c, position: i, isExtra: false })),
    currentCost: 2, canPlayExtra: false,
  }
}

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`) }
  else { failed++; console.error(`  ❌ ${msg}`) }
}

console.log('--- 休憩曲 restoreEnergy ---')
{
  const player = makePlayer('p1')
  const tactic = makeCard({ name: '休憩曲', type: 'tactic' })
  EffectManager.applyDeployEffect({ type: 'restoreEnergy', value: 5 }, tactic, player, { players: [player] })
  assert(player.currentCost === 7, `能量 2+5=7 (got ${player.currentCost})`)
}

console.log('--- 祈福 absNegativePower ---')
{
  const neg = makeCard({ name: '受伤单位', currentPower: -3, basePower: -3 })
  const player = makePlayer('p1', [neg])
  const tactic = makeCard({ name: '祈福', type: 'tactic' })
  EffectManager.applyDeployEffect({ type: 'absNegativePower' }, tactic, player, { players: [player] })
  assert(neg.currentPower === 3 && neg.basePower === 3, `负数变正 3 (got ${neg.currentPower})`)
}

console.log('--- 炎炎夏日 setFieldAttribute ---')
{
  const env = makeCard({ name: '森林', type: 'environment', attribute: '木' })
  const unit = makeCard({ name: '战士', type: 'unit', attribute: '无' })
  const game = { players: [makePlayer('p1', [env, unit]), makePlayer('p2', [makeCard({ name: '海滩', type: 'environment', attribute: '水' })])] }
  const tactic = makeCard({ name: '炎炎夏日', type: 'tactic' })
  EffectManager.applyDeployEffect({
    type: 'setFieldAttribute', value: '火', targetCardType: 'environment', allPlayers: true,
  }, tactic, game.players[0], game)
  assert(env.attribute === '火' && game.players[1].field[0].card.attribute === '火', '环境牌变火')
  assert(unit.attribute === '无', '单位牌不变')
}

console.log('--- card-seed 三张卡 ---')
{
  const cards = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))
  for (const name of ['休憩曲', '祈福', '炎炎夏日']) {
    const c = cards.find(x => x.name === name)
    assert(c?.effects?.some(e => e.type !== 'conditional'), `${name} 已结构化`)
  }
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

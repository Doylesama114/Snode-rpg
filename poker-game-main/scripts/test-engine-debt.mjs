/**
 * 引擎债 smoke：环境摧毁 / canDestroyTarget
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 普通环境不可摧毁 ---')
{
  const env = makeCard({ name: '森林', type: 'environment', keywords: ['自然'] })
  assert(!EffectManager.canDestroyTarget(env, { type: 'destroy', value: -99 }), '无 flag 时 environment 免疫')
}

console.log('--- 建筑关键词环境可被力场波摧毁 ---')
{
  const building = makeCard({ name: '杂货铺', type: 'environment', keywords: ['建筑'] })
  const owner = makePlayer('p2', { field: [{ card: building, position: 0, isExtra: false }] })
  const game = { players: [makePlayer('p1'), owner] }
  const r = EffectManager.applyDestroyToTarget(
    building,
    { type: 'destroy', value: 0, targetKeywords: ['建筑'] },
    game,
  )
  assert(r.destroyed && owner.field[0].card === null, '力场波 keyword destroy 建筑环境')
}

console.log('--- destroyEnvironment 可摧毁任意环境 ---')
{
  const env = makeCard({ name: '普通环境', type: 'environment' })
  const owner = makePlayer('p2', { field: [{ card: env, position: 0, isExtra: false }] })
  const game = { players: [makePlayer('p1'), owner] }
  const r = EffectManager.applyDestroyToTarget(
    env,
    { type: 'destroy', value: -1, destroyEnvironment: true },
    game,
  )
  assert(r.destroyed, 'destroyEnvironment 允许摧毁环境')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

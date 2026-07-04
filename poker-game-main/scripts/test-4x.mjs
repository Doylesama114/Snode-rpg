/**
 * 4X smoke：板甲 / 三叉戟 / 攀岩爱好者
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
  return { id, name: id, hand: [], deck: [], discard: [], field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })), currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
{
  const armor = seed.find(x => x.id === 'card_094')
  assert(armor?.effects?.[0]?.type === 'deployOnHostOnly', '板甲 deployOnHostOnly')
  const trident = seed.find(x => x.id === 'card_093')
  assert(trident?.effects?.[0]?.hostBonusIfHostAttribute === '水', '三叉戟 水属性加成')
  const climber = seed.find(x => x.id === 'card_076')
  assert(climber?.effects?.[0]?.allowNormalDeploy === true, '攀岩爱好者 allowNormalDeploy')
}

console.log('--- 板甲 士兵/职业者 ---')
{
  const armor = makeCard({ name: '板甲', basePower: 1, effects: seed.find(x => x.id === 'card_094').effects })
  const soldier = makeCard({ name: '利剑中队', keywords: ['士兵'] })
  const knight = makeCard({ name: '圣洁骑士', keywords: ['职业者'] })
  const bear = makeCard({ name: '棕熊', keywords: ['野兽'] })
  const me = makePlayer('p1', {
    field: [
      { card: soldier, position: 0, isExtra: false },
      { card: knight, position: 1, isExtra: false },
      { card: bear, position: 2, isExtra: false },
      ...Array.from({ length: 3 }, (_, i) => ({ card: null, position: i + 3, isExtra: false })),
    ],
  })
  const targets = EffectManager.getQuickPlayHostTargets(me, armor)
  assert(targets.length === 2, `板甲宿主 2 张 (got ${targets.length})`)
  assert(EffectManager.requiresMandatoryHostDeploy(armor), '板甲必须宿主部署')
}

console.log('--- 三叉戟 水属性 +2 ---')
{
  const trident = makeCard({ name: '三叉戟', basePower: 2, effects: seed.find(x => x.id === 'card_093').effects })
  const waterUnit = makeCard({ name: '水元素', type: 'unit', attribute: '水', basePower: 2, currentPower: 2 })
  const fireUnit = makeCard({ name: '火元素', type: 'unit', attribute: '火', basePower: 2, currentPower: 2 })
  assert(EffectManager.computeHostDeployDelta(trident, waterUnit) === 4, '水单位 2+2=4')
  assert(EffectManager.computeHostDeployDelta(trident, fireUnit) === 2, '非水 2+0=2')
  const me = makePlayer('p1', { field: [{ card: waterUnit, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  EffectManager.applyDeployOntoHost(trident, waterUnit, me, { players: [me], message: '' })
  assert(waterUnit.currentPower === 6, `宿主 2+4=6 (got ${waterUnit.currentPower})`)
}

console.log('--- 攀岩爱好者 土环境 +3 ---')
{
  const climber = makeCard({ name: '攀岩爱好者', basePower: 1, effects: seed.find(x => x.id === 'card_076').effects })
  const earthEnv = makeCard({ name: '土丘', type: 'environment', attribute: '土', basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    field: [{ card: earthEnv, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  assert(!EffectManager.requiresMandatoryHostDeploy(climber), '攀岩可选普通槽')
  assert(EffectManager.getAvailableSlotIndices(me, climber).length > 0, '仍有空槽')
  EffectManager.applyDeployOntoHost(climber, earthEnv, me, { players: [me], message: '' })
  assert(earthEnv.currentPower === 5, `1+1+3=5 (got ${earthEnv.currentPower})`)
}

console.log(`\n--- 4X: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

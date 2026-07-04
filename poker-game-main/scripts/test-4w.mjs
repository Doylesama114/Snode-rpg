/**
 * 4W smoke：洋葱 / 渔网 / 短柄斧
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
    basePower: 0, currentPower: 0, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })), currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
{
  const onion = seed.find(x => x.id === 'card_075')
  assert(onion?.effects?.[0]?.type === 'deployOnHostOnly', '洋葱 deployOnHostOnly')
  const net = seed.find(x => x.id === 'card_017')
  assert(net?.effects?.[0]?.requireHostCardType === 'unit', '渔网 requireHostCardType unit')
  const axe = seed.find(x => x.id === 'card_092')
  assert(axe?.effects?.[0]?.timing === 'onDeploy', '短柄斧 onDeploy')
  assert(axe?.effects?.[0]?.requireHostKeywords?.includes('士兵'), '短柄斧 requireHostKeywords')
}

console.log('--- 洋葱 农田宿主 ---')
{
  const onion = makeCard({ name: '洋葱', quickPlay: true, effects: seed.find(x => x.id === 'card_075').effects })
  const farm = makeCard({ name: '农田', type: 'environment', keywords: ['自然', '务农'] })
  const me = makePlayer('p1', {
    field: [{ card: farm, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  assert(EffectManager.getQuickPlayHostTargets(me, onion).length === 1, '洋葱→农田')
}

console.log('--- 渔网 仅单位 ---')
{
  const net = makeCard({ name: '渔网', basePower: -1, currentPower: -1, quickPlay: true, effects: seed.find(x => x.id === 'card_017').effects })
  const unit = makeCard({ name: '棕熊', type: 'unit', keywords: ['野兽'], basePower: 3, currentPower: 3 })
  const env = makeCard({ name: '农田', type: 'environment', keywords: ['自然'] })
  const me = makePlayer('p1', {
    field: [
      { card: unit, position: 0, isExtra: false },
      { card: env, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const targets = EffectManager.getQuickPlayHostTargets(me, net)
  assert(targets.length === 1 && targets[0].name === '棕熊', '渔网仅选单位')
}

console.log('--- 短柄斧 士兵宿主 + 无空槽 ---')
{
  const axe = makeCard({ name: '短柄斧', basePower: 1, currentPower: 1, cost: 3, effects: seed.find(x => x.id === 'card_092').effects })
  const soldier = makeCard({ name: '利剑中队', type: 'unit', keywords: ['士兵'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    hand: [axe],
    currentCost: 5,
    field: [
      { card: soldier, position: 0, isExtra: false },
      ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false })),
    ],
  })
  assert(EffectManager.getAvailableSlotIndices(me, axe).length === 0, '短柄斧无普通空槽')
  assert(EffectManager.meetsPlayRequirements(axe, me), '有士兵可打出')
  const msgs = EffectManager.applyDeployOntoHost(axe, soldier, me, { players: [me], message: '' })
  assert(soldier.currentPower === 2, `宿主 1+1=2 (got ${soldier.currentPower})`)
  assert(msgs.some(m => m.includes('部署到')), '有部署消息')
}

console.log(`\n--- 4W: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

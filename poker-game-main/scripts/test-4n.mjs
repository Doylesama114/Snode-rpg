/**
 * 4N smoke：奴隶 / 蔓生怪 / 珊瑚元素
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
function fieldSlot(card, pos = 0, isExtra = false) {
  return { card, position: pos, isExtra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const [id, name, type] of [
  ['card_028', '奴隶', 'excludeFromFieldCount'],
  ['card_054', '蔓生怪', 'conditionalPlayCost'],
  ['card_067', '珊瑚元素', 'modifyPower'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type, `${name} 已结构化 (${type})`)
}

console.log('--- 奴隶 excludeFromFieldCount ---')
{
  const slave = makeCard({ name: '奴隶', cost: 1 })
  const me = makePlayer('p1')
  EffectManager.applyDeployEffect(
    seed.find(x => x.id === 'card_028').effects[0],
    slave,
    me,
    { players: [me] },
  )
  assert(slave.excludeFromFieldCount === true, '标记不计入终局')
  me.field.push(fieldSlot(slave))
  assert(EffectManager.countMainFieldCardsForLimit(me) === 0, '主槽奴隶不计入 6 张')
}

console.log('--- 蔓生怪 conditionalPlayCost ---')
{
  const vine = seed.find(x => x.id === 'card_054')
  const card = makeCard({ name: '蔓生怪', cost: 3, effects: vine.effects })
  const withWood = makePlayer('p1', {
    field: [fieldSlot(makeCard({ name: '森林', type: 'environment', attribute: '木' }))],
  })
  const alone = makePlayer('p2')
  assert(EffectManager.getEffectivePlayCost(card, withWood) === 1, '有木环境费用 1')
  assert(EffectManager.getEffectivePlayCost(card, alone) === 3, '无木环境费用 3')
}

console.log('--- 珊瑚元素 requireAllFieldAttributes ---')
{
  const coral = makeCard({ name: '珊瑚元素', basePower: 3, currentPower: 3 })
  const effect = seed.find(x => x.id === 'card_067').effects[0]
  const me = makePlayer('p1', {
    field: [
      fieldSlot(makeCard({ name: '大海', type: 'environment', attribute: '水' })),
      fieldSlot(makeCard({ name: '晴天', type: 'environment', attribute: '光' }), 1),
    ],
  })
  EffectManager.applyDeployEffect(effect, coral, me, { players: [me] })
  assert(coral.currentPower === 6, `水+光环境 → 3+3=6 (got ${coral.currentPower})`)
  const me2 = makePlayer('p2', {
    field: [fieldSlot(makeCard({ name: '大海', type: 'environment', attribute: '水' }))],
  })
  const coral2 = makeCard({ name: '珊瑚元素', basePower: 3, currentPower: 3 })
  const r = EffectManager.applyDeployEffect(effect, coral2, me2, { players: [me2] })
  assert(coral2.currentPower === 3 && r.messages.some(m => m.includes('未触发')), '仅水环境不加成')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

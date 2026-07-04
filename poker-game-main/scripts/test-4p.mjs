/**
 * 4P smoke：武僧 / 溪流 / 帆船
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
for (const [id, name, type, timing] of [
  ['card_034', '武僧', 'modifyPower', 'onOtherPlay'],
  ['card_108', '溪流', 'searchFromHandOrDeck', 'onDeploy'],
  ['card_110', '帆船', 'playRequirement', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}

console.log('--- 武僧 onOtherPlay 战术 +1 ---')
{
  const monk = makeCard({ name: '武僧', basePower: 2, currentPower: 2, effects: seed.find(x => x.id === 'card_034').effects })
  const me = makePlayer('p1')
  me.field[0].card = monk
  const tactic = makeCard({ name: '休憩曲', type: 'tactic', keywords: [] })
  EffectManager.triggerOnOtherPlayEffects(tactic, me, { players: [me], message: '' })
  assert(monk.currentPower === 3, `战术打出后 2+1=3 (got ${monk.currentPower})`)
}

console.log('--- 溪流 searchFromHandOrDeck ---')
{
  const fish = makeCard({ name: '热带鱼', type: 'unit', cost: 1, basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', { deck: [fish], currentCost: 4 })
  const streamEffect = seed.find(x => x.id === 'card_108').effects[0]
  const r = EffectManager.applyDeployEffect(streamEffect, makeCard({ name: '溪流', type: 'environment' }), me, { players: [me] })
  assert(me.field.some(s => s.card?.name === '热带鱼'), '牌库鱼已部署')
  assert(me.currentCost === 3, '支付 1 费用')
  assert(r.messages.some(m => m.includes('部署')), '有部署消息')
}

console.log('--- 帆船 playRequirement ---')
{
  const sail = makeCard({ name: '帆船', type: 'environment', cost: 0, effects: seed.find(x => x.id === 'card_110').effects })
  const withWater = makePlayer('p1', {
    field: Array.from({ length: 6 }, (_, i) => ({
      card: i === 0 ? makeCard({ name: '大海', type: 'environment', attribute: '水' }) : null,
      position: i, isExtra: false,
    })),
  })
  const alone = makePlayer('p2')
  assert(EffectManager.meetsPlayRequirements(sail, withWater), '有水环境可打出帆船')
  assert(!EffectManager.meetsPlayRequirements(sail, alone), '无水环境不可打出')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

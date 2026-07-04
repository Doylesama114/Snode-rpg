/**
 * 4R smoke：搬运工 / 锻炉 / 贫民窟
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
  ['card_024', '搬运工', 'deployFromHand', 'onDeploy'],
  ['card_112', '锻炉', 'modifyPower', 'onReforge'],
  ['card_122', '贫民窟', 'debuffAheadPlayers', 'onGameEnd'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}

console.log('--- 搬运工 deployFromHand ---')
{
  const host = makeCard({ name: '狮鹫', type: 'unit', basePower: 3, currentPower: 3 })
  const obj1 = makeCard({ name: '板甲', type: 'unit', keywords: ['物件'], cost: 1 })
  const obj2 = makeCard({ name: '武器架', type: 'unit', keywords: ['物件'], cost: 2 })
  const me = makePlayer('p1', {
    hand: [obj1, obj2],
    currentCost: 5,
    field: [
      { card: host, position: 0, isExtra: false },
      { card: null, position: 1, isExtra: true, parentSlot: 0 },
      { card: null, position: 2, isExtra: true, parentSlot: 0 },
      ...Array.from({ length: 3 }, (_, i) => ({ card: null, position: i + 3, isExtra: false })),
    ],
  })
  const effect = seed.find(x => x.id === 'card_024').effects[0]
  const r = EffectManager.applyDeployEffect(effect, makeCard({ name: '搬运工' }), me, { players: [me] })
  const deployed = me.field.filter(s => s.isExtra && s.card).length
  assert(deployed === 2, `部署 2 张物件 (got ${deployed})`)
  assert(me.currentCost === 2, '支付 1+2=3 费用')
  assert(r.messages.some(m => m.includes('额外槽位')), '有部署消息')
}

console.log('--- 锻炉 onReforge +2 ---')
{
  const forge = makeCard({ name: '锻炉', type: 'environment', basePower: 2, currentPower: 2, effects: seed.find(x => x.id === 'card_112').effects })
  const me = makePlayer('p1', { field: [{ card: forge, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))] })
  EffectManager.triggerReforgeEffects(me, { players: [me], message: '' })
  assert(forge.currentPower === 4, `重铸后 2+2=4 (got ${forge.currentPower})`)
}

console.log('--- 贫民窟 debuffAheadPlayers ---')
{
  const slum = makeCard({ name: '贫民窟', type: 'environment', effects: seed.find(x => x.id === 'card_122').effects })
  const owner = makePlayer('p1', {
    bonusPower: 5,
    field: [{ card: slum, position: 0, isExtra: false }, ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  const ahead = makePlayer('p2', {
    bonusPower: 10,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
  })
  const behind = makePlayer('p3', {
    bonusPower: 2,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
  })
  const game = { players: [owner, ahead, behind], message: '' }
  EffectManager.triggerGameEndEffects(game)
  assert(ahead.bonusPower === 6, `领先玩家 10-4=6 (got ${ahead.bonusPower})`)
  assert(behind.bonusPower === 2, `非领先玩家不变 (got ${behind.bonusPower})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

/**
 * 4U smoke：红宝石 / 蓝宝石 / 绿宝石
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
for (const [id, name, type, timing] of [
  ['card_040', '红宝石', 'playRequirement', 'onDeploy'],
  ['card_041', '蓝宝石', 'playRequirement', 'onDeploy'],
  ['card_042', '绿宝石', 'playRequirement', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}
{
  const ruby = seed.find(x => x.id === 'card_040')
  assert(ruby?.effects?.[1]?.type === 'setPowerIfFieldKeyword', '红宝石 onGameEnd setPowerIfFieldKeyword')
  const sapphire = seed.find(x => x.id === 'card_041')
  assert(sapphire?.effects?.[1]?.type === 'setPowerIfHandNames', '蓝宝石 onGameEnd setPowerIfHandNames')
  const emerald = seed.find(x => x.id === 'card_042')
  assert(emerald?.effects?.[1]?.requireHandNames?.length === 2, '绿宝石 requireHandNames 双名称')
}

console.log('--- unplayable ---')
{
  const ruby = makeCard({ ...seed.find(x => x.id === 'card_040'), name: '红宝石' })
  assert(!EffectManager.meetsPlayRequirements(ruby, makePlayer('p1')), '红宝石不可打出')
}

console.log('--- 红宝石 setPowerIfFieldKeyword ---')
{
  const ruby = makeCard({ name: '红宝石', effects: seed.find(x => x.id === 'card_040').effects })
  const noble = makeCard({ name: '落魄男爵', keywords: ['居民', '贵族'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    hand: [ruby],
    field: [
      { card: noble, position: 0, isExtra: false },
      ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false })),
    ],
  })
  EffectManager.triggerGameEndEffects({ players: [me], message: '' })
  assert(ruby.currentPower === 3, `红宝石→3 (got ${ruby.currentPower})`)
  assert(me.bonusPower === 3, `手牌计入 bonusPower (got ${me.bonusPower})`)
}

console.log('--- 蓝宝石 setPowerIfHandNames ---')
{
  const ruby = makeCard({ name: '红宝石', basePower: 0, currentPower: 0 })
  const sapphire = makeCard({ name: '蓝宝石', effects: seed.find(x => x.id === 'card_041').effects })
  const me = makePlayer('p1', { hand: [sapphire, ruby] })
  EffectManager.triggerGameEndEffects({ players: [me], message: '' })
  assert(sapphire.currentPower === 2, `蓝宝石→2 (got ${sapphire.currentPower})`)
  assert(me.bonusPower === 2, `bonusPower +2 (got ${me.bonusPower})`)
}

console.log('--- 绿宝石 setPowerIfHandNames 双名称 ---')
{
  const ruby = makeCard({ name: '红宝石', basePower: 0, currentPower: 0 })
  const sapphire = makeCard({ name: '蓝宝石', basePower: 0, currentPower: 0 })
  const emerald = makeCard({ name: '绿宝石', effects: seed.find(x => x.id === 'card_042').effects })
  const me = makePlayer('p1', { hand: [emerald, ruby, sapphire] })
  EffectManager.triggerGameEndEffects({ players: [me], message: '' })
  assert(emerald.currentPower === 4, `绿宝石→4 (got ${emerald.currentPower})`)
  assert(me.bonusPower === 4, `bonusPower +4 (got ${me.bonusPower})`)
}

console.log(`\n--- 4U: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

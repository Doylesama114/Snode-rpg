/**
 * 4T smoke：食人魔 / 纪念照 / 金矿
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
  ['card_037', '食人魔', 'destroyRandomOther', 'onGameEnd'],
  ['card_038', '纪念照', 'playRequirement', 'onDeploy'],
  ['card_039', '金矿', 'playRequirement', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}
{
  const photo = seed.find(x => x.id === 'card_038')
  assert(photo?.effects?.[1]?.type === 'setPowerIfFieldNames', '纪念照 onGameEnd setPowerIfFieldNames')
  const gold = seed.find(x => x.id === 'card_039')
  assert(gold?.effects?.[1]?.type === 'setPowerIfOnlyHandCard', '金矿 onGameEnd setPowerIfOnlyHandCard')
}

console.log('--- unplayable playRequirement ---')
{
  const gold = makeCard({ ...seed.find(x => x.id === 'card_039'), name: '金矿' })
  const me = makePlayer('p1')
  assert(!EffectManager.meetsPlayRequirements(gold, me), '金矿不可打出')
}

console.log('--- 食人魔 destroyRandomOther ---')
{
  const ogre = makeCard({ name: '食人魔', effects: seed.find(x => x.id === 'card_037').effects })
  const victim = makeCard({ name: '受害者', basePower: 3, currentPower: 3 })
  const me = makePlayer('p1', {
    hand: [makeCard({ name: '手牌卡' })],
    field: [
      { card: ogre, position: 0, isExtra: false },
      { card: victim, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  const game = { players: [me], message: '' }
  EffectManager.triggerGameEndEffects(game)
  const fieldCount = me.field.filter(s => s.card).length
  const handCount = me.hand.length
  assert(fieldCount + handCount === 2, `消灭一张后剩 2 张 (field=${fieldCount} hand=${handCount})`)
}

console.log('--- 纪念照 setPowerIfFieldNames ---')
{
  const photo = makeCard({ name: '纪念照', basePower: 0, currentPower: 0, effects: seed.find(x => x.id === 'card_038').effects })
  const env = makeCard({ name: '森林', type: 'environment', basePower: 2, currentPower: 2 })
  const cam = makeCard({ name: '摄像机', basePower: 1, currentPower: 1 })
  const tourist = makeCard({ name: '游客', basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    hand: [photo],
    field: [
      { card: env, position: 0, isExtra: false },
      { card: cam, position: 1, isExtra: false },
      { card: tourist, position: 2, isExtra: false },
      ...Array.from({ length: 3 }, (_, i) => ({ card: null, position: i + 3, isExtra: false })),
    ],
  })
  const game = { players: [me], message: '' }
  EffectManager.triggerGameEndEffects(game)
  assert(photo.currentPower === 4, `纪念照战力→4 (got ${photo.currentPower})`)
  assert(me.bonusPower === 4, `手牌纪念照计入 bonusPower (got ${me.bonusPower})`)
}

console.log('--- 金矿 setPowerIfOnlyHandCard ---')
{
  const gold = makeCard({ name: '金矿', basePower: 0, currentPower: 0, effects: seed.find(x => x.id === 'card_039').effects })
  const me = makePlayer('p1', { hand: [gold] })
  const game = { players: [me], message: '' }
  EffectManager.triggerGameEndEffects(game)
  assert(gold.currentPower === 7, `金矿战力→7 (got ${gold.currentPower})`)
  assert(me.bonusPower === 7, `唯一手牌计入 bonusPower (got ${me.bonusPower})`)
  assert(EffectManager.getPlayerTotalPower(me) === 7, `终局总分 7 (got ${EffectManager.getPlayerTotalPower(me)})`)
}

console.log(`\n--- 4T: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

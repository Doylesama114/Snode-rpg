/**
 * 4M smoke：萨满祭司 / 珍珠商人 / 海港
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

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const [id, name, type] of [
  ['card_033', '萨满祭司', 'grantAttributePlayBonus'],
  ['card_062', '珍珠商人', 'setD6MinForCardName'],
  ['card_109', '海港', 'createSlot'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type, `${name} 已结构化 (${type})`)
}
{
  const port = seed.find(x => x.id === 'card_109')
  assert(port?.effects?.[0]?.slotDeployKeywords?.includes('船'), '海港 slotDeployKeywords 船')
  assert(port?.effects?.[0]?.slotDeployedPowerBonus === 3, '海港 +3 战力')
  assert(port?.effects?.[0]?.slotExcludeFromFieldCount === true, '海港不计终局')
}

console.log('--- 萨满祭司 grantAttributePlayBonus ---')
{
  const player = makePlayer('p1')
  const effect = seed.find(x => x.id === 'card_033').effects[0]
  EffectManager.applyDeployEffect(effect, makeCard({ name: '萨满祭司' }), player, { players: [player] })
  assert(player.unitPlayAttributeBonus?.火 === 1, '火属性加成 +1')
  const fireUnit = makeCard({ name: '火元素', attribute: '火', basePower: 2, currentPower: 2 })
  EffectManager.applyUnitDeployBonuses(fireUnit, player)
  assert(fireUnit.currentPower === 3, `火单位 2+1=3 (got ${fireUnit.currentPower})`)
}

console.log('--- 珍珠商人 setD6MinForCardName ---')
{
  const player = makePlayer('p1')
  const effect = seed.find(x => x.id === 'card_062').effects[0]
  EffectManager.applyDeployEffect(effect, makeCard({ name: '珍珠商人' }), player, { players: [player] })
  assert(player.d6MinByCardName?.贝壳 === 5, '贝壳 D6 下限 5')
  const shell = makeCard({ name: '贝壳' })
  const d6 = { type: 'd6TierPower', d6Tiers: [{ min: 1, max: 2, value: 0 }, { min: 3, max: 4, value: 1 }, { min: 5, max: 6, value: 5 }] }
  const orig = EffectManager.rollD6
  EffectManager.rollD6 = () => 1
  const { roll, value } = EffectManager.rollD6TierValue(d6, player, shell)
  EffectManager.rollD6 = orig
  assert(roll === 5 && value === 5, `低掷骰→珍珠 +5 (roll=${roll}, value=${value})`)
}

console.log('--- 海港 createSlot 规则 ---')
{
  const portEffect = seed.find(x => x.id === 'card_109').effects[0]
  const rules = EffectManager.slotRulesFromEffect(portEffect)
  const slot = EffectManager.buildExtraSlot(0, 1, rules)
  const ship = makeCard({ name: '走私船', keywords: ['载具'] })
  const wolf = makeCard({ name: '狼', keywords: ['野兽'] })
  assert(EffectManager.canDeployOnExtraSlot(ship, slot), '名称含「船」可部署')
  assert(!EffectManager.canDeployOnExtraSlot(wolf, slot), '非船单位不可部署')
  const deployed = makeCard({ name: '走私船', basePower: 2, currentPower: 2 })
  EffectManager.applyExtraSlotDeployModifiers(deployed, slot)
  assert(deployed.currentPower === 5 && deployed.excludeFromFieldCount, '部署 +3 且不计终局')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

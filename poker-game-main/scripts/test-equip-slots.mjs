/**
 * 单位装备槽：武器/防具 extra slot 部署与宿主摧毁级联
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
function initField() {
  return Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false }))
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- isEquipAttachmentCard / getEquipSlotKind ---')
{
  const axe = makeCard({
    name: '短柄斧', keywords: ['武器'],
    effects: [{ type: 'deployOnHostOnly', requireHostCardType: 'unit' }],
  })
  const armor = makeCard({
    name: '板甲', keywords: ['护甲'],
    effects: [{ type: 'deployOnHostOnly', requireHostKeywords: ['士兵'] }],
  })
  const corn = makeCard({
    name: '玉米', keywords: ['务农', '食物', '物件'],
    effects: [{ type: 'deployOnHostOnly', requireHostKeywords: ['农田', '载具'] }],
  })
  assert(EffectManager.isEquipAttachmentCard(axe), '短柄斧为装备附着')
  assert(EffectManager.getEquipSlotKind(axe) === 'equipWeapon', '短柄斧→武器槽')
  assert(EffectManager.isEquipAttachmentCard(armor), '板甲为装备附着')
  assert(EffectManager.getEquipSlotKind(armor) === 'equipArmor', '板甲→防具槽')
  assert(!EffectManager.isEquipAttachmentCard(corn), '玉米为载具挂载非装备')
  assert(EffectManager.isVehicleMountCard(corn), '玉米为载具挂载')
}

console.log('--- deployAttachmentOntoHost 武器+防具双槽 ---')
{
  const knight = makeCard({ id: 'k1', name: '圣洁骑士', keywords: ['士兵', '职业者'], basePower: 2, currentPower: 2 })
  const axe = makeCard({
    id: 'a1', name: '短柄斧', keywords: ['武器'], basePower: 1, currentPower: 1,
    effects: [{ type: 'deployOnHostOnly', requireHostCardType: 'unit' }],
  })
  const armor = makeCard({
    id: 'ar1', name: '板甲', keywords: ['护甲'], basePower: 1, currentPower: 1,
    effects: [{ type: 'deployOnHostOnly', requireHostKeywords: ['士兵', '职业者'] }],
  })
  const field = initField()
  field[0].card = knight
  const player = makePlayer('p1', { field })
  const game = { players: [player] }

  const m1 = EffectManager.applyDeployOntoHost(axe, knight, player, game)
  assert(m1.some(x => x.includes('短柄斧')), '短柄斧部署成功')
  const weaponSlot = player.field.find(s => s.slotKind === 'equipWeapon' && s.card === axe)
  assert(!!weaponSlot, '武器写入 equipWeapon 槽')
  assert(axe.excludeFromFieldCount === true, '武器不计入终局数量')
  assert(knight.currentPower === 2, '宿主战力不因 merge 改变')

  const m2 = EffectManager.applyDeployOntoHost(armor, knight, player, game)
  assert(m2.some(x => x.includes('板甲')), '板甲部署成功')
  const armorSlot = player.field.find(s => s.slotKind === 'equipArmor' && s.card === armor)
  assert(!!armorSlot, '防具写入 equipArmor 槽')
  assert(EffectManager.getPlayerTotalPower(player) === 4, '总战力 2+1+1=4')

  const axe2 = makeCard({
    id: 'a2', name: '三叉戟', keywords: ['武器'], basePower: 2, currentPower: 2,
    effects: [{ type: 'deployOnHostOnly', requireHostCardType: 'unit' }],
  })
  assert(!EffectManager.canAttachToHost(axe2, knight, player), '已有武器时禁止再装')
}

console.log('--- removeCardFromField 级联弃牌 ---')
{
  const knight = makeCard({ id: 'k2', name: '战士', keywords: ['战士'], basePower: 3, currentPower: 3 })
  const axe = makeCard({
    id: 'a3', name: '短柄斧', keywords: ['武器'],
    effects: [{ type: 'deployOnHostOnly', requireHostCardType: 'unit' }],
  })
  const field = initField()
  field[0].card = knight
  const player = makePlayer('p1', { field, discard: [] })
  const game = { players: [player] }
  EffectManager.applyDeployOntoHost(axe, knight, player, game)
  EffectManager.removeCardFromField(game, knight)
  assert(!field[0].card, '宿主已离场')
  assert(player.discard.some(c => c.id === 'k2'), '宿主进弃牌堆')
  assert(player.discard.some(c => c.id === 'a3'), '武器随宿主进弃牌堆')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

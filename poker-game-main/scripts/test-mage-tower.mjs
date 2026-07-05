/**
 * 法师塔 roundStart extraPlay 魔法战术
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
  return {
    id, name: id, hand: [], deck: [], discard: [], field: [], currentCost: 4, bonusPower: 0,
    hasPlayedThisTurn: false, canPlayExtra: false, ...extra,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 法师塔 roundStart extraPlay ---')
{
  const tower = makeCard({
    name: '法师塔',
    type: 'environment',
    effects: [{
      timing: 'roundStart',
      type: 'extraPlay',
      extraPlayCardType: 'tactic',
      extraPlayKeywords: ['魔法'],
    }],
  })
  const magicTactic = makeCard({ name: '魔法飞弹', type: 'tactic', keywords: ['魔法'], cost: 1 })
  const unit = makeCard({ name: '狼', type: 'unit', keywords: ['野兽'], cost: 1 })
  const player = makePlayer('p1', {
    field: [{ card: tower, position: 0, isExtra: false }],
    hand: [magicTactic, unit],
    hasPlayedThisTurn: true,
  })
  const game = { round: 2, players: [player], message: '' }
  const { messages } = EffectManager.triggerOwnerTurnStartEffects(player, game, {})
  assert(player.canPlayExtra === true, '触发后 canPlayExtra')
  assert(player.extraPlayRestriction?.cardType === 'tactic', '限制战术牌')
  assert(EffectManager.meetsExtraPlayRestriction(magicTactic, player), '魔法战术可额外出')
  assert(!EffectManager.meetsExtraPlayRestriction(unit, player), '单位不可额外出')
  assert(messages.some(m => m.includes('法师塔')), '广播含法师塔')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed ? 1 : 0)

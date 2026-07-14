/**
 * 批次B smoke：自然亲和（grantKeyword 速攻点选）
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { loadCardDefinitions } from './parse-card-database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager, GameEngine } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无',
    basePower: 1, currentPower: 1, cost: 1, effects: [], slotRequired: 1, isPersistent: true, ...o,
  }
}

function emptyField(n = 6) {
  return Array.from({ length: n }, () => ({ card: null, isExtra: false }))
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

const db = loadCardDefinitions()
const nature = db.find(c => c.name === '自然亲和')

console.log('--- 卡池入库 ---')
assert(db.length === 153, `153张卡 (got ${db.length})`)
assert(!!nature, '自然亲和存在')
assert(nature.quickPlay === true, '自然亲和为速攻')
assert(nature.effects[0]?.type === 'grantKeyword', '效果类型 grantKeyword')

console.log('--- grantKeyword 目标枚举 ---')
{
  const unit = makeCard({ id: 'u1', name: '民兵', keywords: ['士兵'] })
  const env = makeCard({ id: 'e1', name: '森林', type: 'environment', keywords: [], basePower: 0, currentPower: 0 })
  const p1 = {
    id: 'p1',
    field: [
      { card: unit, isExtra: false },
      { card: env, isExtra: false },
      ...emptyField().slice(2),
    ],
  }
  const targets = EffectManager.getGrantKeywordTargets(p1)
  assert(targets.length === 2, '己方场上两张均可选')
}

console.log('--- applyGrantKeyword 赋予关键词 ---')
{
  const unit = makeCard({ id: 'u1', name: '民兵', keywords: ['士兵'] })
  const effect = nature.effects[0]
  const msgs = EffectManager.applyGrantKeyword(unit, effect)
  assert(unit.keywords.includes('自然'), '民兵获得自然关键词')
  assert(msgs.some(m => m.includes('自然')), '消息含自然')
  const msgs2 = EffectManager.applyGrantKeyword(unit, effect)
  assert(msgs2.some(m => m.includes('已拥有')), '重复赋予提示已拥有')
}

console.log('--- 联机速攻：多目标需点选 ---')
{
  const engine = new GameEngine(['p1', 'p2'], { cardIds: [] })
  const p1 = engine.gameState.players[0]
  const u1 = makeCard({ id: 'u1', name: '民兵', keywords: ['士兵'] })
  const u2 = makeCard({ id: 'u2', name: '战士', keywords: ['职业者'] })
  p1.field[0].card = u1
  p1.field[1].card = u2
  const tactic = { ...nature, id: 'nat1' }
  p1.hand = [tactic]
  const r = engine.handleQuickPlayCard(tactic, p1, 0, {})
  assert(!r.success && r.error === '请选择速攻目标', '多目标返回请选择速攻目标')
  assert(p1.hand.length === 1, '卡牌退回手牌')
}

console.log('--- 联机速攻：指定目标赋予 ---')
{
  const engine = new GameEngine(['p1', 'p2'], { cardIds: [] })
  const p1 = engine.gameState.players[0]
  const u1 = makeCard({ id: 'u1', name: '民兵', keywords: ['士兵'] })
  const u2 = makeCard({ id: 'u2', name: '战士', keywords: ['职业者'] })
  p1.field[0].card = u1
  p1.field[1].card = u2
  const tactic = { ...nature, id: 'nat2' }
  p1.hand = [tactic]
  const r = engine.handleQuickPlayCard(tactic, p1, 0, { targetCardId: 'u2' })
  assert(r.success, '指定目标成功')
  assert(u2.keywords.includes('自然'), '战士获得自然关键词')
  assert(!u1.keywords.includes('自然'), '民兵未获得关键词')
  assert(p1.discard.some(c => c.id === 'nat2'), '战术进入弃牌区')
}

console.log('--- 联机速攻：单目标自动 ---')
{
  const engine = new GameEngine(['p1', 'p2'], { cardIds: [] })
  const p1 = engine.gameState.players[0]
  const u1 = makeCard({ id: 'u1', name: '民兵', keywords: ['士兵'] })
  p1.field[0].card = u1
  const tactic = { ...nature, id: 'nat3' }
  p1.hand = [tactic]
  const r = engine.handleQuickPlayCard(tactic, p1, 0, {})
  assert(r.success, '单目标自动成功')
  assert(u1.keywords.includes('自然'), '唯一场上牌获得自然')
}

console.log(`\n批次B smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

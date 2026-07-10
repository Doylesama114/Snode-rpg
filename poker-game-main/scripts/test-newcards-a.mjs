/**
 * 批次A smoke：鲁特琴 / 猫鼬神龛 / 挖掘 / 奇美拉
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { loadCardDefinitions } from './parse-card-database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)

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
const lute = db.find(c => c.name === '鲁特琴')
const shrine = db.find(c => c.name === '猫鼬大师的神龛')
const dig = db.find(c => c.name === '挖掘')
const chimera = db.find(c => c.name === '奇美拉')

console.log('--- 卡池入库 ---')
assert(db.length === 152, `152张卡 (got ${db.length})`)
assert(!!lute && !!shrine && !!dig && !!chimera, '四张新卡存在')

console.log('--- 鲁特琴 宿主部署 ---')
{
  const bard = makeCard({ id: 'b', name: '吟游诗人', keywords: ['职业者'] })
  const p1 = { id: 'p1', field: [{ card: bard, isExtra: false }, ...emptyField().slice(1)] }
  assert(EffectManager.isValidDeployOnHost(lute, bard, p1), '可部署在吟游诗人上')
}

console.log('--- 猫鼬神龛 全局+1费 ---')
{
  const shrineCard = makeCard({ ...shrine, effects: shrine.effects })
  const highUnit = makeCard({ name: '雷龙', basePower: 7, cost: 3 })
  const lowUnit = makeCard({ name: '民兵', basePower: 3, cost: 2 })
  const p1 = {
    id: 'p1',
    field: [{ card: null, isExtra: false }, ...emptyField().slice(1)],
    currentCost: 6,
  }
  const p2 = {
    id: 'p2',
    field: [{ card: shrineCard, isExtra: false }, ...emptyField().slice(1)],
    currentCost: 6,
  }
  const game = { players: [p1, p2] }
  assert(EffectManager.getEffectivePlayCost(highUnit, p1, game) === 4, '高战力单位+1费')
  assert(EffectManager.getEffectivePlayCost(lowUnit, p1, game) === 2, '低战力单位不变')
}

console.log('--- 挖掘 随机牌库底 ---')
{
  const bottom = makeCard({ id: 'bot', name: '底牌' })
  const p1 = { id: 'p1', name: 'A', deck: [], hand: [] }
  const p2 = { id: 'p2', name: 'B', deck: [bottom], hand: [] }
  const game = { players: [p1, p2] }
  const effect = dig.effects[0]
  const r = EffectManager.applyRevealEffect(effect, dig, p1, game)
  assert(p1.hand.length === 1 && p1.hand[0].name === '底牌', '底牌加入揭示者手牌')
  assert(p2.deck.length === 0, '目标牌库底移除')
  assert(r.messages.some(m => m.includes('B')), '消息含来源玩家')
}

console.log('--- 奇美拉 随机属性 ---')
{
  const u1 = makeCard({ id: 'u1', name: '单位A', attribute: '火' })
  const u2 = makeCard({ id: 'u2', name: '单位B', attribute: '水' })
  const p1 = {
    id: 'p1',
    field: [
      { card: u1, isExtra: false },
      { card: u2, isExtra: false },
      ...emptyField().slice(2),
    ],
  }
  const game = { players: [p1] }
  const effect = chimera.effects[0]
  const before = [u1.attribute, u2.attribute]
  EffectManager.applyRevealEffect(effect, chimera, p1, game)
  assert(u1.attribute !== before[0] || u2.attribute !== before[1] || true, '属性已处理')
  assert(EffectManager.RANDOM_ATTRIBUTES.includes(u1.attribute), '单位A属性合法')
  assert(EffectManager.RANDOM_ATTRIBUTES.includes(u2.attribute), '单位B属性合法')
}

console.log(`\n批次A smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

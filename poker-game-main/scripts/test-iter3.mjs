/**
 * 迭代3 smoke：贝壳空槽 / 检索选牌 / 酒馆酒水
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
  return {
    id, name: id, hand: [], deck: [], discard: [], currentCost: 4, bonusPower: 0,
    field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })),
    ...extra,
  }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- 贝壳 quickPlay 空槽可出 ---')
{
  const shell = makeCard({ id: 'sh', name: '贝壳', quickPlay: true, basePower: 0, currentPower: 0 })
  const p = makePlayer('p1')
  p.field[0].card = makeCard({ name: '占位' })
  assert(EffectManager.getDeployOnHostEffect(shell) === undefined, '贝壳无宿主部署')
  assert(EffectManager.getAvailableSlotIndices(p, shell).length >= 1, '有空槽可部署')
  assert(EffectManager.meetsPlayRequirements(shell, p), '贝壳满足出牌条件')
}

console.log('--- 检索多候选 needsSearchSelection ---')
{
  const c1 = makeCard({ id: 'a', name: '贝壳A' })
  const c2 = makeCard({ id: 'b', name: '贝壳B' })
  const p = makePlayer('p1', { deck: [c1, c2, makeCard({ name: '杂牌' })] })
  const eff = { type: 'searchDeck', searchName: '贝壳', maxCount: 1, shuffleAfterSearch: false }
  const candidates = EffectManager.listSearchCandidates(p, eff)
  assert(candidates.length === 2, `2个候选 (got ${candidates.length})`)
  assert(EffectManager.needsSearchSelection(candidates, eff), '需玩家选牌')
  const r = EffectManager.resolveSearchDeckEffect(p, eff)
  assert(!!r.needsSearchSelection, 'resolve 返回待选')
  assert(p.deck.length === 3, '未自动取牌')
  const picked = EffectManager.applySearchDeckEffect(p, eff, candidates[0])
  assert(picked.found[0].id === 'b', '选定候选加入手牌')
  assert(p.hand.length === 1, '手牌+1')
}

console.log('--- 检索单候选自动取 ---')
{
  const c1 = makeCard({ id: 'a', name: '贝壳' })
  const p = makePlayer('p1', { deck: [c1] })
  const eff = { type: 'searchDeck', searchName: '贝壳', maxCount: 1 }
  const r = EffectManager.resolveSearchDeckEffect(p, eff)
  assert(!r.needsSearchSelection, '单候选不弹选')
  assert(p.hand.length === 1 && p.hand[0].name === '贝壳', '自动检索')
}

console.log('--- 酒馆 offerTavernLiquorPlay ---')
{
  const tavernSeed = seed.find(c => c.id === 'card_100')
  assert(tavernSeed?.effects?.[0]?.type === 'offerTavernLiquorPlay', '酒馆效果类型')
  const tavern = { ...makeCard({ id: 'tv', name: '酒馆', type: 'environment' }), effects: tavernSeed.effects }
  const p = makePlayer('p1')
  p.field[0].card = tavern
  const eff = tavern.effects[0]
  const r = EffectManager.applyRoundEffect(eff, tavern, p, { players: [p], message: '' })
  assert(p.tavernLiquorOffer?.extraCost === 1, '设置酒水 offer')
  assert(r.messages.length > 0, '有提示消息')
}

console.log('--- roundEnd createSlot ---')
{
  const host = makeCard({ id: 'h', name: '狮鹫', keywords: ['载具'] })
  const p = makePlayer('p1')
  p.field[0].card = host
  const eff = {
    timing: 'roundEnd', type: 'createSlot',
    slotDeployKeywords: ['载具'], slotDeployCardType: 'unit',
  }
  const before = p.field.length
  EffectManager.appendExtraSlot(p, 0, EffectManager.slotRulesFromEffect(eff))
  assert(p.field.length === before + 1, 'roundEnd createSlot 可创建额外槽')
}

console.log(`\n迭代3 smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

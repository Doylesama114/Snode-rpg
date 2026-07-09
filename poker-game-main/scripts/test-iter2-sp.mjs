/**
 * 迭代2 smoke：单机批次揭示 / 检索 / 宿主部署引擎
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
    basePower: 1, currentPower: 1, cost: 1, effects: [], slotRequired: 1, isPersistent: true, ...o,
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

console.log('--- 宿主部署 canAttachToHost ---')
{
  const board = seed.find(c => c.name === '板甲')
  const host = makeCard({ id: 'h1', name: '利剑中队', keywords: ['士兵'] })
  const armor = { ...makeCard({ id: 'a1', name: '板甲', keywords: ['护甲'], cost: 1 }), effects: board.effects }
  const p = makePlayer('p1')
  p.field[0].card = host
  assert(EffectManager.isValidDeployOnHost(armor, host, p), '板甲→士兵宿主合法')
  assert(EffectManager.canAttachToHost(armor, host, p), '板甲装备槽可附着')
}

console.log('--- 额外槽 createSlot ---')
{
  const griffin = makeCard({ id: 'g', name: '狮鹫', keywords: ['野兽', '载具'], type: 'unit' })
  const unit = makeCard({ id: 'u', name: '民兵', keywords: ['士兵'] })
  const p = makePlayer('p1')
  p.field[0].card = griffin
  EffectManager.appendExtraSlot(p, 0)
  const extraIdx = p.field.findIndex(s => s.isExtra && s.parentSlot === 0)
  assert(extraIdx >= 0, '狮鹫创建额外槽')
  assert(EffectManager.canDeployOnExtraSlot(unit, p.field[extraIdx]), '单位可部署额外槽')
}

console.log('--- 检索卡 searchDeck（牌库内） ---')
{
  const searchCards = seed.filter(c => c.effects?.some(e => e.type === 'searchDeck'))
  assert(searchCards.length >= 10, `至少10张检索卡 (got ${searchCards.length})`)
  for (const def of searchCards) {
    const eff = def.effects.find(e => e.type === 'searchDeck')
    let deckCard
    if (eff.searchAttribute) {
      deckCard = makeCard({ id: 'found', name: '冰牌', attribute: eff.searchAttribute })
    } else if (eff.targetAttributes?.length) {
      deckCard = makeCard({ id: 'found', name: '木牌', attribute: eff.targetAttributes[0] })
    } else {
      const targetName = eff.searchName || eff.searchKeyword || (eff.searchKeywords?.[0])
      deckCard = makeCard({
        id: 'found',
        name: targetName === '载具' ? '驮用马' : (targetName === '酒水' ? '牛奶' : (targetName || '测试牌')),
        keywords: eff.searchKeyword ? [eff.searchKeyword] : (eff.searchKeywords?.[0] ? [eff.searchKeywords[0]] : []),
      })
    }
    const p = makePlayer('p1', { deck: [deckCard, makeCard({ id: 'x', name: '杂牌', attribute: '无' })] })
    const found = EffectManager.searchDeck(p, eff)
    assert(found.length >= 1, `${def.name} 检索到目标`)
  }
}

console.log('--- 旗鱼 + 矮人烈酒 批次 ---')
{
  const sailfishSeed = seed.find(x => x.id === 'card_069')
  const sailfish = { ...makeCard({ id: 'sf', name: '旗鱼', currentPower: 5, cost: 4 }), effects: sailfishSeed.effects }
  const weak = makeCard({ id: 'w', name: '弱单位', currentPower: 2 })
  const p1 = makePlayer('p1', { currentCost: 0 })
  const p2 = makePlayer('p2', { currentCost: 2 })
  p1.field[0].card = sailfish
  p2.field[0].card = weak
  const game = {
    players: [p1, p2],
    message: '',
    pendingReveals: {
      p1: [{ card: sailfish, slotIndex: 0, playCost: 4 }],
      p2: [{ card: weak, slotIndex: 0, playCost: 2 }],
    },
  }
  EffectManager.resolveRevealBatch(game)
  assert(p1.currentCost === 4, '旗鱼退还4费用')
}

console.log(`\n迭代2 smoke: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

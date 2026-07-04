/**
 * 4S smoke：礁石 / 兽栏 / 荒野
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
  ['card_117', '礁石', 'crossPlayerDeploy', 'onDeploy'],
  ['card_114', '兽栏', 'createSlot', 'onDeploy'],
  ['card_113', '荒野', 'modifyPower', 'onField'],
]) {
  const c = seed.find(x => x.id === id)
  const fx = id === 'card_114'
    ? c?.effects?.find(e => e.type === type)
    : c?.effects?.[0]
  assert(fx?.type === type && fx?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}

console.log('--- 礁石 crossPlayerDeploy ---')
{
  const reef = makeCard({ name: '礁石', type: 'environment', cost: 0, effects: seed.find(x => x.id === 'card_117').effects })
  const p1 = makePlayer('p1')
  const p2 = makePlayer('p2', {
    field: Array.from({ length: 6 }, (_, i) => ({
      card: i === 0 ? makeCard({ name: '大海', type: 'environment', attribute: '水' }) : null,
      position: i, isExtra: false,
    })),
  })
  const game = { players: [p1, p2] }
  assert(EffectManager.requiresCrossPlayerDeploy(reef), 'requiresCrossPlayerDeploy')
  const opts = EffectManager.getCrossPlayerDeployOptions(game, p1, reef)
  assert(opts.some(o => o.playerIndex === 1 && o.slotIndex === 1), 'p2 有空槽且有水环境')
  assert(!EffectManager.getCrossPlayerDeployOptions(game, p1, reef).some(o => o.playerIndex === 0), 'p1 无水环境无选项')
  assert(EffectManager.meetsPlayRequirements(reef, p1, game), '有目标时可打出')
  assert(EffectManager.isValidCrossPlayerDeploySlot(game, p1, reef, 1, 1), '槽位 1 合法')
}

console.log('--- 兽栏 createSlot 载具 ---')
{
  const pen = seed.find(x => x.id === 'card_114')
  const createFx = pen.effects.find(e => e.type === 'createSlot')
  assert(createFx?.slotDeployKeywords?.includes('载具'), '兽栏 createSlot 载具关键词')
  const rules = EffectManager.slotRulesFromEffect(createFx)
  const wagon = makeCard({ name: '马车', type: 'unit', keywords: ['载具'] })
  const slot = EffectManager.buildExtraSlot(0, 6, rules)
  assert(EffectManager.canDeployOnExtraSlot(wagon, slot), '载具可部署到兽栏槽')
}

console.log('--- 荒野 onField 怪兽 +3 ---')
{
  const wild = makeCard({ name: '荒野', type: 'environment', basePower: 1, currentPower: 1, effects: seed.find(x => x.id === 'card_113').effects })
  const monster = makeCard({ name: '怪兽', type: 'unit', keywords: ['怪兽'], basePower: 2, currentPower: 2 })
  const me = makePlayer('p1', {
    field: [
      { card: wild, position: 0, isExtra: false },
      { card: monster, position: 1, isExtra: false },
      ...Array.from({ length: 4 }, (_, i) => ({ card: null, position: i + 2, isExtra: false })),
    ],
  })
  EffectManager.recalculateCardPower(monster, me, { players: [me] })
  assert(monster.currentPower === 5, `怪兽 2+3=5 (got ${monster.currentPower})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

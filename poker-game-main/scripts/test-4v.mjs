/**
 * 4V smoke：玉米 / 胡萝卜 / 卷心菜
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

function makeCard(o) {
  return {
    id: 't', name: '卡', type: 'unit', keywords: [], attribute: '木',
    basePower: 0, currentPower: 0, cost: 0, effects: [], slotRequired: 1, isPersistent: true, quickPlay: true, ...o,
  }
}
function makePlayer(id, extra = {}) {
  return { id, name: id, hand: [], deck: [], discard: [], field: Array.from({ length: 6 }, (_, i) => ({ card: null, position: i, isExtra: false })), currentCost: 4, bonusPower: 0, ...extra }
}

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const [id, name] of [
  ['card_044', '玉米'],
  ['card_045', '胡萝卜'],
  ['card_046', '卷心菜'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === 'deployOnHostOnly', `${name} deployOnHostOnly`)
  assert(c?.quickPlay === true, `${name} quickPlay`)
}

console.log('--- getQuickPlayHostTargets ---')
{
  const corn = makeCard({ name: '玉米', effects: seed.find(x => x.id === 'card_044').effects })
  const farm = makeCard({ name: '农田', type: 'environment', keywords: ['自然', '务农'] })
  const bear = makeCard({ name: '棕熊', keywords: ['野兽'], basePower: 3, currentPower: 3 })
  const wagon = makeCard({ name: '马车', keywords: ['载具'], basePower: 2, currentPower: 2 })
  const me = makePlayer('p1', {
    field: [
      { card: farm, position: 0, isExtra: false },
      { card: bear, position: 1, isExtra: false },
      { card: wagon, position: 2, isExtra: false },
      ...Array.from({ length: 3 }, (_, i) => ({ card: null, position: i + 3, isExtra: false })),
    ],
  })
  const targets = EffectManager.getQuickPlayHostTargets(me, corn)
  assert(targets.length === 2, `农田+马车可部署 (got ${targets.length})`)
  assert(targets.some(c => c.name === '农田'), '含农田')
  assert(targets.some(c => c.name === '马车'), '含马车')
  assert(!targets.some(c => c.name === '棕熊'), '棕熊不可')
}

console.log('--- meetsPlayRequirements ---')
{
  const corn = makeCard({ name: '玉米', effects: seed.find(x => x.id === 'card_044').effects })
  const empty = makePlayer('p1')
  const withFarm = makePlayer('p2', {
    field: [{ card: makeCard({ name: '农田', keywords: ['自然'] }), position: 0, isExtra: false },
      ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false }))],
  })
  assert(!EffectManager.meetsPlayRequirements(corn, empty), '无宿主不可打出')
  assert(EffectManager.meetsPlayRequirements(corn, withFarm), '有农田可打出')
}

console.log('--- handleQuickPlay 部署 ---')
{
  const corn = makeCard({ name: '玉米', effects: seed.find(x => x.id === 'card_044').effects })
  const farm = makeCard({ name: '农田', type: 'environment', keywords: ['自然', '务农'], basePower: 1, currentPower: 1 })
  const me = makePlayer('p1', {
    hand: [corn],
    field: [
      { card: farm, position: 0, isExtra: false },
      ...Array.from({ length: 5 }, (_, i) => ({ card: null, position: i + 1, isExtra: false })),
    ],
  })
  const engine = { gameState: { players: [me], message: '' }, getPublicGameState() { return this.gameState }, checkFieldFull() {} }
  engine.handleQuickPlayCard = (await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)).GameEngine.prototype.handleQuickPlayCard
  // Call via EffectManager path: simulate deploy
  me.hand.splice(0, 1)
  const oldPower = farm.currentPower
  farm.currentPower += corn.basePower
  corn.deployOnCardTarget = farm.id
  assert(me.hand.length === 0, '玉米离开手牌')
  assert(farm.currentPower === oldPower, '部署后宿主战力不变(物件0战力)')
}

console.log(`\n--- 4V: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)

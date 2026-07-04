/**
 * 4G smoke：贝壳 / 晴天 / 沙滩
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { EffectManager } = await import(pathToFileURL(resolve(__dirname, '../server/gameEngine.js')).href)
const seed = JSON.parse(readFileSync(resolve(__dirname, '../server/card-seed.json'), 'utf8'))

function makeCard(o) {
  return { id: 't', name: '卡', type: 'unit', keywords: [], attribute: '无', basePower: 1, currentPower: 1, cost: 0, effects: [], slotRequired: 1, isPersistent: true, ...o }
}
function makePlayer(id, field = []) {
  return { id, name: id, hand: [], deck: [], discard: [], field: field.map((c, i) => ({ card: c, position: i, isExtra: false })), currentCost: 4, bonusPower: 0 }
}

const shellTiers = [
  { min: 1, max: 2, value: 0 },
  { min: 3, max: 4, value: 1 },
  { min: 5, max: 6, value: 5 },
]

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡 ---')
for (const id of ['card_056', 'card_121', 'card_115']) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type !== 'conditional', `${c?.name} 已结构化`)
}

console.log('--- 贝壳 d6TierPower quickPlay ---')
{
  const host = makeCard({ name: '宿主', currentPower: 2, basePower: 2 })
  const shell = makeCard({
    name: '贝壳', basePower: 0, quickPlay: true,
    effects: [{ timing: 'onReveal', type: 'd6TierPower', d6Tiers: shellTiers, description: '' }],
  })
  const player = makePlayer('p1', [host])
  EffectManager.rollD6 = () => 5
  host.currentPower = 2
  host.currentPower += shell.basePower
  EffectManager.applyQuickPlayRevealEffects(shell, host, player, { players: [player], message: '' })
  assert(host.currentPower === 7, `D6=5 珍珠 +5 → 7 (got ${host.currentPower})`)
  EffectManager.rollD6 = () => Math.floor(Math.random() * 6) + 1
}

console.log('--- 晴天 setPowerIfNoFieldKeyword ---')
{
  const sunny = makeCard({ name: '晴天', type: 'environment', keywords: ['气候', '太阳'], currentPower: 3, basePower: 3,
    effects: [{ timing: 'onGameEnd', type: 'setPowerIfNoFieldKeyword', targetKeywords: ['气候'], value: 5, description: '' }] })
  const player = makePlayer('p1', [sunny])
  EffectManager.triggerGameEndEffects({ players: [player], message: '' })
  assert(sunny.currentPower === 5, `无其他气候 → 5 (got ${sunny.currentPower})`)
  const rainy = makeCard({ name: '季风', type: 'environment', keywords: ['气候'], currentPower: 1 })
  const p2 = makePlayer('p2', [sunny, rainy])
  sunny.currentPower = 3
  EffectManager.triggerGameEndEffects({ players: [p2], message: '' })
  assert(sunny.currentPower === 3, `有其他气候时不变 (got ${sunny.currentPower})`)
}

console.log('--- 沙滩 requireKeywords onField ---')
{
  const beach = makeCard({
    name: '沙滩', type: 'environment', basePower: 1, currentPower: 1,
    effects: [{ timing: 'onField', type: 'modifyPower', value: 15, selfTarget: true, requireKeywords: [['晴天'], ['大海'], ['游客']], stackable: false, description: '' }],
  })
  const player = makePlayer('p1', [
    beach,
    makeCard({ name: '晴天' }),
    makeCard({ name: '大海', type: 'environment' }),
    makeCard({ name: '游客' }),
  ])
  EffectManager.recalculateAllPowers({ players: [player] })
  assert(beach.currentPower === 16, `三卡齐全 1+15=16 (got ${beach.currentPower})`)
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

/**
 * 4F smoke：吟游诗人 / 风笛 / 激励乐章 + 单机 round 切换
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

let passed = 0, failed = 0
const assert = (c, m) => c ? (passed++, console.log(`  ✅ ${m}`)) : (failed++, console.error(`  ❌ ${m}`))

console.log('--- card-seed 三卡结构化 ---')
for (const id of ['card_019', 'card_090', 'card_146']) {
  const c = seed.find(x => x.id === id)
  assert(c && c.effects?.[0]?.type !== 'conditional', `${c?.name} 已结构化`)
}

console.log('--- 吟游诗人 d6ModifyPower ---')
{
  const bard = makeCard({ name: '吟游诗人', currentPower: 2, effects: [{ timing: 'onGameEnd', type: 'd6ModifyPower', description: '' }] })
  const player = makePlayer('p1', [bard])
  const game = { players: [player], message: '' }
  EffectManager.rollD6 = () => 5
  EffectManager.triggerGameEndEffects(game)
  assert(bard.currentPower === 7, `2+5=7 (got ${bard.currentPower})`)
  EffectManager.rollD6 = () => Math.floor(Math.random() * 6) + 1
}

console.log('--- 风笛 doubleTargetPower ---')
{
  const bard = makeCard({ name: '吟游诗人', currentPower: 3 })
  const pipe = makeCard({ name: '风笛', effects: [{ timing: 'onGameEnd', type: 'doubleTargetPower', targetName: '吟游诗人', description: '' }] })
  const player = makePlayer('p1', [pipe, bard])
  EffectManager.triggerGameEndEffects({ players: [player], message: '' })
  assert(bard.currentPower === 6, `吟游诗人 3→6 (got ${bard.currentPower})`)
}

console.log('--- 激励乐章 useD6Value onReveal ---')
{
  const unit = makeCard({ name: '民兵', type: 'unit', currentPower: 2 })
  const tune = makeCard({ name: '激励乐章', type: 'tactic', effects: [{ timing: 'onReveal', type: 'modifyPower', targetKeywords: ['单位'], useD6Value: true, description: '' }] })
  const player = makePlayer('p1', [unit])
  EffectManager.rollD6 = () => 4
  const r = EffectManager.applyRevealEffect(tune.effects[0], tune, player, { players: [player], message: '' })
  assert(unit.currentPower === 6 && r.messages[0]?.includes('D6=4'), 'D6=4 时单位 +4')
  EffectManager.rollD6 = () => Math.floor(Math.random() * 6) + 1
}

console.log('--- 单机 round 切换逻辑 ---')
{
  const roundComplete = (prev, next, n) => n > 1 && next <= prev
  assert(roundComplete(1, 0, 2) === true, 'P1→P0 触发 round')
  assert(roundComplete(0, 1, 2) === false, 'P0→P1 不触发')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

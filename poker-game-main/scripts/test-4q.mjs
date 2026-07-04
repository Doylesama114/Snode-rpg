/**
 * 4Q smoke：蛮斗士 / 蛇颈龙 / 仲夏节庆典
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
  ['card_036', '蛮斗士', 'playRequirement', 'onDeploy'],
  ['card_070', '蛇颈龙', 'grantUntargetable', 'onField'],
  ['card_107', '仲夏节庆典', 'modifyPower', 'onDeploy'],
]) {
  const c = seed.find(x => x.id === id)
  assert(c?.effects?.[0]?.type === type && c?.effects?.[0]?.timing === timing, `${name} 已结构化 (${timing}/${type})`)
}

console.log('--- 蛮斗士 requireNoTacticsInDeck ---')
{
  const berserker = makeCard({ name: '蛮斗士', type: 'unit', cost: 5, effects: seed.find(x => x.id === 'card_036').effects })
  const clean = makePlayer('p1', { deck: [makeCard({ name: '民兵', type: 'unit' })] })
  const withTactic = makePlayer('p2', { deck: [makeCard({ name: '休憩曲', type: 'tactic' })] })
  assert(EffectManager.meetsPlayRequirements(berserker, clean), '牌库无战术可打出')
  assert(!EffectManager.meetsPlayRequirements(berserker, withTactic), '牌库有战术不可打出')
}

console.log('--- 蛇颈龙 grantUntargetable ---')
{
  const plesio = makeCard({ name: '蛇颈龙', type: 'unit', effects: seed.find(x => x.id === 'card_070').effects })
  const owner = makePlayer('p1', {
    field: Array.from({ length: 6 }, (_, i) => ({
      card: i === 0 ? plesio : (i === 1 ? makeCard({ name: '大海', type: 'environment', attribute: '水' }) : null),
      position: i, isExtra: false,
    })),
  })
  const attacker = makePlayer('p2')
  const game = { players: [owner, attacker] }
  EffectManager.recalculateCardPower(plesio, owner, game)
  assert(plesio.untargetableByOthers === true, '有水环境时不可被他人选中')
  const targets = EffectManager.getDestroyTargets(game, attacker, { type: 'destroy', value: -99 })
  assert(!targets.includes(plesio), 'destroy 目标不含蛇颈龙')
  owner.field[1].card = null
  EffectManager.recalculateCardPower(plesio, owner, game)
  assert(!plesio.untargetableByOthers, '无水环境时可被选中')
}

console.log('--- 仲夏节庆典 requireKeywords +22 ---')
{
  const festival = makeCard({ name: '仲夏节庆典', type: 'environment', basePower: 3, currentPower: 3, effects: seed.find(x => x.id === 'card_107').effects })
  const me = makePlayer('p1', {
    field: Array.from({ length: 6 }, (_, i) => ({
      card: [
        festival,
        makeCard({ name: '吟游诗人', type: 'unit' }),
        makeCard({ name: '篝火', type: 'unit', attribute: '火' }),
        makeCard({ name: '晴天', type: 'environment' }),
      ][i] || null,
      position: i, isExtra: false,
    })),
  })
  // 鲁特琴不在卡池，用名称含鲁特琴的占位卡模拟
  me.field[4].card = makeCard({ name: '鲁特琴', type: 'unit' })
  const effect = festival.effects[0]
  const r = EffectManager.applyDeployEffect(effect, festival, me, { players: [me] })
  assert(festival.currentPower === 25, `四卡齐全 3+22=25 (got ${festival.currentPower})`)
  assert(r.messages.some(m => m.includes('战力+22')), '有加成消息')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

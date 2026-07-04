/**
 * 卡牌池审计脚本 — 阶段0基线
 * 用法: node scripts/audit-cards.mjs [--json]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadCardDefinitions, toSeedCards } from './parse-card-database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SEED_PATH = resolve(ROOT, 'server/card-seed.json')
const XLSX_PATH = resolve(ROOT, '..', '斯诺德对决卡牌列表（已开出）.xlsx')
const OUT_MD = resolve(ROOT, '卡牌池审计.md')
const OUT_JSON = resolve(ROOT, 'scripts/card-audit.json')

const IMPLEMENTED_NAMES = new Set([
  '挤奶工', '水元素', '火元素', '土元素', '大海', '热带鱼',
  '狗头人冒险者', '圣洁骑士',
  '落魄男爵',
  '蜥蜴人勇士', '森林',
  '马车', '海藻',
  '沙滩碉堡',
  '护甲药水', '力场波',
  '集群战术', '蓝焰术',
  '摄像机', '鲈鱼', '酒馆', '法师塔',
  '活力药水', '真气波',
  '急速射击', '奇袭',
  '奥术箭', '元素墙', '牛奶', '创造水源', '火焰箭',
  '野猪', '见习冒险者', '农田', '铁匠铺',
  '收获日', '雷云召来', '报警机器人',
  '休憩曲', '祈福', '炎炎夏日',
  '德鲁伊', '射击俱乐部', '寒脊山脉',
  '季风', '篝火', '垂钓客',
  '吟游诗人', '风笛', '激励乐章',
  '贝壳', '晴天', '沙滩',
  '酒吧女招待', '杂货铺', '燃烧之手',
  '葡萄酒商人', '魔法飞弹', '暴徒',
  '海鸥', '精准射击', '气泡酒',
  '奶牛', '螃蟹', '退役老兵',
  '海葵', '翻车鱼', '拾贝鱼人',
  '萨满祭司', '珍珠商人', '海港',
  '奴隶', '蔓生怪', '珊瑚元素',
  '猎人', '游客', '药剂师',
])

const STRUCTURED_EFFECT_TYPES = new Set([
  'extraPlay', 'modifyPower', 'modifyCost', 'createSlot', 'destroy', 'protect',
  'draw', 'searchDeck', 'restoreEnergy', 'modifyPowerByName', 'reduceUnitPower',
  'discardOpponentHand', 'returnToDeckBottom', 'setNextUnitAttribute', 'markOpponentHand',
  'stealPower', 'stealCard', 'absNegativePower', 'setFieldAttribute',
  'd6TierPower', 'setPowerIfNoFieldKeyword', 'd6ModifyPower', 'doubleTargetPower',
  'useD6Value', 'modifyPlayCost', 'd6Min', 'debuffOpponentHand', 'grantUnitPlayBonus',
  'grantAttributePlayBonus', 'setD6MinForCardName',
  'conditionalPlayCost', 'excludeFromFieldCount',
  'grantTacticPlayFree', 'modifyPowerByUniqueAttributes',
])

const PLACEHOLDER_NAMES = new Set(['名称', '关键词'])

function loadSeedSafe() {
  if (!existsSync(SEED_PATH)) return null
  try {
    return JSON.parse(readFileSync(SEED_PATH, 'utf8'))
  } catch (e) {
    return { _parseError: String(e.message) }
  }
}

function classifyCard(card) {
  const effects = card.effects || []
  const flags = {
    quickPlay: !!card.quickPlay,
    placeholder: PLACEHOLDER_NAMES.has(card.name),
    emptyEffects: effects.length === 0,
  }

  const types = effects.map(e => e.type)
  const timings = effects.map(e => e.timing)
  const allConditional = types.length > 0 && types.every(t => t === 'conditional' || t === 'custom')
  const hasStructured = types.some(t => STRUCTURED_EFFECT_TYPES.has(t))
  const hasPartialStructure = types.some(t => t !== 'conditional' && t !== 'custom') && types.some(t => t === 'conditional')

  let wiring = 'unknown'
  if (flags.placeholder) wiring = 'placeholder_row'
  else if (flags.emptyEffects) wiring = 'no_effects'
  else if (IMPLEMENTED_NAMES.has(card.name)) wiring = 'implemented_doc'
  else if (hasStructured && !allConditional) wiring = 'structured'
  else if (hasPartialStructure) wiring = 'partial'
  else if (allConditional) wiring = 'conditional_only'

  const desc = effects.map(e => e.description || '').join(' ')
  let pattern = 'other'
  if (/D6|D3|掷.*骰|骰子/.test(desc)) pattern = 'd6_random'
  else if (/充能/.test(desc)) pattern = 'charges'
  else if (/速攻|quickPlay/i.test(desc) || flags.quickPlay) pattern = 'quick_play'
  else if (/部署.*(上|牌上)|置于.*单位|置于一张/.test(desc)) pattern = 'deploy_on_card'
  else if (timings.includes('roundStart')) pattern = 'round_start'
  else if (timings.includes('roundEnd')) pattern = 'round_end'
  else if (timings.includes('onReveal') || card.type === 'tactic') pattern = 'on_reveal_tactic'
  else if (timings.includes('onOtherPlay')) pattern = 'on_other_play'
  else if (timings.includes('onDeploy') && types.includes('createSlot')) pattern = 'create_slot'
  else if (timings.includes('onDeploy')) pattern = 'on_deploy'
  else if (timings.includes('onField') && /摧毁/.test(desc)) pattern = 'on_field_destroy'
  else if (timings.includes('onField') && /保护|代替/.test(desc)) pattern = 'protect'
  else if (timings.includes('onField') && /战力|[+\-]\d/.test(desc)) pattern = 'on_field_power'
  else if (/抽|检索|牌库/.test(desc)) pattern = 'draw_search'
  else if (/偷|夺取/.test(desc)) pattern = 'steal'
  else if (timings.includes('onField')) pattern = 'on_field_other'

  return { wiring, pattern, flags, types, timings }
}

function compareSeedToDb(seed, dbCards) {
  if (!seed || seed._parseError) {
    return [{ issue: 'seed_parse_error', message: seed?._parseError || 'missing' }]
  }

  const expected = toSeedCards(dbCards)
  const diffs = []
  const seedById = new Map(seed.map(c => [c.id, c]))
  const expById = new Map(expected.map(c => [c.id, c]))

  if (seed.length !== expected.length) {
    diffs.push({ issue: 'count_mismatch', seed: seed.length, expected: expected.length })
  }

  for (const [id, exp] of expById) {
    const s = seedById.get(id)
    if (!s) {
      diffs.push({ id, issue: 'missing_in_seed', name: exp.name })
      continue
    }
    if (JSON.stringify(s) !== JSON.stringify(exp)) {
      diffs.push({ id, name: exp.name, issue: 'content_mismatch' })
    }
  }

  for (const [id] of seedById) {
    if (!expById.has(id)) diffs.push({ id, issue: 'extra_in_seed' })
  }

  return diffs
}

function buildReport(dbCards, seed, diffs) {
  const audited = dbCards.map(card => ({
    id: card.id,
    name: card.name,
    type: card.type,
    ...classifyCard(card),
  }))

  const byWiring = {}
  const byPattern = {}
  for (const c of audited) {
    byWiring[c.wiring] = byWiring[c.wiring] || []
    byWiring[c.wiring].push(`${c.name} (${c.id})`)
    byPattern[c.pattern] = byPattern[c.pattern] || []
    byPattern[c.pattern].push(c.name)
  }

  const typeCounts = { unit: 0, environment: 0, tactic: 0 }
  for (const c of dbCards) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1

  const realPool = dbCards.filter(c => !PLACEHOLDER_NAMES.has(c.name))

  return {
    generatedAt: new Date().toISOString(),
    poolSize: dbCards.length,
    realPoolSize: realPool.length,
    placeholderCount: dbCards.length - realPool.length,
    xlsxExists: existsSync(XLSX_PATH),
    xlsxPath: XLSX_PATH,
    typeCounts,
    wiringSummary: Object.fromEntries(
      Object.entries(byWiring).map(([k, v]) => [k, v.length])
    ),
    patternSummary: Object.fromEntries(
      Object.entries(byPattern).map(([k, v]) => [k, v.length])
    ),
    byWiring,
    byPattern,
    implementedDocCount: IMPLEMENTED_NAMES.size,
    implementedInPool: [...IMPLEMENTED_NAMES].filter(n => dbCards.some(c => c.name === n)),
    implementedMissingFromPool: [...IMPLEMENTED_NAMES].filter(n => !dbCards.some(c => c.name === n)),
    seedStatus: seed?._parseError ? 'broken' : (seed ? 'ok' : 'missing'),
    seedCount: Array.isArray(seed) ? seed.length : 0,
    syncDiffs: diffs,
    cards: audited,
  }
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# 卡牌池审计报告（阶段0）')
  lines.push('')
  lines.push(`> 生成时间：${report.generatedAt}`)
  lines.push('> 命令：`node scripts/audit-cards.mjs`')
  lines.push('')
  lines.push('## 1. 卡池规模')
  lines.push('')
  lines.push('| 项目 | 数量 |')
  lines.push('|------|------|')
  lines.push(`| cardDatabase.ts 总条目 | **${report.poolSize}** |`)
  lines.push(`| 有效卡牌（排除模板行） | **${report.realPoolSize}** |`)
  lines.push(`| xlsx 模板占位行 | ${report.placeholderCount} |`)
  lines.push(`| 单位 / 环境 / 战术 | ${report.typeCounts.unit} / ${report.typeCounts.environment} / ${report.typeCounts.tactic} |`)
  lines.push(`| card-seed.json 状态 | ${report.seedStatus}（${report.seedCount} 条） |`)
  lines.push('')
  lines.push('### 151 vs 100 决策（已更新）')
  lines.push('')
  lines.push('- **有效卡池 = 148 张**（ID 范围 card_001–card_151，已删除 card_016/099/124 三处 xlsx 模板占位）。')
  lines.push('- **进度文档分母应使用 148**。')
  lines.push('- **card-seed.json 曾只有 100 条且 JSON 损坏** → 阶段0 用 sync 脚本全量重建。')
  lines.push('- xlsx 文件：' + (report.xlsxExists ? '仓库内存在，可用于校验' : '未在仓库中找到'))
  lines.push('')

  lines.push('## 2. 接线状态（wiring）')
  lines.push('')
  lines.push('| 状态 | 数量 | 说明 |')
  lines.push('|------|------|------|')
  const wiringDesc = {
    implemented_doc: '进度 MD 已标记实现',
    structured: '含结构化 effect（非 conditional/custom）',
    partial: '部分 structured + 部分 conditional',
    conditional_only: '仅 conditional/custom 占位，引擎不执行',
    placeholder_row: 'xlsx 模板行，待删除',
    no_effects: '无 effects',
  }
  for (const [k, names] of Object.entries(report.byWiring).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`| ${k} | ${names.length} | ${wiringDesc[k] || ''} |`)
  }
  lines.push('')

  lines.push('## 3. 效果模式分组（pattern）')
  lines.push('')
  for (const [k, names] of Object.entries(report.byPattern).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${k}（${names.length}）`)
    lines.push('')
    lines.push(names.map(n => `- ${n}`).join('\n'))
    lines.push('')
  }

  lines.push('## 4. 进度 MD 37 张 vs 卡池')
  lines.push('')
  lines.push(`- 文档标记：${report.implementedDocCount} 张`)
  lines.push(`- 卡池中存在：${report.implementedInPool.length} 张`)
  if (report.implementedMissingFromPool.length) {
    lines.push(`- **不在卡池中**：${report.implementedMissingFromPool.join('、')}`)
  }
  lines.push('')

  lines.push('## 5. 数据同步')
  lines.push('')
  if (report.syncDiffs.length === 0) {
    lines.push('✅ card-seed.json 与 cardDatabase.ts **完全一致**')
  } else {
    lines.push(`⚠️ 差异 **${report.syncDiffs.length}** 处（前 15 条）：`)
    lines.push('')
    for (const d of report.syncDiffs.slice(0, 15)) {
      lines.push(`- ${d.issue}: ${JSON.stringify(d)}`)
    }
    lines.push('')
    lines.push('修复：`node scripts/sync-card-seed.mjs`')
  }
  lines.push('')
  lines.push('### 同步规范')
  lines.push('')
  lines.push('1. **权威源**：`src/data/cardDatabase.ts`')
  lines.push('2. **联机种子**：`server/card-seed.json`')
  lines.push('3. **同步**：`node scripts/sync-card-seed.mjs`')
  lines.push('4. **校验**：`node scripts/sync-card-seed.mjs --check`')
  lines.push('5. **审计**：`node scripts/audit-cards.mjs`')
  lines.push('')

  lines.push('## 6. 阶段0.2 — 占位卡')
  lines.push('')
  const ph = report.byWiring.placeholder_row || []
  if (ph.length) {
    lines.push('以下条目将从 cardDatabase 删除（ID 保留空缺）：')
    lines.push('')
    for (const p of ph) lines.push(`- ${p}`)
  } else {
    lines.push('无占位卡。')
  }
  lines.push('')

  lines.push('## 7. 建议下一批（4A）')
  lines.push('')
  const candidates = (report.byPattern.on_field_power || [])
    .filter(n => !IMPLEMENTED_NAMES.has(n))
    .filter(n => !PLACEHOLDER_NAMES.has(n))
    .slice(0, 12)
  for (const n of candidates) lines.push(`- ${n}`)
  lines.push('')

  return lines.join('\n')
}

const dbCards = loadCardDefinitions()
const seed = loadSeedSafe()
const diffs = compareSeedToDb(seed, dbCards)
const report = buildReport(dbCards, seed, diffs)

writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8')
writeFileSync(OUT_MD, renderMarkdown(report), 'utf8')

console.log(`✅ 审计完成：${report.poolSize} 条（有效 ${report.realPoolSize}）`)
console.log('   wiring:', report.wiringSummary)
console.log(`   seed: ${report.seedStatus} (${report.seedCount} 条), 差异 ${diffs.length}`)
console.log(`   → ${OUT_MD}`)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report.wiringSummary, null, 2))
}

/**
 * 对比 xlsx 权威源与 cardDatabase.ts 的费用/战力
 */
import XLSX from 'xlsx'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadCardDefinitions } from './parse-card-database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../斯诺德对决卡牌列表（已开出）.xlsx')

const COL_NAME = 1
const COL_POWER = 4
const COL_COST = 5

function parseXlsxCards() {
  const wb = XLSX.readFile(XLSX_PATH)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  const byName = new Map()

  for (const row of rows) {
    const name = String(row[COL_NAME] ?? '').trim()
    if (!name || name === '名称') continue

    const powerStr = String(row[COL_POWER] ?? '').trim()
    const costStr = String(row[COL_COST] ?? '').trim()

    let type = 'unit'
    if (powerStr.includes('战术') || costStr.includes('战术')) type = 'tactic'
    else if (powerStr.includes('环境') || costStr.includes('环境')) type = 'environment'

    let basePower = 0
    if (type === 'unit') {
      const pn = parseInt(powerStr, 10)
      if (!isNaN(pn)) basePower = pn
    }

    let cost = 0
    const cn = parseInt(costStr, 10)
    if (!isNaN(cn)) cost = cn

    byName.set(name, { basePower, cost, type })
  }

  return byName
}

const xlsxByName = parseXlsxCards()
const db = loadCardDefinitions()

const swapped = []
const mismatches = []

for (const c of db) {
  const x = xlsxByName.get(c.name)
  if (!x) {
    mismatches.push({ id: c.id, name: c.name, issue: 'missing_in_xlsx' })
    continue
  }

  const isSwap = c.basePower === x.cost && c.cost === x.basePower && c.basePower !== x.basePower
  if (isSwap) {
    swapped.push({
      id: c.id,
      name: c.name,
      db: { cost: c.cost, power: c.basePower },
      xlsx: { cost: x.cost, power: x.basePower },
    })
    continue
  }

  if (c.basePower !== x.basePower || c.cost !== x.cost) {
    mismatches.push({
      id: c.id,
      name: c.name,
      db: { cost: c.cost, power: c.basePower },
      xlsx: { cost: x.cost, power: x.basePower },
    })
  }
}

console.log(`SWAPPED (费用/战力颠倒): ${swapped.length}`)
for (const s of swapped) {
  console.log(`  ${s.id} ${s.name}: DB ${s.db.cost}费/${s.db.power}战 → 应为 ${s.xlsx.cost}费/${s.xlsx.power}战`)
}

console.log(`\nOTHER mismatches: ${mismatches.length}`)
for (const m of mismatches) {
  console.log(`  ${m.id ?? ''} ${m.name}:`, m.issue ?? m)
}

process.exit(swapped.length > 0 || mismatches.length > 0 ? 1 : 0)

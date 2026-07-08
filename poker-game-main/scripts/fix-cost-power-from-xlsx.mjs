/**
 * 从 xlsx 权威源修正 cardDatabase.ts 的 cost / basePower / currentPower
 * 用法: node scripts/fix-cost-power-from-xlsx.mjs [--dry-run]
 */
import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DB_TS = resolve(ROOT, 'src/data/cardDatabase.ts')
const XLSX_PATH = resolve(ROOT, '..', '斯诺德对决卡牌列表（已开出）.xlsx')

const COL_NAME = 1
const COL_POWER = 4
const COL_COST = 5
const dryRun = process.argv.includes('--dry-run')

function parseXlsxByName() {
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

const xlsxByName = parseXlsxByName()
const original = readFileSync(DB_TS, 'utf8')
let src = original

const nameRe = /name: '([^']+)'/g
const patches = []

let m
while ((m = nameRe.exec(original)) !== null) {
  const name = m[1]
  const start = original.lastIndexOf('{', m.index)
  const end = original.indexOf('},', m.index)
  if (start === -1 || end === -1) continue

  const x = xlsxByName.get(name)
  if (!x) continue

  const slice = original.slice(start, end + 2)
  const bpMatch = slice.match(/basePower: (-?\d+),/)
  const cpMatch = slice.match(/currentPower: (-?\d+),/)
  const costMatch = slice.match(/cost: (-?\d+),/)
  if (!bpMatch || !cpMatch || !costMatch) continue

  const old = {
    basePower: Number(bpMatch[1]),
    currentPower: Number(cpMatch[1]),
    cost: Number(costMatch[1]),
  }

  if (old.basePower === x.basePower && old.cost === x.cost) continue

  const updated = slice
    .replace(/basePower: -?\d+,/, `basePower: ${x.basePower},`)
    .replace(/currentPower: -?\d+,/, `currentPower: ${x.basePower},`)
    .replace(/cost: -?\d+,/, `cost: ${x.cost},`)

  patches.push({
    name,
    start,
    end: end + 2,
    old,
    next: { basePower: x.basePower, currentPower: x.basePower, cost: x.cost },
    updated,
  })
}

patches.sort((a, b) => b.start - a.start)
for (const p of patches) {
  src = src.slice(0, p.start) + p.updated + src.slice(p.end)
}

const changes = patches.reverse()

console.log(`${dryRun ? '[dry-run] ' : ''}修正 ${changes.length} 张卡牌的费用/战力`)
for (const c of changes) {
  console.log(
    `  ${c.name}: ${c.old.cost}费/${c.old.basePower}战 → ${c.next.cost}费/${c.next.basePower}战`,
  )
}

if (!dryRun && changes.length > 0) {
  writeFileSync(DB_TS, src, 'utf8')
  console.log(`\n✅ 已写入 ${DB_TS}`)
}

process.exit(0)

/**
 * 从 cardDatabase.ts 同步 card-seed.json（联机服务端种子）
 *
 * 权威源：src/data/cardDatabase.ts
 * 输出：  server/card-seed.json
 *
 * 用法: node scripts/sync-card-seed.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadCardDefinitions, toSeedCards } from './parse-card-database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED = resolve(__dirname, '../server/card-seed.json')

const checkOnly = process.argv.includes('--check')
const cards = toSeedCards(loadCardDefinitions())
const out = JSON.stringify(cards, null, 2) + '\n'

if (checkOnly) {
  const existing = readFileSync(SEED, 'utf8')
  if (existing !== out) {
    console.error('❌ card-seed.json 与 cardDatabase.ts 不同步')
    console.error('   运行: node scripts/sync-card-seed.mjs')
    process.exit(1)
  }
  console.log('✅ card-seed.json 已同步')
  process.exit(0)
}

writeFileSync(SEED, out, 'utf8')
console.log(`✅ 已写入 ${cards.length} 张卡 → server/card-seed.json`)

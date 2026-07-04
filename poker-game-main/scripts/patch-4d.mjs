import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const p = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/cardDatabase.ts')
let s = readFileSync(p, 'utf8')

const druidOld = /id: 'card_049'[\s\S]*?timing: 'roundStart',\s*type: 'conditional',/
const druidNew = `id: 'card_049',
    name: '德鲁伊',
    type: 'unit',
    keywords: ['职业者'],
    attribute: '木',
    basePower: 2,
    currentPower: 2,
    cost: 1,
    effects: [
    {
      timing: 'roundStart',
      type: 'restoreEnergy',
      value: 1,
      requireFieldKeywords: ['自然'],
      requireFieldCardType: 'environment',`

const shootOld = /id: 'card_103'[\s\S]*?timing: 'roundStart',\s*type: 'conditional',/
const shootNew = `id: 'card_103',
    name: '射击俱乐部',
    type: 'environment',
    keywords: ['建筑'],
    attribute: '无',
    basePower: 2,
    currentPower: 2,
    cost: 0,
    effects: [
    {
      timing: 'roundStart',
      type: 'searchDeck',
      searchName: '射击',
      maxCount: 1,
      shuffleAfterSearch: true,
      searchDiscard: false,`

if (!druidOld.test(s)) throw new Error('card_049 not found')
s = s.replace(druidOld, druidNew)
if (!shootOld.test(s)) throw new Error('card_103 not found')
s = s.replace(shootOld, shootNew)
writeFileSync(p, s)
console.log('OK patched card_049 card_103')

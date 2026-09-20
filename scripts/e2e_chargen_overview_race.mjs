// E2E 回归：角色创建页选择矮人后，角色概览不应出现「[人类]察觉」
// 运行：node scripts/e2e_chargen_overview_race.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = pathToFileURL(join(here, '..', '斯诺德跑团', '角色创建页.html')).href;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(html, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(500);
await page.evaluate(() => goToStep(2)); // 种族步骤
await page.waitForSelector('#raceGrid .card', { timeout: 5000 });
await page.locator('#raceGrid .card', { hasText: '人类' }).first().click();
await page.waitForSelector('#humanSkillArea', { timeout: 5000 });
await page.locator('#humanSkillArea .spec-btn[data-skill="察觉"]').first().click();
await page.waitForTimeout(200);
const human = await page.evaluate(() => ({ free: CHAR.humanFreeSkill, ov: document.getElementById('ovContent').innerHTML }));
await page.locator('#raceGrid .card', { hasText: '矮人' }).first().click();
await page.waitForTimeout(200);
const dwarf = await page.evaluate(() => ({ race: CHAR.raceName, free: CHAR.humanFreeSkill, ov: document.getElementById('ovContent').innerHTML }));
await browser.close();
const humanLine = human.free === '察觉' && human.ov.includes('人类') && human.ov.includes('察觉');
const dwarfStale = dwarf.free !== null || (dwarf.ov.includes('人类') && dwarf.ov.includes('察觉'));
const pass = humanLine && !dwarfStale && errs.length === 0;
console.log('人类选择察觉:', JSON.stringify({ free: human.free, hasHumanTag: human.ov.includes('人类') }));
console.log('切到矮人后:', JSON.stringify({ race: dwarf.race, free: dwarf.free, hasHumanTag: dwarf.ov.includes('人类'), hasJuecha: dwarf.ov.includes('察觉') }));
if (errs.length) console.error('page errors:', errs);
console.log(pass ? 'E2E PASS' : 'E2E FAIL');
process.exit(pass ? 0 : 1);

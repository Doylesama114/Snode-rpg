#!/usr/bin/env node
/**
 * Phase 3 — router, mode, intent-specific prompts, wizard stub.
 * Run: node scripts/validate-advisor-phase3.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { routeQuery, getPromptProfile } from './advisor-router.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { buildSystemPrompt } from './advisor-prompt.mjs';
import { advise } from './mage-advisor.mjs';
import { normalizeWizardState } from './advisor-wizard-state.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIZARD_MOCK = path.join(ROOT, 'advisor', 'snapshots', 'wizard_step2_mock.json');

const ROUTER_CASES = [
  { query: '血族属性加成', expectIntent: 'entity_qa', expectMode: 'entity_qa' },
  { query: '从1级升到8级会获得什么奖励', expectIntent: 'leveling', expectMode: 'advisor' },
  { query: '塑能流派 1～3 级优先学什么', expectIntent: 'mage_skills', expectMode: 'advisor' },
  { query: '智力 14 的法师能走冰霜法师吗', expectIntent: 'eligibility', expectMode: 'advisor' },
];

const PROMPT_PROFILES = [
  { intent: 'leveling', mode: 'advisor', mustInclude: ['升级奖励', '逐级表'] },
  { intent: 'entity_qa', mode: 'entity_qa', mustInclude: ['实体百科', '实体详情'] },
  { intent: 'wizard_step', mode: 'wizard', mustInclude: ['逐步车卡向导', '当前步骤'] },
  { intent: 'mage_skills', mode: 'advisor', mustInclude: ['法师技能', '塑能箭'] },
];

let failed = 0;

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

for (const c of ROUTER_CASES) {
  const route = routeQuery({ query: c.query, entityHits: [] });
  if (route.intent !== c.expectIntent) {
    fail(`router intent: ${c.query}`, `got ${route.intent}`);
  } else {
    pass(`router intent: ${c.query} → ${route.intent}`);
  }
  if (route.mode !== c.expectMode) {
    fail(`router mode: ${c.query}`, `got ${route.mode}`);
  } else {
    pass(`router mode: ${c.query} → ${route.mode}`);
  }
}

for (const p of PROMPT_PROFILES) {
  const sys = buildSystemPrompt({
    intent: p.intent,
    mode: p.mode,
    promptProfile: getPromptProfile(p.intent, p.mode),
  });
  for (const needle of p.mustInclude) {
    if (!sys.includes(needle)) fail(`prompt ${p.intent} ∋ ${needle}`);
    else pass(`prompt ${p.intent} ∋ ${needle}`);
  }
}

const wizardRaw = JSON.parse(fs.readFileSync(WIZARD_MOCK, 'utf8'));
const wizardState = normalizeWizardState(wizardRaw);
if (wizardState.step !== 2) fail('wizard normalize step', String(wizardState.step));
else pass('wizard normalize step=2');

const wRet = retrieve('这一步选什么种族好', {
  mode: 'wizard',
  wizardState: wizardRaw,
});
if (wRet.mode !== 'wizard') fail('wizard retrieve mode', wRet.mode);
else pass('wizard retrieve mode=wizard');
if (wRet.intent !== 'wizard_step') fail('wizard retrieve intent', wRet.intent);
else pass('wizard retrieve intent=wizard_step');
const wCtx = formatContext(wRet);
if (!wCtx.includes('车卡向导状态')) fail('wizard context section');
else pass('wizard context has 车卡向导状态');
if (!wCtx.includes('选择种族')) fail('wizard context step label');
else pass('wizard context step=选择种族');

const dry = await advise('推荐智力高的种族', {
  dryRun: true,
  mode: 'wizard',
  wizardState: WIZARD_MOCK,
});
if (!dry.messages[0].content.includes('逐步车卡向导')) fail('wizard dry-run prompt profile');
else pass('wizard dry-run prompt profile');
if (!dry.context.includes('模式: wizard')) fail('wizard dry-run context mode');
else pass('wizard dry-run context mode');

console.log(`\nPhase 3 validation: ${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
if (failed) process.exit(1);
